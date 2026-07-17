import asyncio
import math
import networkx as nx
from typing import Dict, List, Optional

# ==============================================================================
# NETWORKX MAP DEFINITION (Factory Layout Graph)
# ==============================================================================
G = nx.DiGraph()

NODES = {
    "Entry Gate": {"x": 80, "y": 300, "is_exit": False},
    "Assembly Line A": {"x": 240, "y": 180, "is_exit": False},
    "Assembly Line B": {"x": 240, "y": 420, "is_exit": False},
    "Gas Storage Zone": {"x": 480, "y": 300, "is_exit": False},
    "Control Room": {"x": 640, "y": 180, "is_exit": False},
    "Exit North": {"x": 720, "y": 80, "is_exit": True},
    "Exit South": {"x": 720, "y": 520, "is_exit": True}
}

for node_id, attrs in NODES.items():
    G.add_node(node_id, **attrs)

EDGES = [
    ("Entry Gate", "Assembly Line A"),
    ("Entry Gate", "Assembly Line B"),
    ("Assembly Line A", "Assembly Line B"),
    ("Assembly Line B", "Assembly Line A"),
    ("Assembly Line A", "Gas Storage Zone"),
    ("Gas Storage Zone", "Assembly Line A"),
    ("Assembly Line B", "Gas Storage Zone"),
    ("Gas Storage Zone", "Assembly Line B"),
    ("Gas Storage Zone", "Control Room"),
    ("Control Room", "Gas Storage Zone"),
    ("Gas Storage Zone", "Exit North"),
    ("Gas Storage Zone", "Exit South"),
    ("Control Room", "Exit North"),
    ("Control Room", "Exit South")
]

for u, v in EDGES:
    pos_u = (NODES[u]["x"], NODES[u]["y"])
    pos_v = (NODES[v]["x"], NODES[v]["y"])
    dist = math.sqrt((pos_u[0] - pos_v[0])**2 + (pos_u[1] - pos_v[1])**2)
    G.add_edge(u, v, weight=dist, original_weight=dist)

# ==============================================================================
# IN-MEMORY TELEMETRY STATE
# ==============================================================================
state: Dict = {
    "status": "NORMAL",
    "gas_level": 4.0,
    "temperature": 32.0,
    "pressure": 1.8,
    "workers": {
        "W1": {"id": "W1", "node": "Assembly Line A", "x": 240, "y": 180, "status": "normal"},
        "W2": {"id": "W2", "node": "Assembly Line B", "x": 240, "y": 420, "status": "normal"},
        "W3": {"id": "W3", "node": "Control Room", "x": 640, "y": 180, "status": "normal"}
    },
    "active_permits": [],
    "triggered_rules": [],
    "evacuation_paths": {},
    "hazard_node": None,
    "cooldown_seconds_remaining": 0,
    "cooldown_start_time": None,
    "active_incident_id": None
}

state_lock = asyncio.Lock()

# ==============================================================================
# A* PATHFINDING WITH DYNAMIC EDGE PENALIZATION
# ==============================================================================
def get_safe_routes(workers: Dict, hazard_node: Optional[str]) -> Dict:
    """
    Compute safe evacuation routes using A* pathfinding.
    When hazard detected, set incident node edges to weight 999999 forcing A* to route through safe corridors.
    """
    temp_graph = G.copy()
    
    if hazard_node:
        # Penalize all edges connected to the hazard node (both incoming and outgoing)
        for u, v in list(G.edges):
            if u == hazard_node or v == hazard_node:
                temp_graph[u][v]['weight'] = 999999
    
    evacuation_paths = {}
    for worker_id, worker in workers.items():
        current_node = worker["node"]
        if current_node in ["Exit North", "Exit South"]:
            continue
        
        # Find nearest exit
        exits = ["Exit North", "Exit South"]
        shortest_path = None
        shortest_dist = float('inf')
        
        for exit_node in exits:
            try:
                def heuristic(n1, n2):
                    node1 = temp_graph.nodes[n1]
                    node2 = temp_graph.nodes[n2]
                    return math.sqrt((node1['x'] - node2['x'])**2 + (node1['y'] - node2['y'])**2)
                
                path = nx.astar_path(temp_graph, current_node, exit_node, heuristic=heuristic, weight='weight')
                dist = sum(temp_graph[path[i]][path[i+1]]['weight'] for i in range(len(path)-1))
                if dist < shortest_dist:
                    shortest_dist = dist
                    shortest_path = path
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue
        
        if shortest_path:
            evacuation_paths[worker_id] = shortest_path
    
    return evacuation_paths

# ==============================================================================
# COMPOUND RISK ENGINE
# ==============================================================================
def evaluate_compound_risk(gas_level: float, temperature: float, active_permits: List[Dict], workers: Dict) -> List[Dict]:
    """
    Evaluate telemetry against three regulatory standards.
    Returns list of triggered rules with full metadata.
    """
    triggered_rules = []
    
    # Count workers in each zone
    workers_in_zone = {}
    for worker in workers.values():
        node = worker["node"]
        workers_in_zone[node] = workers_in_zone.get(node, 0) + 1
    
    # Get active permit types by zone
    permit_types_by_zone = {}
    for permit in active_permits:
        zone = permit["zone"]
        permit_types_by_zone[zone] = permit["type"]
    
    # Rule 1 — OISD-STD-137 (Explosion Risk)
    # Trigger: gas_level > 12.0% AND active Hot Work permit AND workers_in_zone > 0
    for zone, permit_type in permit_types_by_zone.items():
        if permit_type == "Hot Work":
            workers_count = workers_in_zone.get(zone, 0)
            if gas_level > 12.0 and workers_count > 0:
                triggered_rules.append({
                    "triggered": True,
                    "rule_id": "OISD-STD-137",
                    "standard": "OISD-STD-137",
                    "severity": "CRITICAL",
                    "action": "Evacuate immediately"
                })
    
    # Rule 2 — FACTORY-ACT-SEC-36 (Asphyxiation Risk)
    # Trigger: gas_level > 8.0% AND active Confined Space permit AND workers_in_zone > 2
    for zone, permit_type in permit_types_by_zone.items():
        if permit_type == "Confined Space":
            workers_count = workers_in_zone.get(zone, 0)
            if gas_level > 8.0 and workers_count > 2:
                triggered_rules.append({
                    "triggered": True,
                    "rule_id": "FACTORY-ACT-SEC-36",
                    "standard": "Factory Act Section 36",
                    "severity": "HIGH",
                    "action": "Evacuate and reduce occupancy"
                })
    
    # Rule 3 — DGMS-THERMAL-STRESS (Thermal Runaway)
    # Trigger: temperature > 65.0°C AND active Cold Work permit
    for zone, permit_type in permit_types_by_zone.items():
        if permit_type == "Cold Work":
            if temperature > 65.0:
                triggered_rules.append({
                    "triggered": True,
                    "rule_id": "DGMS-THERMAL-STRESS",
                    "standard": "DGMS Technical Circular",
                    "severity": "HIGH",
                    "action": "Cease work and cool down equipment"
                })
    
    return triggered_rules
