import os
import json
import datetime
from typing import Dict, List, Optional
from app.rag import rag

def record_audit(snapshot: Dict, rule_id: str, anomaly_score: float, lead_time_at_trigger: Optional[float]):
    """
    Flight data recorder - writes full state snapshot to /audits/{timestamp}.json
    Includes: telemetry, workers, permits, triggered_rules, rag_context (retrieved regulations),
              anomaly_score, lead_time_at_trigger
    """
    # Retrieve RAG context for the incident
    incident_description = f"Incident triggered by {rule_id} with gas level {snapshot.get('gas_level')}% and temperature {snapshot.get('temperature')}°C"
    rag_context = rag.retrieve(incident_description, top_k=2)
    
    # Build complete audit snapshot
    audit_snapshot = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "incident_id": snapshot.get("incident_id"),
        "trigger_reason": snapshot.get("trigger_reason"),
        "gas_level": snapshot.get("gas_level"),
        "temperature": snapshot.get("temperature"),
        "pressure": snapshot.get("pressure"),
        "active_permits": snapshot.get("active_permits", []),
        "workers": snapshot.get("workers", []),
        "triggered_rules": snapshot.get("triggered_rules", []),
        "rag_context": rag_context,
        "anomaly_score": anomaly_score,
        "lead_time_at_trigger": lead_time_at_trigger
    }
    
    # Ensure audits directory exists
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    audits_dir = os.path.join(root_dir, "audits")
    os.makedirs(audits_dir, exist_ok=True)
    
    # Write snapshot to file
    incident_id = snapshot.get("incident_id", "unknown")
    timestamp_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"audit_incident_{incident_id}_{timestamp_str}.json"
    filepath = os.path.join(audits_dir, filename)
    
    try:
        with open(filepath, "w") as f:
            json.dump(audit_snapshot, f, indent=2)
        print(f"[Flight Data Recorder] Audit snapshot written: {filepath}")
    except Exception as e:
        print(f"[Flight Data Recorder Error] Failed to write audit: {e}")
