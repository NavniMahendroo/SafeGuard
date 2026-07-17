import { create } from 'zustand'

export const useStore = create((set, get) => {
  let ws = null
  let reconnectTimeout = null

  return {
    // WebSocket connection
    connected: false,
    apiHost: '127.0.0.1:8000',
    
    // Telemetry state
    status: 'NORMAL',
    timestamp: null,
    telemetry: {
      gas_level: 4.0,
      temperature: 32.0,
      pressure: 1.8,
      anomaly_score: 0.0
    },
    lead_time_minutes: null,
    
    // Workers and permits
    workers: [
      { id: 'W1', node: 'Assembly Line A', x: 240, y: 180, status: 'normal' },
      { id: 'W2', node: 'Assembly Line B', x: 240, y: 420, status: 'normal' },
      { id: 'W3', node: 'Control Room', x: 640, y: 180, status: 'normal' }
    ],
    active_permits: [],
    triggered_rules: [],
    evacuation_paths: {},
    nodes: [],
    cooldown_seconds_remaining: 0,

    // WebSocket connection with auto-reconnect and host fallback rotation
    connect: () => {
      if (ws) return

      let connectionAttempt = 0
      const hosts = ['127.0.0.1:8000', 'localhost:8000']
      
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : ''
      if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        hosts.push(`${currentHost}:8000`)
      }

      const connectWS = () => {
        const host = hosts[connectionAttempt % hosts.length]
        console.log(`[Store] Connecting to WebSocket at ws://${host}/ws...`)
        ws = new WebSocket(`ws://${host}/ws`)
        
        ws.onopen = () => {
          console.log(`[Store] WebSocket connected to ${host}`)
          set({ connected: true, apiHost: host })
        }
        
        ws.onclose = () => {
          console.log(`[Store] WebSocket disconnected from ${host}, retrying in 3s...`)
          set({ connected: false })
          ws = null
          connectionAttempt++
          reconnectTimeout = setTimeout(connectWS, 3000)
        }
        
        ws.onerror = (error) => {
          console.error(`[Store] WebSocket error on ${host}:`, error)
        }
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            set({
              status: data.status,
              timestamp: data.timestamp,
              telemetry: data.telemetry,
              lead_time_minutes: data.lead_time_minutes,
              workers: data.workers,
              active_permits: data.active_permits,
              triggered_rules: data.triggered_rules,
              evacuation_paths: data.evacuation_paths,
              nodes: data.nodes,
              cooldown_seconds_remaining: data.cooldown_seconds_remaining,
            })
          } catch (error) {
            console.error('[Store] Parse error:', error)
          }
        }
      }

      connectWS()
    },

    disconnect: () => {
      if (ws) {
        ws.close()
        ws = null
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
      set({ connected: false })
    },

    // Permit management
    issuePermit: async (type, zone) => {
      try {
        const apiHost = get().apiHost || '127.0.0.1:8000'
        const response = await fetch(`http://${apiHost}/api/permits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, zone })
        })
        if (!response.ok) throw new Error('Failed to issue permit')
        return await response.json()
      } catch (error) {
        console.error('[Permit] Issue error:', error)
        throw error
      }
    },

    revokePermit: async (permitId) => {
      try {
        const apiHost = get().apiHost || '127.0.0.1:8000'
        const response = await fetch(`http://${apiHost}/api/permits/${permitId}`, {
          method: 'DELETE'
        })
        if (!response.ok) throw new Error('Failed to revoke permit')
        return await response.json()
      } catch (error) {
        console.error('[Permit] Revoke error:', error)
        throw error
      }
    },

    resolveIncident: async () => {
      try {
        const apiHost = get().apiHost || '127.0.0.1:8000'
        const response = await fetch(`http://${apiHost}/api/resolve`, {
          method: 'POST'
        })
        if (!response.ok) throw new Error('Failed to resolve incident')
        return await response.json()
      } catch (error) {
        console.error('[Incident] Resolve error:', error)
        throw error
      }
    },
  }
})
