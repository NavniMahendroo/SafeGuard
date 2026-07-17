import asyncio
import datetime
import time
from contextlib import asynccontextmanager
from typing import Set, Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import init_db, get_db, Permit, Incident, Worker, PermitCreate, PermitResponse, IncidentResponse
from app.engine import state, state_lock, NODES
from app.simulator import telemetry_simulator_loop
from app.audit import record_audit
from app.anomaly import detector
from app.predictor import predictor

# ==============================================================================
# FASTAPI APPLICATION SETUP & LIFECYCLE MANAGEMENT
# ==============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database
    await init_db()
    print("[SafeGuard] Database initialized")
    
    # Sync database active permits to in-memory state on startup
    from sqlalchemy import select
    from app.models import AsyncSessionLocal, Permit
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Permit).where(Permit.status == "active"))
        active_db_permits = result.scalars().all()
        async with state_lock:
            state["active_permits"] = [
                {
                    "id": p.id,
                    "type": p.permit_type,
                    "zone": p.zone,
                    "issued_at": p.issued_at.isoformat()
                }
                for p in active_db_permits
            ]
    print(f"[SafeGuard] Synchronized {len(state['active_permits'])} active permits from database")
    
    # Define WebSocket broadcast callback
    async def ws_broadcast_callback(payload: dict):
        await manager.broadcast(payload)
    
    # Start simulator background task
    simulator_task = asyncio.create_task(telemetry_simulator_loop(broadcast_callback=ws_broadcast_callback))
    
    yield
    
    # Shutdown
    simulator_task.cancel()
    try:
        await simulator_task
    except asyncio.CancelledError:
        pass
    print("[SafeGuard] Shutdown complete")

