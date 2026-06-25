import { create } from 'zustand';

export const useSafetyStore = create((set, get) => {
  let ws = null;
  let reconnectTimeout = null;

  return {
    // Connection State
    connected: false,
    error: null,

    // Telemetry State
    timestamp: null,
    criticalAlert: false,
    gasLevel: 4.5,
    activePermits: [],
    workers: [],
    graph: { nodes: [], edges: [] },

    // REST DB Logs
    permitHistory: [],
    incidentHistory: [],

    // Initialize Connection & Fetch Initial REST Data
    connect: () => {
      if (ws) return;

      const connectWS = () => {
        console.log('[SafeGuard Store] Connecting to WebSocket...');
        ws = new WebSocket('ws://localhost:8000/ws/telemetry');

        ws.onopen = () => {
          console.log('[SafeGuard Store] WebSocket connected.');
          set({ connected: true, error: null });
          // Fetch initial historical logs when connected
          get().fetchPermits();
          get().fetchIncidents();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Only update Zustand state if values actually changed to prevent infinite React renders
            const currentState = get();
            const updates = {};
            
            if (data.timestamp !== currentState.timestamp) updates.timestamp = data.timestamp;
            if (data.critical_alert !== currentState.criticalAlert) updates.criticalAlert = data.critical_alert;
            if (data.gas_level !== currentState.gasLevel) updates.gasLevel = data.gas_level;
            
            // Shallow equal comparisons for arrays/objects to prevent re-renders
            if (JSON.stringify(data.active_permits) !== JSON.stringify(currentState.activePermits)) {
              updates.activePermits = data.active_permits;
            }
            if (JSON.stringify(data.workers) !== JSON.stringify(currentState.workers)) {
              updates.workers = data.workers;
            }
            if (data.graph && JSON.stringify(data.graph) !== JSON.stringify(currentState.graph)) {
              updates.graph = data.graph;
            }

            if (Object.keys(updates).length > 0) {
              set(updates);
            }
          } catch (err) {
            console.error('[SafeGuard Store] Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (err) => {
          console.error('[SafeGuard Store] WebSocket error:', err);
          set({ error: 'Connection error' });
        };

        ws.onclose = () => {
          console.log('[SafeGuard Store] WebSocket disconnected. Attempting reconnect in 3s...');
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

    // REST API - Permits
    fetchPermits: async () => {
      try {
        const res = await fetch('http://localhost:8000/api/permits');
        if (res.ok) {
          const data = await res.json();
          set({ permitHistory: data });
        }
      } catch (err) {
        console.error('[SafeGuard Store] Failed to fetch permits:', err);
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
          // Re-fetch permits history and trigger local status updates
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
          // Re-fetch permits history
          await get().fetchPermits();
        }
      } catch (err) {
        console.error('[SafeGuard Store] Failed to close permit:', err);
      }
    },

    // REST API - Incidents
    fetchIncidents: async () => {
      try {
        const res = await fetch('http://localhost:8000/api/incidents');
        if (res.ok) {
          const data = await res.json();
          set({ incidentHistory: data });
        }
      } catch (err) {
        console.error('[SafeGuard Store] Failed to fetch incidents:', err);
      }
    }
  };
});
