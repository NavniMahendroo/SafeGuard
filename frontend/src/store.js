import { create } from 'zustand'

// Helper to resolve HTTP protocol dynamically based on client protocol (handles mixed-content HTTPS restrictions on Vercel)
const getHttpUrl = (apiHost, path) => {
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const protocol = isSecure ? 'https' : 'http'
  return `${protocol}://${apiHost}${path}`
}

export const useStore = create((set, get) => {
  let ws = null
  let reconnectTimeout = null
  let reconnectDelay = 1000

  return {
    // WebSocket connection
    connected: false,
    wsStatus: 'disconnected', // 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
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
    incidents: [], // Shared incidents registry

    // WebSocket connection with auto-reconnect and host fallback rotation
    connect: () => {
      if (ws) return

      let connectionAttempt = 0
      const hosts = []
      
      // 1. Inject production API Host if VITE_API_HOST env variable is set in Vercel
      const productionHost = import.meta.env.VITE_API_HOST
      if (productionHost) {
        const cleanHost = productionHost.replace(/^(https?:\/\/|wss?:\/\/)/, '')
        hosts.push(cleanHost)
      }
      
      // 2. Add local fallback options
      hosts.push('127.0.0.1:8000')
      hosts.push('localhost:8000')
      
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : ''
      if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        hosts.push(`${currentHost}:8000`)
      }

      set({ wsStatus: 'connecting' })

      const connectWS = () => {
        const host = hosts[connectionAttempt % hosts.length]
        
        // Dynamic WebSocket protocol resolving (WSS for HTTPS production environments)
        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
        const protocol = isSecure ? 'wss' : 'ws'
        
        console.log(`[Store] Connecting to WebSocket at ${protocol}://${host}/ws...`)
        ws = new WebSocket(`${protocol}://${host}/ws`)
        
        ws.onopen = () => {
          console.log(`[Store] WebSocket connected to ${host}`)
          set({ connected: true, apiHost: host, wsStatus: 'connected' })
          reconnectDelay = 1000 // Reset backoff delay
          
          // Immediately re-fetch current state on reconnect
          get().fetchActivePermits()
          get().fetchIncidents()
        }
        
        ws.onclose = () => {
          console.log(`[Store] WebSocket disconnected from ${host}, retrying in ${reconnectDelay}ms...`)
          set({ connected: false, wsStatus: 'reconnecting' })
          ws = null
          connectionAttempt++
          reconnectTimeout = setTimeout(connectWS, reconnectDelay)
          // Exponential backoff capped at 15s
          reconnectDelay = Math.min(reconnectDelay * 2, 15000)
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
      reconnectDelay = 1000
      set({ connected: false, wsStatus: 'disconnected' })
    },

    // Fetch active permits list
    fetchActivePermits: async () => {
      try {
        const apiHost = get().apiHost || '127.0.0.1:8000'
        const response = await fetch(getHttpUrl(apiHost, '/api/permits'))
        if (response.ok) {
          const data = await response.json()
          set({ active_permits: data })
        }
      } catch (error) {
        console.error('[Permits] Fetch error:', error)
      }
    },

    // Fetch incident logs
    fetchIncidents: async () => {
      try {
        const apiHost = get().apiHost || '127.0.0.1:8000'
        const response = await fetch(getHttpUrl(apiHost, '/api/incidents'))
        if (response.ok) {
          const data = await response.json()
          set({ incidents: data })
        }
      } catch (error) {
        console.error('[Incidents] Fetch error:', error)
      }
    },

    // Permit management
    issuePermit: async (type, zone) => {
      try {
        const apiHost = get().apiHost || '127.0.0.1:8000'
        const response = await fetch(getHttpUrl(apiHost, '/api/permits'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, zone })
        })
        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.detail || 'Failed to issue permit')
        }
        const data = await response.json()
        get().fetchActivePermits()
        return data
      } catch (error) {
        console.error('[Permit] Issue error:', error)
        throw error
      }
    },

    revokePermit: async (permitId) => {
      try {
        const apiHost = get().apiHost || '127.0.0.1:8000'
        const response = await fetch(getHttpUrl(apiHost, `/api/permits/${permitId}`), {
          method: 'DELETE'
        })
        if (!response.ok) throw new Error('Failed to revoke permit')
        const data = await response.json()
        get().fetchActivePermits()
        return data
      } catch (error) {
        console.error('[Permit] Revoke error:', error)
        throw error
      }
    },

    resolveIncident: async () => {
      try {
        const apiHost = get().apiHost || '127.0.0.1:8000'
        const response = await fetch(getHttpUrl(apiHost, '/api/resolve'), {
          method: 'POST'
        })
        if (!response.ok) throw new Error('Failed to resolve incident')
        const data = await response.json()
        get().fetchIncidents()
        return data
      } catch (error) {
        console.error('[Incident] Resolve error:', error)
        throw error
      }
    },

    // One-click full reset
    resetDemo: async () => {
      try {
        const apiHost = get().apiHost || '127.0.0.1:8000'
        const response = await fetch(getHttpUrl(apiHost, '/api/reset'), {
          method: 'POST'
        })
        if (!response.ok) throw new Error('Failed to reset demo')
        const data = await response.json()
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
        get().fetchIncidents()
        return data
      } catch (error) {
        console.error('[Demo Reset] Error:', error)
        throw error
      }
    }
  }
})