app = FastAPI(
    title="SafeGuard Industrial Safety API",
    description="Event-Driven Industrial Safety Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# WEBSOCKET CONNECTION MANAGER
# ==============================================================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"[WebSocket] Client connected")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WebSocket] Client disconnected")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        disconnected = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for connection in disconnected:
            self.disconnect(connection)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time telemetry broadcast every 2 seconds."""
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocket Error] {e}")
        manager.disconnect(websocket)

# ==============================================================================
# REST API ENDPOINTS
# ==============================================================================
@app.post("/api/permits")
async def create_permit(permit: PermitCreate, db: AsyncSession = Depends(get_db)):
    """Issue new permit {type, zone}"""
    # Check if zone already has active permit
    from sqlalchemy import select
    result = await db.execute(
        select(Permit).where(Permit.zone == permit.zone, Permit.status == "active")
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Zone {permit.zone} already has an active permit")
    
    new_permit = Permit(
        permit_type=permit.type,
        zone=permit.zone,
        status="active"
    )
    db.add(new_permit)
    await db.commit()
    await db.refresh(new_permit)
    
    # Update in-memory state
    async with state_lock:
        state["active_permits"].append({
            "id": new_permit.id,
            "type": new_permit.permit_type,
            "zone": new_permit.zone,
            "issued_at": new_permit.issued_at.isoformat()
        })
    
    return {
        "id": new_permit.id,
        "type": new_permit.permit_type,
        "zone": new_permit.zone,
        "issued_at": new_permit.issued_at.isoformat(),
        "status": new_permit.status
    }

@app.delete("/api/permits/{permit_id}")
async def revoke_permit(permit_id: int, db: AsyncSession = Depends(get_db)):
    """Revoke permit by ID"""
    from sqlalchemy import select
    result = await db.execute(select(Permit).where(Permit.id == permit_id))
    permit = result.scalar_one_or_none()
    if not permit:
        raise HTTPException(status_code=404, detail="Permit not found")
    
    permit.status = "revoked"
    await db.commit()
    
    # Update in-memory state
    async with state_lock:
        state["active_permits"] = [
            p for p in state["active_permits"] if p["id"] != permit_id
        ]
    
    return {"status": "revoked", "permit_id": permit_id}

@app.get("/api/permits")
async def list_permits(db: AsyncSession = Depends(get_db)):
    """List active permits"""
    from sqlalchemy import select
    result = await db.execute(
        select(Permit).where(Permit.status == "active").order_by(Permit.issued_at.desc())
    )
    permits = result.scalars().all()
    return [
        {
            "id": p.id,
            "type": p.permit_type,
            "zone": p.zone,
            "issued_at": p.issued_at.isoformat(),
            "status": p.status
        }
        for p in permits
    ]

@app.post("/api/resolve")
async def resolve_incident(db: AsyncSession = Depends(get_db)):
    """Manual override, reset to NORMAL"""
    async with state_lock:
        state["status"] = "NORMAL"
        state["triggered_rules"] = []
        state["hazard_node"] = None
        state["evacuation_paths"] = {}
        state["cooldown_seconds_remaining"] = 0
        state["cooldown_start_time"] = None
        state["gas_level"] = 4.0
        state["temperature"] = 32.0
        
        for worker in state["workers"].values():
            worker["status"] = "normal"
            
        # Update database incident resolution on manual reset
        active_id = state.get("active_incident_id")
        if active_id is not None:
            from sqlalchemy import select
            import datetime
            try:
                res = await db.execute(select(Incident).where(Incident.id == active_id))
                inc = res.scalar_one_or_none()
                if inc:
                    inc.resolved_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
                    await db.commit()
            except Exception as e:
                print(f"[API Database Error] Failed to resolve incident: {e}")
            state["active_incident_id"] = None
    
    return {"status": "NORMAL", "message": "System reset to normal operations"}

@app.get("/api/incidents")
async def list_incidents(db: AsyncSession = Depends(get_db)):
    """List incidents from PostgreSQL"""
    from sqlalchemy import select
    result = await db.execute(
        select(Incident).order_by(Incident.timestamp.desc())
    )
    incidents = result.scalars().all()
    return [
        {
            "id": i.id,
            "timestamp": i.timestamp.isoformat(),
            "rule_id": i.rule_id,
            "severity": i.severity,
            "action": i.action,
            "gas_level": i.gas_level,
            "temperature": i.temperature,
            "workers_affected": i.workers_affected,
            "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None
        }
        for i in incidents
    ]

@app.get("/api/insights")
async def get_insights(db: AsyncSession = Depends(get_db)):
    """Violation distribution analytics"""
    from sqlalchemy import select
    result = await db.execute(select(Incident))
    incidents = result.scalars().all()
    
    if not incidents:
        return {
            "total_incidents": 0,
            "distribution": {},
            "summary": "No incidents recorded"
        }
    
    total = len(incidents)
    counts = {"OISD-STD-137": 0, "FACTORY-ACT-SEC-36": 0, "DGMS-THERMAL-STRESS": 0}
    for inc in incidents:
        if inc.rule_id in counts:
            counts[inc.rule_id] += 1
    
    distribution = {
        "OISD-STD-137": round((counts["OISD-STD-137"] / total) * 100, 1),
        "FACTORY-ACT-SEC-36": round((counts["FACTORY-ACT-SEC-36"] / total) * 100, 1),
        "DGMS-THERMAL-STRESS": round((counts["DGMS-THERMAL-STRESS"] / total) * 100, 1)
    }
    
    top_rule = max(counts, key=counts.get)
    summary = f"{distribution[top_rule]}% of incidents from {top_rule}"
    
    return {
        "total_incidents": total,
        "distribution": distribution,
        "summary": summary
    }

@app.get("/api/audit/{incident_id}")
async def get_audit(incident_id: int):
    """Fetch audit snapshot JSON"""
    import os
    import json
    audits_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "audits")
    
    # Find audit files for this incident and sort by filename descending (latest timestamp first)
    matching_files = [f for f in os.listdir(audits_dir) if f"incident_{incident_id}_" in f]
    if matching_files:
        latest_filename = sorted(matching_files, reverse=True)[0]
        filepath = os.path.join(audits_dir, latest_filename)
        with open(filepath, "r") as f:
            return json.load(f)
            
    raise HTTPException(status_code=404, detail="Audit not found")

@app.get("/health")
async def health_check():
    """Health check"""
    return {"status": "healthy"}
