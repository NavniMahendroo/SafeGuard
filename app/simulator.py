import asyncio
import datetime
import random
import time
from typing import Dict, List, Optional

from app.engine import state, state_lock, NODES, G, evaluate_compound_risk, get_safe_routes
from app.anomaly import detector
from app.predictor import predictor

# Non-exit nodes for worker random movement
NON_EXIT_NODES = ["Entry Gate", "Assembly Line A", "Assembly Line B", "Gas Storage Zone", "Control Room"]

async def telemetry_simulator_loop(broadcast_callback=None):
    """
    Async background task, runs every 2 seconds.
    Simulates gas level, temperature, pressure, and worker movement.
    On EVACUATING state: workers move toward nearest safe exit via A* calculated path.
    """
    print("[Simulator] Telemetry loop started")
    
    while True:
        try:
            await asyncio.sleep(2.0)
            
            async with state_lock:
                current_time = time.time()
                
                # 1. Simulate Gas Level
                # Starts at 4%, drifts up when Hot Work permit active
                gas = state["gas_level"]
                has_hot_work = any(p["type"] == "Hot Work" for p in state["active_permits"])
                
                if has_hot_work:
                    # Drift upward faster when Hot Work is active
                    drift = random.uniform(0.1, 0.5)
                else:
                    # Slow drift toward baseline
                    if gas > 4.0:
                        drift = random.uniform(-0.3, -0.1)
                    else:
                        drift = random.uniform(-0.1, 0.1)
                
                new_gas = max(0.0, min(20.0, gas + drift))
                state["gas_level"] = round(new_gas, 2)
                
                # 2. Simulate Temperature
                # Fluctuates 25-45°C normally, spikes to 70°C on Cold Work permit in hot zone
                temp = state["temperature"]
                has_cold_work = any(p["type"] == "Cold Work" for p in state["active_permits"])
                
                if has_cold_work:
                    # Spike toward 70°C
                    if temp < 70.0:
                        temp_drift = random.uniform(2.0, 5.0)
                    else:
                        temp_drift = random.uniform(-1.0, 1.0)
                else:
                    # Normal fluctuation 25-45°C
                    if temp < 25.0:
                        temp_drift = random.uniform(0.5, 2.0)
                    elif temp > 45.0:
                        temp_drift = random.uniform(-2.0, -0.5)
                    else:
                        temp_drift = random.uniform(-1.0, 1.0)
                
                new_temp = max(20.0, min(75.0, temp + temp_drift))
                state["temperature"] = round(new_temp, 1)
                
                # 3. Simulate Pressure (1-3 bar, slight fluctuations)
                pressure = state.get("pressure", 1.8)
                pressure_drift = random.uniform(-0.1, 0.1)
                new_pressure = max(1.0, min(3.0, pressure + pressure_drift))
                state["pressure"] = round(new_pressure, 2)
                
                # 4. Calculate Anomaly Score
                worker_count = len(state["workers"])
                anomaly_score = detector.score(state["gas_level"], state["temperature"], state["pressure"], worker_count)
                
                # 5. Predict Lead Time
                lead_time_minutes = predictor.predict_lead_time(state["gas_level"], current_time)
                
                # 6. Evaluate Compound Risk
                triggered_rules = evaluate_compound_risk(
                    state["gas_level"],
                    state["temperature"],
                    state["active_permits"],
                    state["workers"]
                )
                state["triggered_rules"] = triggered_rules
                
                # Check if the compound hazard itself is still active in any zone (independent of worker count)
                hazard_active = False
                permit_types_by_zone = {p["zone"]: p["type"] for p in state["active_permits"]}
                for zone, permit_type in permit_types_by_zone.items():
                    if permit_type == "Hot Work" and state["gas_level"] > 12.0:
                        hazard_active = True
                    elif permit_type == "Confined Space" and state["gas_level"] > 8.0:
                        hazard_active = True
                    elif permit_type == "Cold Work" and state["temperature"] > 65.0:
                        hazard_active = True
                
                # 7. Handle State Transitions
                if triggered_rules and state["status"] == "NORMAL":
                    # Transition to EVACUATING
                    state["status"] = "EVACUATING"
                    state["hazard_node"] = "Gas Storage Zone"  # Default hazard zone
                    predictor.reset()  # Reset predictor on incident
                    
                    # Calculate evacuation paths
                    state["evacuation_paths"] = get_safe_routes(state["workers"], state["hazard_node"])
                    
                    # Update worker statuses
                    for worker_id in state["evacuation_paths"]:
                        state["workers"][worker_id]["status"] = "evacuating"
                    
                    print(f"[Simulator] EVACUATING triggered by rules: {[r['rule_id'] for r in triggered_rules]}")

                    # Write to database and create RAG audit snapshot
                    from app.models import AsyncSessionLocal, Incident
                    from app.audit import record_audit

                    async def write_incident_db_and_audit():
                        async with AsyncSessionLocal() as session:
                            try:
                                main_rule = triggered_rules[0]
                                new_incident = Incident(
                                    timestamp=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None),
                                    rule_id=main_rule["rule_id"],
                                    severity=main_rule["severity"],
                                    action=main_rule["action"],
                                    gas_level=state["gas_level"],
                                    temperature=state["temperature"],
                                    workers_affected=len(state["workers"])
                                )
                                session.add(new_incident)
                                await session.commit()
                                await session.refresh(new_incident)
                                
                                # Set in-memory active ID
                                state["active_incident_id"] = new_incident.id
                                
                                # Generate RAG audit snapshot
                                snapshot = {
                                    "incident_id": new_incident.id,
                                    "trigger_reason": main_rule["standard"],
                                    "gas_level": state["gas_level"],
                                    "temperature": state["temperature"],
                                    "pressure": state["pressure"],
                                    "active_permits": state["active_permits"],
                                    "workers": list(state["workers"].values()),
                                    "triggered_rules": triggered_rules
                                }
                                record_audit(
                                    snapshot=snapshot,
                                    rule_id=main_rule["rule_id"],
                                    anomaly_score=anomaly_score,
                                    lead_time_at_trigger=lead_time_minutes
                                )
                            except Exception as e:
                                print(f"[Simulator Database Error] Failed to write incident: {e}")
                    
                    asyncio.create_task(write_incident_db_and_audit())
                
                elif not hazard_active and state["status"] == "EVACUATING":
                    # Transition to COOLDOWN
                    state["status"] = "COOLDOWN"
                    state["cooldown_start_time"] = current_time
                    state["cooldown_seconds_remaining"] = 30
                    state["hazard_node"] = None
                    state["evacuation_paths"] = {}
                    
                    # Reset worker statuses
                    for worker in state["workers"].values():
                        worker["status"] = "normal"
                    
                    print("[Simulator] COOLDOWN started (30 seconds)")

                    # Mark incident as resolved in database
                    active_id = state.get("active_incident_id")
                    if active_id is not None:
                        from app.models import AsyncSessionLocal, Incident
                        async def mark_incident_resolved():
                            async with AsyncSessionLocal() as session:
                                try:
                                    from sqlalchemy import select
                                    res = await session.execute(select(Incident).where(Incident.id == active_id))
                                    inc = res.scalar_one_or_none()
                                    if inc:
                                        inc.resolved_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
                                        await session.commit()
                                except Exception as e:
                                    print(f"[Simulator Database Error] Failed to resolve incident: {e}")
                        asyncio.create_task(mark_incident_resolved())
                        state["active_incident_id"] = None
                
                elif state["status"] == "COOLDOWN":
                    # Update cooldown timer
                    elapsed = current_time - state["cooldown_start_time"]
                    remaining = 30 - elapsed
                    state["cooldown_seconds_remaining"] = max(0, int(remaining))
                    
                    if remaining <= 0:
                        # Transition back to NORMAL
                        state["status"] = "NORMAL"
                        state["cooldown_start_time"] = None
                        state["cooldown_seconds_remaining"] = 0
                        print("[Simulator] Returned to NORMAL state")
                
                # 8. Simulate Worker Movement
                for worker_id, worker in state["workers"].items():
                    if state["status"] == "EVACUATING":
                        # Move toward exit along evacuation path
                        if worker_id in state["evacuation_paths"]:
                            path = state["evacuation_paths"][worker_id]
                            if path:
                                next_node = path[0]
                                target_coords = NODES[next_node]
                                
                                # Simple movement: jump to next node for demo
                                worker["node"] = next_node
                                worker["x"] = target_coords["x"]
                                worker["y"] = target_coords["y"]
                                
                                # Remove visited node from path
                                state["evacuation_paths"][worker_id] = path[1:]
                    else:
                        # Random movement to adjacent non-exit nodes only (respecting corridor topology)
                        if random.random() < 0.3:  # 30% chance to move
                            current_node = worker["node"]
                            
                            # Get adjacent nodes (successors for internal nodes, predecessors for exit nodes to walk back)
                            neighbors = list(G.successors(current_node))
                            if not neighbors:
                                neighbors = list(G.predecessors(current_node))
                                
                            possible_nodes = [n for n in neighbors if n in NON_EXIT_NODES]
                            if possible_nodes:
                                new_node = random.choice(possible_nodes)
                                worker["node"] = new_node
                                worker["x"] = NODES[new_node]["x"]
                                worker["y"] = NODES[new_node]["y"]
                
                # 9. Build WebSocket Payload
                payload = {
                    "status": state["status"],
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "telemetry": {
                        "gas_level": state["gas_level"],
                        "temperature": state["temperature"],
                        "pressure": state["pressure"],
                        "anomaly_score": anomaly_score
                    },
                    "lead_time_minutes": lead_time_minutes,
                    "workers": [
                        {
                            "id": w["id"],
                            "node": w["node"],
                            "x": w["x"],
                            "y": w["y"],
                            "status": w["status"]
                        }
                        for w in state["workers"].values()
                    ],
                    "active_permits": [
                        {
                            "id": p["id"],
                            "type": p["type"],
                            "zone": p["zone"],
                            "issued_at": p["issued_at"]
                        }
                        for p in state["active_permits"]
                    ],
                    "triggered_rules": triggered_rules,
                    "evacuation_paths": state["evacuation_paths"],
                    "nodes": [
                        {
                            "id": node_id,
                            "x": attrs["x"],
                            "y": attrs["y"],
                            "status": "danger" if state["hazard_node"] == node_id else "warning" if state["status"] == "COOLDOWN" else "normal"
                        }
                        for node_id, attrs in NODES.items()
                    ],
                    "cooldown_seconds_remaining": state["cooldown_seconds_remaining"]
                }
                
                # Broadcast to WebSocket clients
                if broadcast_callback:
                    await broadcast_callback(payload)
                    
        except Exception as e:
            print(f"[Simulator Error] {e}")
