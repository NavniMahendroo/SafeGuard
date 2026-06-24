import asyncio
import datetime
import math
import random
from contextlib import asynccontextmanager
from typing import Dict, List, Set, Optional

import networkx as nx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ==============================================================================
# DATABASE CONFIGURATION (SQLite + SQLAlchemy)
# STRICT LIMIT: Used ONLY for static permit logs and incident reports.
# NEVER write live telemetry here to avoid database locks.
# ==============================================================================
DATABASE_URL = "sqlite:///./safeguard.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class IncidentReport(Base):
    __tablename__ = "incident_reports"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))
    trigger_reason = Column(String, nullable=False)
    gas_level = Column(Float, nullable=False)
    affected_workers = Column(String, nullable=False)  # Comma-separated list of worker IDs
    resolved_at = Column(DateTime, nullable=True)

class PermitLog(Base):
    __tablename__ = "permit_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    zone_id = Column(Integer, nullable=False)
    zone_name = Column(String, nullable=False)
    permit_type = Column(String, nullable=False)
    issued_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))
    status = Column(String, default="Active")  # "Active" or "Closed"

def init_db():
    """Initializes the database schema and seeds initial permit data."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if the default Hot Work permit exists at Gas Storage Zone (Node 4)
        active_permit = db.query(PermitLog).filter(
            PermitLog.zone_id == 4, 
            PermitLog.status == "Active"
        ).first()
        if not active_permit:
            permit = PermitLog(
                zone_id=4,
                zone_name="Gas Storage Zone",
                permit_type="Hot Work",
                status="Active"
            )
            db.add(permit)
            db.commit()
    finally:
        db.close()

# DB Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==============================================================================
# PYDANTIC MODEL SCHEMAS
# ==============================================================================
class PermitCreate(BaseModel):
    zone_id: int
    zone_name: str
    permit_type: str

class PermitResponse(BaseModel):
    id: int
    zone_id: int
    zone_name: str
    permit_type: str
    issued_at: datetime.datetime
    status: str
    
    class Config:
        from_attributes = True

class IncidentResponse(BaseModel):
    id: int
    timestamp: datetime.datetime
    trigger_reason: str
    gas_level: float
    affected_workers: str
    resolved_at: Optional[datetime.datetime] = None
    
    class Config:
        from_attributes = True


# ==============================================================================
# NETWORKX MAP DEFINTION (Factory Layout Graph)
# Nodes map to coordinate space [1000x1000 pixels] for frontend rendering.
# ==============================================================================
G = nx.Graph()

# Node Definitions
NODES = {
    1: {"name": "Main Entrance", "x": 100, "y": 500, "is_exit": True},
    2: {"name": "Assembly Line A", "x": 300, "y": 300, "is_exit": False},
    3: {"name": "Assembly Line B", "x": 300, "y": 700, "is_exit": False},
    4: {"name": "Gas Storage Zone", "x": 600, "y": 300, "is_exit": False},
    5: {"name": "Hot Work Zone", "x": 600, "y": 700, "is_exit": False},
    6: {"name": "Emergency Exit", "x": 900, "y": 500, "is_exit": True}
}

for node_id, attrs in NODES.items():
    G.add_node(node_id, **attrs)

# Connect nodes and pre-calculate Euclidean distances as weights
EDGES = [
    (1, 2), (1, 3),  # From Entrance to Assembly lines
    (2, 3),          # Corridor between Assembly Line A and B
    (2, 4),          # Assembly Line A to Gas Storage
    (3, 5),          # Assembly Line B to Hot Work Zone
    (4, 5),          # Corridor between Gas Storage and Hot Work Zone
    (4, 6), (5, 6)   # From Hazard zones to Emergency Exit
]

for u, v in EDGES:
    pos_u = (NODES[u]["x"], NODES[u]["y"])
    pos_v = (NODES[v]["x"], NODES[v]["y"])
    dist = math.sqrt((pos_u[0] - pos_v[0])**2 + (pos_u[1] - pos_v[1])**2)
    G.add_edge(u, v, weight=dist, original_weight=dist)


# ==============================================================================
# IN-MEMORY TELEMETRY STATE
# High-velocity state that lives exclusively in python memory to prevent SQLite locks.
# ==============================================================================
state: Dict = {
    "workers": {
        "W-108": {
            "id": "W-108",
            "current_node": 1,
            "coords": [100.0, 500.0],
            "destination": 6,
            "path": [],
            "status": "Safe",
            "color": "#3b82f6"  # Premium Blue
        },
        "W-204": {
            "id": "W-204",
            "current_node": 2,
            "coords": [300.0, 300.0],
            "destination": 5,
            "path": [],
            "status": "Safe",
            "color": "#10b981"  # Premium Emerald
        },
        "W-512": {
            "id": "W-512",
            "current_node": 6,
            "coords": [900.0, 500.0],
            "destination": 1,
            "path": [],
            "status": "Safe",
            "color": "#f59e0b"  # Premium Amber
        }
    },
    "sensors": {
        "gas_level": 4.5  # Simulated at Gas Storage Zone (Node 4)
    },
    "permits": {
        4: "Hot Work"  # In-memory mapping of active permit (Node 4: Hot Work)
    },
    "critical_alert": False,
    "active_incident_id": None
}

# Thread-safety lock for state modifications
state_lock = asyncio.Lock()


# ==============================================================================
# ROUTING & PATHFINDING UTILITIES
# ==============================================================================
def find_path(start_node: int, dest_node: int, active_alert: bool) -> List[int]:
    """
    Computes shortest path using A* pathfinding.
    If active_alert is True, we penalize edges incident to Gas Storage Zone (Node 4)
    to force routes to steer clear of the hazard area.
    """
    temp_graph = G.copy()
    
    if active_alert:
        # Heavily penalize edges connected to Gas Storage Zone (Node 4)
        for u, v in G.edges(4):
            temp_graph[u][v]['weight'] = 999999.0
            
    try:
        def heuristic(n1, n2):
            node1 = temp_graph.nodes[n1]
            node2 = temp_graph.nodes[n2]
            return math.sqrt((node1['x'] - node2['x'])**2 + (node1['y'] - node2['y'])**2)
            
        path = nx.astar_path(temp_graph, start_node, dest_node, heuristic=heuristic, weight='weight')
        # Return path excluding the start node if it's already current
        return path
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        # Fallback to direct path or empty if impossible
        return []

def get_nearest_exit(start_node: int, active_alert: bool) -> int:
    """Finds the nearest safe exit (Node 1 or Node 6) using A* distances."""
    exits = [1, 6]
    shortest_dist = float('inf')
    best_exit = 1
    
    for exit_node in exits:
        path = find_path(start_node, exit_node, active_alert)
        if path:
            # Calculate path length
            dist = 0
            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                # Check weight in standard graph or penalized graph depending on alert
                weight = 999999.0 if (active_alert and (u == 4 or v == 4)) else G[u][v]['weight']
                dist += weight
            if dist < shortest_dist:
                shortest_dist = dist
                best_exit = exit_node
    return best_exit


# ==============================================================================
# TELEMETRY SIMULATOR & COMPOUND RISK FUSION ENGINE
# Runs as an asynchronous background loop updating state and routing real-time.
# ==============================================================================
async def telemetry_simulator_loop():
    """
    Constantly simulates gas levels, worker movement, and triggers automated
    emergency routing when compound risk is detected.
    """
    print("[SafeGuard Simulator] Background engine started.")
    
    # Speed of workers (pixels per tick)
    SPEED = 40.0
    
    while True:
        try:
            await asyncio.sleep(1.0)
            
            async with state_lock:
                # 1. Simulate Gas Levels (Smooth random walk at Node 4)
                gas = state["sensors"]["gas_level"]
                # 70% chance to rise during test, 30% chance to drop, overall drifting upwards to hit threshold
                drift = random.uniform(-1.0, 1.8)
                new_gas = max(2.0, min(15.0, gas + drift))
                state["sensors"]["gas_level"] = round(new_gas, 2)
                
                # Check for active permits from DB status (syncing database setting to memory)
                has_hot_work = state["permits"].get(4) == "Hot Work"
                
                # Count workers currently on the factory floor (not evacuated)
                active_workers = [w_id for w_id, w in state["workers"].items() if w["status"] != "Evacuated"]
                
                # 2. Compound Risk Fusion Rule Engine
                # Rule: Gas > 12.0% AND active Permit == "Hot Work" AND Active Workers > 0
                risk_triggered = (
                    state["sensors"]["gas_level"] > 12.0 and 
                    has_hot_work and 
                    len(active_workers) > 0
                )
                
                # Handle State Transition: NORMAL -> CRITICAL
                if risk_triggered and not state["critical_alert"]:
                    state["critical_alert"] = True
                    print(f"\n[ALERT] Compound Risk Triggered! Gas Level: {state['sensors']['gas_level']}%. Evacuating floor!")
                    
                    # Create DB Session and record incident
                    db = SessionLocal()
                    try:
                        incident = IncidentReport(
                            trigger_reason=f"Gas level exceeded safety threshold ({state['sensors']['gas_level']}%) during Hot Work",
                            gas_level=state["sensors"]["gas_level"],
                            affected_workers=",".join(active_workers)
                        )
                        db.add(incident)
                        db.commit()
                        state["active_incident_id"] = incident.id
                        print(f"[DB] Logged Incident Report ID: {incident.id}")
                    except Exception as e:
                        print(f"[DB Error] Failed to log incident: {e}")
                    finally:
                        db.close()
                    
                    # Reroute workers immediately away from Node 4 (Gas Storage)
                    for w_id, worker in state["workers"].items():
                        if worker["status"] != "Evacuated":
                            # Reroute to nearest safe exit (avoiding Node 4)
                            curr = worker["current_node"]
                            
                            # If worker is currently moving and heading towards Node 4, force return to last node
                            if worker["path"] and worker["path"][0] == 4:
                                # Reverse route
                                start_node = curr
                            elif worker["path"]:
                                start_node = worker["path"][0]
                            else:
                                start_node = curr
                                
                            safe_exit = get_nearest_exit(start_node, active_alert=True)
                            new_path = find_path(start_node, safe_exit, active_alert=True)
                            
                            worker["destination"] = safe_exit
                            worker["path"] = new_path
                            worker["status"] = "Rerouting"
                
                # Handle State Transition: CRITICAL -> NORMAL (Gas drops below 10.0%)
                elif not risk_triggered and state["critical_alert"] and state["sensors"]["gas_level"] < 10.0:
                    state["critical_alert"] = False
                    print(f"\n[INFO] Hazard resolved. Gas level: {state['sensors']['gas_level']}%. Resuming operations.")
                    
                    # Close incident in database
                    if state["active_incident_id"] is not None:
                        db = SessionLocal()
                        try:
                            incident = db.query(IncidentReport).filter(IncidentReport.id == state["active_incident_id"]).first()
                            if incident:
                                incident.resolved_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
                                db.commit()
                                print(f"[DB] Incident ID {incident.id} marked as resolved.")
                        except Exception as e:
                            print(f"[DB Error] Failed to update incident: {e}")
                        finally:
                            db.close()
                        state["active_incident_id"] = None
                    
                    # Revert workers to normal safe status and let them choose new destinations
                    for w_id, worker in state["workers"].items():
                        worker["status"] = "Safe"
                        worker["path"] = []  # Let simulator assign new target
                
                # 3. Simulate Worker Movement Along Calculated Paths
                for w_id, worker in state["workers"].items():
                    # Skip workers who are already evacuated
                    if worker["status"] == "Evacuated":
                        continue
                    
                    # Assign random destination if worker has no path and layout is normal
                    if not worker["path"]:
                        if state["critical_alert"]:
                            # If they are at an exit node, mark as evacuated
                            if worker["current_node"] in [1, 6]:
                                worker["status"] = "Evacuated"
                                worker["coords"] = [NODES[worker["current_node"]]["x"], NODES[worker["current_node"]]["y"]]
                                print(f"[SafeGuard Simulation] Worker {w_id} successfully evacuated to Exit Node {worker['current_node']}.")
                                continue
                            else:
                                # Not at exit but path empty: find path to nearest exit
                                safe_exit = get_nearest_exit(worker["current_node"], active_alert=True)
                                worker["destination"] = safe_exit
                                worker["path"] = find_path(worker["current_node"], safe_exit, active_alert=True)
                                if not worker["path"]:
                                    continue
                        else:
                            # Normal operation: pick random new target node
                            curr = worker["current_node"]
                            targets = [n for n in NODES.keys() if n != curr]
                            rand_target = random.choice(targets)
                            worker["destination"] = rand_target
                            worker["path"] = find_path(curr, rand_target, active_alert=False)
                            worker["status"] = "Safe"
                    
                    # Move worker toward next node in path
                    if worker["path"]:
                        next_node = worker["path"][0]
                        target_coords = [NODES[next_node]["x"], NODES[next_node]["y"]]
                        
                        dx = target_coords[0] - worker["coords"][0]
                        dy = target_coords[1] - worker["coords"][1]
                        dist = math.sqrt(dx**2 + dy**2)
                        
                        if dist <= SPEED:
                            # Worker arrives at next node
                            worker["coords"] = target_coords
                            worker["current_node"] = next_node
                            worker["path"].pop(0)  # Remove node from path
                            
                            # Check if they just arrived at their exit during evacuation
                            if state["critical_alert"] and next_node in [1, 6] and not worker["path"]:
                                worker["status"] = "Evacuated"
                                print(f"[SafeGuard Simulation] Worker {w_id} successfully evacuated to Exit Node {next_node}.")
                        else:
                            # Move incrementally towards node
                            worker["coords"][0] += (dx / dist) * SPEED
                            worker["coords"][1] += (dy / dist) * SPEED
                
                # 4. Broadcast updated state to all WebSocket clients
                payload = {
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).isoformat(),
                    "critical_alert": state["critical_alert"],
                    "gas_level": state["sensors"]["gas_level"],
                    "active_permits": [
                        {
                            "zone_id": zone_id,
                            "permit_type": p_type,
                            "zone_name": NODES.get(zone_id, {}).get("name", f"Zone {zone_id}")
                        } for zone_id, p_type in state["permits"].items()
                    ],
                    "workers": list(state["workers"].values()),
                    "graph": {
                        "nodes": [{"id": nid, **nattr} for nid, nattr in NODES.items()],
                        "edges": [{"source": u, "target": v, "weight": round(d["weight"], 1)} for u, v, d in G.edges(data=True)]
                    }
                }
                
                await manager.broadcast(payload)
                
        except Exception as e:
            print(f"[Error in Simulator Loop] {e}")


# ==============================================================================
# FASTAPI APPLICATION SETUP & LIFECYCLE MANAGEMENT
# ==============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Sequence
    init_db()
    # Spin up simulation background thread
    simulator_task = asyncio.create_task(telemetry_simulator_loop())
    yield
    # Shutdown Sequence
    simulator_task.cancel()
    try:
        await simulator_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="SafeGuard Industrial Safety API",
    description="Event-Driven, AI-Powered Industrial Safety Intelligence Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for Frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# WEBSOCKET STATE CONNECTION MANAGER
# ==============================================================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"[WebSocket] Connected: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WebSocket] Disconnected")

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

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """Establishes continuous telemetry data pipe to clients."""
    await manager.connect(websocket)
    try:
        # Keep connection alive; discard incoming messages from clients (readonly stream)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocket Exception] {e}")
        manager.disconnect(websocket)


# ==============================================================================
# REST API ENDPOINTS
# ==============================================================================
@app.get("/api/state")
async def get_current_state():
    """Retrieve full in-memory system status (snapshot)."""
    async with state_lock:
        return {
            "critical_alert": state["critical_alert"],
            "gas_level": state["sensors"]["gas_level"],
            "permits": state["permits"],
            "workers": list(state["workers"].values())
        }

@app.get("/api/incidents", response_model=List[IncidentResponse])
def get_incidents(db: Session = Depends(get_db)):
    """Fetch incident report logs from SQLite."""
    return db.query(IncidentReport).order_by(IncidentReport.timestamp.desc()).all()

@app.get("/api/permits", response_model=List[PermitResponse])
def get_permits(db: Session = Depends(get_db)):
    """Fetch active and closed permit history from SQLite."""
    return db.query(PermitLog).order_by(PermitLog.issued_at.desc()).all()

@app.post("/api/permits", response_model=PermitResponse)
def create_permit(permit_in: PermitCreate, db: Session = Depends(get_db)):
    """Issue a new work permit and register it in the telemetry model."""
    if permit_in.zone_id not in NODES:
        raise HTTPException(status_code=400, detail=f"Invalid zone_id: Node {permit_in.zone_id} does not exist in the factory floor layout.")
    
    permit = PermitLog(
        zone_id=permit_in.zone_id,
        zone_name=permit_in.zone_name,
        permit_type=permit_in.permit_type,
        status="Active"
    )
    db.add(permit)
    db.commit()
    db.refresh(permit)
    
    # Update in-memory permit mapping
    state["permits"][permit_in.zone_id] = permit_in.permit_type
    return permit

@app.post("/api/permits/{permit_id}/close", response_model=PermitResponse)
def close_permit(permit_id: int, db: Session = Depends(get_db)):
    """Closes an active permit and removes it from the routing simulation."""
    permit = db.query(PermitLog).filter(PermitLog.id == permit_id).first()
    if not permit:
        raise HTTPException(status_code=404, detail=f"Permit with ID {permit_id} not found.")
        
    permit.status = "Closed"
    db.commit()
    db.refresh(permit)
    
    # Remove from active in-memory permits
    if permit.zone_id in state["permits"]:
        del state["permits"][permit.zone_id]
        
    return permit
