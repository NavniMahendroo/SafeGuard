import { create } from 'zustand';

export const useSafetyStore = create((set, get) => {
  let ws = null;
  let reconnectTimeout = null;

  return {
    // Connection State
    connected: false,
    error: null,

    // Telemetry State (Mapped to requested variables)
    timestamp: null,
    systemStatus: "NORMAL", // "NORMAL", "WARNING", "EVACUATING"
    gasLevel: 4.5,
    activePermits: [],
    workers: [],
    safeRoute: [], // Array of node IDs for A* pathing (representative path during evac)
    graph: { nodes: [], edges: [] },

    // Database Logs (REST)
    permitHistory: [],
    incidentHistory: [],

    // Initialize Connection & Fetch Logs
    connect: () => {
      if (ws) return;

      const connectWS = () => {
        console.log('[SafeGuard Store] Connecting to WebSocket...');
        ws = new WebSocket('ws://localhost:8000/ws/telemetry');

        ws.onopen = () => {
          console.log('[SafeGuard Store] WebSocket connected.');
          set({ connected: true, error: null });
          get().fetchPermits();
          get().fetchIncidents();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const currentState = get();
            const updates = {};

            // 1. Map systemStatus based on gas level and critical alert
            let newStatus = "NORMAL";
            if (data.critical_alert) {
              newStatus = "EVACUATING";
            } else if (data.gas_level >= 6.0) {
              newStatus = "WARNING";
            }

            if (newStatus !== currentState.systemStatus) updates.systemStatus = newStatus;
            if (data.timestamp !== currentState.timestamp) updates.timestamp = data.timestamp;
            if (data.gas_level !== currentState.gasLevel) updates.gasLevel = data.gas_level;

            // 2. Map workers coords [x, y] to .x and .y for easier SVG rendering
            const mappedWorkers = (data.workers || []).map(w => ({
              ...w,
              x: w.coords ? w.coords[0] : 0,
              y: w.coords ? w.coords[1] : 0
            }));

            if (JSON.stringify(mappedWorkers) !== JSON.stringify(currentState.workers)) {
              updates.workers = mappedWorkers;
            }

            // 3. Extract a representative A* safeRoute if evacuating
            // We use the path of the first actively evacuated worker as the primary display route
            let activeEvacRoute = [];
            if (newStatus === "EVACUATING") {
              const movingWorker = mappedWorkers.find(w => w.path && w.path.length > 0 && w.status !== 'Evacuated');
              if (movingWorker) {
                // Prepend current node to show the full route starting point
                activeEvacRoute = [movingWorker.current_node, ...movingWorker.path];
              } else {
                // Fallback exit route bypassing node 4 (Gas storage)
                // e.g., 2 -> 3 -> 5 -> 6
                activeEvacRoute = [2, 3, 5, 6];
              }
            }
            if (JSON.stringify(activeEvacRoute) !== JSON.stringify(currentState.safeRoute)) {
              updates.safeRoute = activeEvacRoute;
            }

            // 4. Base payload arrays
            if (JSON.stringify(data.active_permits) !== JSON.stringify(currentState.activePermits)) {
              updates.activePermits = data.active_permits;
            }
            if (data.graph && JSON.stringify(data.graph) !== JSON.stringify(currentState.graph)) {
              updates.graph = data.graph;
            }

            if (Object.keys(updates).length > 0) {
              set(updates);
            }
          } catch (err) {
            console.error('[SafeGuard Store] WebSocket message error:', err);
          }
        };

        ws.onerror = (err) => {
          console.error('[SafeGuard Store] WebSocket error:', err);
          set({ error: 'Connection error' });
        };

        ws.onclose = () => {
          console.log('[SafeGuard Store] WebSocket disconnected. Reconnecting in 3s...');
          set({ connected: false });
          ws = null;
          reconnectTimeout = setTimeout(connectWS, 3000);
        };
      };

      connectWS();
    },

    disconnect: () => {
      if (ws) {
        ws.close();
        ws = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      set({ connected: false });
    },

    // REST - Permits
    fetchPermits: async () => {
      try {
        const res = await fetch('http://localhost:8000/api/permits');
        if (res.ok) {
          const data = await res.json();
          set({ permitHistory: data });
        }
      } catch (err) {
        console.error('[SafeGuard Store] Failed to fetch permits history:', err);
      }
    },

    createPermit: async (zoneId, zoneName, permitType) => {
      try {
        const res = await fetch('http://localhost:8000/api/permits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zone_id: zoneId, zone_name: zoneName, permit_type: permitType })
        });
        if (res.ok) {
          await get().fetchPermits();
        }
      } catch (err) {
        console.error('[SafeGuard Store] Failed to create permit:', err);
      }
    },

    closePermit: async (permitId) => {
      try {
        const res = await fetch(`http://localhost:8000/api/permits/${permitId}/close`, {
          method: 'POST'
        });
        if (res.ok) {
          await get().fetchPermits();
        }
      } catch (err) {
        console.error('[SafeGuard Store] Failed to close permit:', err);
      }
    },

    // REST - Incidents
    fetchIncidents: async () => {
      try {
        const res = await fetch('http://localhost:8000/api/incidents');
        if (res.ok) {
          const data = await res.json();
          set({ incidentHistory: data });
        }
      } catch (err) {
        console.error('[SafeGuard Store] Failed to fetch incidents history:', err);
      }
    }
  };
});
