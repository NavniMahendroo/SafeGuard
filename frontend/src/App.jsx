import React, { useEffect, useState } from 'react';
import { useSafetyStore } from './store';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Users, 
  FileText, 
  Plus, 
  CheckCircle, 
  Flame, 
  Zap, 
  LogOut,
  Radio,
  Clock,
  MapPin,
  RefreshCw
} from 'lucide-react';

function App() {
  const {
    connected,
    error,
    timestamp,
    criticalAlert,
    gasLevel,
    activePermits,
    workers,
    graph,
    permitHistory,
    incidentHistory,
    connect,
    disconnect,
    createPermit,
    closePermit,
    fetchPermits,
    fetchIncidents
  } = useSafetyStore();

  // Local state for permit creation form
  const [selectedZone, setSelectedZone] = useState('');
  const [permitType, setPermitType] = useState('Hot Work');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Connect to WebSocket and load initial logs on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Handle manual refresh of database logs
  const handleRefreshLogs = () => {
    fetchPermits();
    fetchIncidents();
  };

  // Handle permit submission
  const handleCreatePermit = async (e) => {
    e.preventDefault();
    if (!selectedZone) return;
    
    setIsSubmitting(true);
    const zoneId = parseInt(selectedZone, 10);
    const zoneName = graph.nodes.find(n => n.id === zoneId)?.name || `Zone ${zoneId}`;
    
    await createPermit(zoneId, zoneName, permitType);
    setSelectedZone('');
    setIsSubmitting(false);
  };

  // Helper: Count worker states
  const totalWorkersCount = workers.length;
  const evacuatedCount = workers.filter(w => w.status === 'Evacuated').length;
  const activeCount = totalWorkersCount - evacuatedCount;

  // Determine Gas Level indicator colors
  const getGasColorClass = (val) => {
    if (val < 6.0) return 'text-emerald-400';
    if (val < 12.0) return 'text-amber-400';
    return 'text-rose-500 animate-pulse';
  };

  const getGasBgClass = (val) => {
    if (val < 6.0) return 'bg-emerald-500/10 border-emerald-500/20';
    if (val < 12.0) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-rose-500/20 border-rose-500/30 animate-pulse';
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* 1. TOP STATUS BAR / HEADER */}
      <header className="border-b border-slate-800 bg-[#0c101d]/90 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 rounded-lg border border-blue-500/30">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-slate-50 uppercase flex items-center gap-2">
              SafeGuard <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 tracking-normal uppercase">Command Center</span>
            </h1>
            <p className="text-xs text-slate-400">Event-Driven Industrial Safety Platform • v1.0.0</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Live Metrics */}
          <div className="flex items-center gap-6 bg-slate-900/60 px-4 py-2 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Workers:</span>
              <span className="text-sm font-semibold text-slate-200">
                {activeCount} active / {evacuatedCount} evacuated
              </span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-slate-400">Gas Level:</span>
              <span className={`text-sm font-bold ${getGasColorClass(gasLevel)}`}>
                {gasLevel.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            connected 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'}`} />
            {connected ? 'SYSTEM ONLINE' : 'CONNECTION OFFLINE'}
          </div>
        </div>
      </header>

      {/* 2. MAIN LAYOUT GRID */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT & CENTER PANEL: Map Visualization */}
        <section className="lg:col-span-2 flex flex-col gap-4">
          
          {/* MAP CONTAINER CARD */}
          <div className="flex-1 bg-[#0c101d] rounded-xl border border-slate-800 p-5 flex flex-col relative overflow-hidden">
            
            {/* Map Header info */}
            <div className="flex justify-between items-center mb-4 z-10">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Live Floor Layout Schematic</h2>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                SCALE: 1000x1000px • AUTO-FIT
              </div>
            </div>

            {/* SVG MAP WRAPPER */}
            <div className="flex-1 bg-[#090c15] rounded-lg border border-slate-900 flex items-center justify-center relative min-h-[450px]">
              
              {/* Technical Grid background overlay */}
              <div className="absolute inset-0 opacity-5 pointer-events-none" 
                   style={{ 
                     backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)', 
                     backgroundSize: '24px 24px' 
                   }} 
              />

              {graph.nodes.length > 0 ? (
                <svg 
                  viewBox="0 0 1000 1000" 
                  className="w-full h-full max-h-[600px] p-8 select-none"
                >
                  <defs>
                    {/* Shadow & Glow filters */}
                    <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="10" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="glow-rose" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="12" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="8" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* DRAW EDGES (Factory Corridors) */}
                  {graph.edges.map((edge, idx) => {
                    const fromNode = graph.nodes.find(n => n.id === edge.source);
                    const toNode = graph.nodes.find(n => n.id === edge.target);
                    if (!fromNode || !toNode) return null;

                    // Determine if the edge connects to Node 4 (Gas Storage Hazard)
                    const isHazardConnect = fromNode.id === 4 || toNode.id === 4;
                    const isEvacuationCorridor = criticalAlert && !isHazardConnect;

                    return (
                      <g key={`edge-${idx}`}>
                        {/* Glow underlay for evacuation paths */}
                        {isEvacuationCorridor && (
                          <line
                            x1={fromNode.x}
                            y1={fromNode.y}
                            x2={toNode.x}
                            y2={toNode.y}
                            stroke="#10b981"
                            strokeWidth="10"
                            strokeLinecap="round"
                            opacity="0.25"
                            filter="url(#glow-emerald)"
                          />
                        )}
                        {/* Base Corridor Line */}
                        <line
                          x1={fromNode.x}
                          y1={fromNode.y}
                          x2={toNode.x}
                          y2={toNode.y}
                          stroke={
                            criticalAlert 
                              ? (isHazardConnect ? '#f43f5e' : '#10b981') 
                              : '#334155'
                          }
                          strokeWidth={isEvacuationCorridor || (criticalAlert && isHazardConnect) ? '4' : '2'}
                          strokeDasharray={isHazardConnect && criticalAlert ? '6 4' : 'none'}
                          strokeLinecap="round"
                          opacity={criticalAlert ? (isHazardConnect ? '0.9' : '0.8') : '0.4'}
                        />
                      </g>
                    );
                  })}

                  {/* DRAW ACTIVE WORKER EVACUATION ROUTES */}
                  {workers.map((worker) => {
                    if (worker.status === 'Evacuated' || !worker.path || worker.path.length === 0) return null;
                    
                    // We draw a path from worker's current coordinates to their destinations
                    // Let's connect their path nodes with a custom polyline
                    const pathCoords = [];
                    // Start from current animated coordinates
                    pathCoords.push(`${worker.coords[0]},${worker.coords[1]}`);
                    
                    worker.path.forEach(nodeId => {
                      const node = graph.nodes.find(n => n.id === nodeId);
                      if (node) {
                        pathCoords.push(`${node.x},${node.y}`);
                      }
                    });

                    if (pathCoords.length < 2) return null;

                    return (
                      <polyline
                        key={`worker-route-${worker.id}`}
                        points={pathCoords.join(' ')}
                        fill="none"
                        stroke={worker.color || '#3b82f6'}
                        strokeWidth="3"
                        strokeDasharray="5 5"
                        opacity="0.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}

                  {/* DRAW ZONES (Nodes) */}
                  {graph.nodes.map((node) => {
                    const hasPermit = activePermits.some(p => p.zone_id === node.id);
                    
                    // Dynamic coloring for Node 4 (Gas Sensor)
                    let statusColor = 'stroke-slate-750 fill-slate-900/90';
                    let ringColor = 'stroke-slate-700';
                    let glowFilter = '';

                    if (node.id === 4) {
                      if (gasLevel < 6.0) {
                        statusColor = 'stroke-emerald-500 fill-emerald-950/90';
                        ringColor = 'stroke-emerald-500/40';
                      } else if (gasLevel < 12.0) {
                        statusColor = 'stroke-amber-500 fill-amber-950/90';
                        ringColor = 'stroke-amber-500/50';
                      } else {
                        statusColor = 'stroke-rose-500 fill-rose-950/90';
                        ringColor = 'stroke-rose-500/60';
                        glowFilter = 'url(#glow-rose)';
                      }
                    } else if (node.is_exit) {
                      statusColor = 'stroke-blue-500 fill-blue-950/80';
                      ringColor = 'stroke-blue-500/30';
                    } else if (hasPermit) {
                      statusColor = 'stroke-amber-500/80 fill-slate-900/90';
                      ringColor = 'stroke-amber-500/30';
                    }

                    return (
                      <g key={`node-${node.id}`} className="cursor-pointer group">
                        {/* Pulsing indicator ring for active incidents/alerts */}
                        {((node.id === 4 && gasLevel >= 12.0) || (criticalAlert && !node.is_exit)) && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r="50"
                            fill="none"
                            className="animate-pulse"
                            stroke={node.id === 4 ? '#f43f5e' : '#10b981'}
                            strokeWidth="1.5"
                            opacity="0.4"
                          />
                        )}

                        {/* Outer Ring */}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="36"
                          fill="none"
                          className={`transition-all duration-300 ${ringColor}`}
                          strokeWidth="2.5"
                        />

                        {/* Main Node Bubble */}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="28"
                          className={`transition-all duration-355 ${statusColor}`}
                          strokeWidth="2"
                          filter={glowFilter}
                        />

                        {/* Label Badge underneath node */}
                        <g transform={`translate(${node.x}, ${node.y + 54})`}>
                          {/* Background rect for text readability */}
                          <rect
                            x="-85"
                            y="-14"
                            width="170"
                            height="30"
                            rx="6"
                            fill="#0d111d"
                            stroke="#1e293b"
                            strokeWidth="1"
                            opacity="0.85"
                          />
                          <text
                            textAnchor="middle"
                            fill="#cbd5e1"
                            fontSize="11"
                            fontWeight="700"
                            fontFamily="monospace"
                            letterSpacing="0.5"
                          >
                            {node.name}
                          </text>
                          {node.id === 4 && (
                            <text
                              y="11"
                              textAnchor="middle"
                              className={`text-[9px] font-bold ${getGasColorClass(gasLevel)}`}
                              fontFamily="monospace"
                            >
                              GAS: {gasLevel.toFixed(1)}%
                            </text>
                          )}
                          {node.is_exit && !node.id === 4 && (
                            <text
                              y="11"
                              textAnchor="middle"
                              fill="#60a5fa"
                              className="text-[9px] font-semibold"
                            >
                              EMERGENCY EXIT
                            </text>
                          )}
                          {hasPermit && node.id !== 4 && (
                            <text
                              y="11"
                              textAnchor="middle"
                              fill="#fbbf24"
                              className="text-[9px] font-bold uppercase tracking-wider"
                            >
                              ⚠️ PERMIT: HOT WORK
                            </text>
                          )}
                        </g>

                        {/* Node Number inside Bubble */}
                        <text
                          x={node.x}
                          y={node.y + 4}
                          textAnchor="middle"
                          fill={node.is_exit ? '#60a5fa' : '#f8fafc'}
                          fontSize="13"
                          fontWeight="800"
                          fontFamily="monospace"
                        >
                          {node.id}
                        </text>
                      </g>
                    );
                  })}

                  {/* DRAW WORKERS */}
                  {workers.map((worker) => {
                    if (worker.status === 'Evacuated') return null;

                    return (
                      <g 
                        key={`worker-${worker.id}`}
                        className="transition-all duration-1000 ease-linear"
                      >
                        {/* Glow Behind Worker */}
                        <circle
                          cx={worker.coords[0]}
                          cy={worker.coords[1]}
                          r="18"
                          fill={worker.color || '#3b82f6'}
                          opacity="0.15"
                          className="animate-ping"
                          style={{ animationDuration: '3s' }}
                        />

                        {/* Worker Outer Rim */}
                        <circle
                          cx={worker.coords[0]}
                          cy={worker.coords[1]}
                          r="10"
                          fill="#090c15"
                          stroke={worker.color || '#3b82f6'}
                          strokeWidth="2.5"
                          style={{ transition: 'cx 1.0s linear, cy 1.0s linear' }}
                        />

                        {/* Worker Core Dot */}
                        <circle
                          cx={worker.coords[0]}
                          cy={worker.coords[1]}
                          r="5"
                          fill={worker.color || '#3b82f6'}
                          className={worker.status === 'Rerouting' ? 'animate-pulse' : ''}
                          style={{ transition: 'cx 1.0s linear, cy 1.0s linear' }}
                        />

                        {/* Floating ID Tag */}
                        <g 
                          transform={`translate(${worker.coords[0]}, ${worker.coords[1] - 16})`}
                          style={{ transition: 'transform 1.0s linear' }}
                        >
                          <rect
                            x="-22"
                            y="-9"
                            width="44"
                            height="15"
                            rx="3"
                            fill="#0d111d"
                            stroke={worker.status === 'Rerouting' ? '#f43f5e' : '#475569'}
                            strokeWidth="1"
                            opacity="0.9"
                          />
                          <text
                            textAnchor="middle"
                            fill={worker.status === 'Rerouting' ? '#f43f5e' : '#e2e8f0'}
                            fontSize="8"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {worker.id}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                  <p className="text-sm">Awaiting Map Structure from Backend...</p>
                </div>
              )}
            </div>

            {/* Map Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-805 text-xs text-slate-400 mt-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border border-blue-500 bg-blue-950/60" />
                <span>Exits (1 & 6)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border border-amber-500 bg-amber-950/20" />
                <span>Active Permits (Hot Work)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" />
                <span>Standard Safe Path</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-dashed border-rose-500 inline-block" />
                <span>Hazard Evacuation Zone</span>
              </div>
            </div>

          </div>

          {/* LOWER SECTION: SYSTEM INCIDENTS TIMELINE */}
          <div className="bg-[#0c101d] rounded-xl border border-slate-800 p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-350">Incident & Audit Logs</h3>
              </div>
              <button 
                onClick={handleRefreshLogs}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Logs
              </button>
            </div>

            <div className="overflow-x-auto max-h-[180px] overflow-y-auto">
              {incidentHistory.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No active safety violations or historical incidents logged.</p>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono">
                      <th className="py-2">Incident ID</th>
                      <th className="py-2">Timestamp</th>
                      <th className="py-2">Trigger Violation Description</th>
                      <th className="py-2">Peak Gas</th>
                      <th className="py-2">Target Workers</th>
                      <th className="py-2 text-right">Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300 font-mono">
                    {incidentHistory.map((inc) => (
                      <tr key={`inc-${inc.id}`} className="hover:bg-slate-900/40">
                        <td className="py-2 font-bold text-rose-450">INC-{inc.id}</td>
                        <td className="py-2 text-slate-450">
                          {new Date(inc.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 max-w-[200px] truncate" title={inc.trigger_reason}>
                          {inc.trigger_reason}
                        </td>
                        <td className="py-2 font-semibold text-rose-400">{inc.gas_level.toFixed(2)}%</td>
                        <td className="py-2 text-slate-400">{inc.affected_workers}</td>
                        <td className="py-2 text-right">
                          {inc.resolved_at ? (
                            <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60 font-sans text-[10px]">
                              RESOLVED
                            </span>
                          ) : (
                            <span className="text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-900 animate-pulse font-sans text-[10px]">
                              EVACUATING
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </section>

        {/* RIGHT PANEL: Live Permits, Alerts & Controls */}
        <section className="flex flex-col gap-6">

          {/* 3. ALERT BANNER PANEL */}
          {criticalAlert ? (
            <div className="bg-rose-950/80 border-2 border-rose-600 rounded-xl p-5 shadow-lg shadow-rose-950/20 text-rose-200 animate-pulse flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600 rounded-full text-slate-900">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-wider uppercase text-rose-50">CRITICAL SAFETY ALERT</h3>
                  <p className="text-xs text-rose-300 font-semibold">COMPOUND HAZARD RISK TRIGGERED</p>
                </div>
              </div>
              
              <div className="bg-rose-900/30 p-3 rounded border border-rose-800/40 text-xs leading-relaxed font-mono">
                <strong>TRIGGER REASON:</strong> Gas leakage level exceeded safety limit ({gasLevel.toFixed(2)}% &gt; 12.0%) inside node <strong>Gas Storage Zone</strong> while an active <strong>Hot Work Permit</strong> was issued on the floor.
              </div>

              <div className="flex justify-between items-center bg-rose-500/10 p-2 rounded text-xs border border-rose-500/20 font-bold uppercase tracking-wider text-rose-300">
                <span>REROUTING PROTOCOL:</span>
                <span className="animate-ping bg-rose-400 rounded-full h-2 w-2" />
                <span>EVACUATE ZONES</span>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-5 text-emerald-300 flex items-center gap-4">
              <div className="p-2.5 bg-emerald-600/10 rounded-full border border-emerald-500/30 text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-200">System Operating Normal</h3>
                <p className="text-xs text-slate-400 mt-0.5">Continuous safety telemetry monitoring is active. No hazards detected.</p>
              </div>
            </div>
          )}

          {/* 4. PERMIT CONTROL CENTRE */}
          <div className="bg-[#0c101d] rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Work Permit Controller
              </h3>
              <p className="text-xs text-slate-400 mt-1">Issue and manage industrial permits to dynamically calculate floor route hazards.</p>
            </div>

            {/* List Active Permits */}
            <div className="flex flex-col gap-3.5">
              <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-1">Active Permits</h4>
              
              {activePermits.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center bg-slate-900/30 rounded border border-slate-900 border-dashed">
                  No active high-risk permits issued.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {activePermits.map((permit) => {
                    // Match corresponding permit history log ID to close if needed
                    const matchingHistoryItem = permitHistory.find(
                      h => h.zone_id === permit.zone_id && h.status === 'Active'
                    );

                    return (
                      <div 
                        key={`permit-${permit.zone_id}`}
                        className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex justify-between items-center gap-3 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Flame className="w-4 h-4 text-amber-500" />
                          <div>
                            <p className="text-xs font-bold text-slate-200">{permit.permit_type}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-500" /> {permit.zone_name} (Zone {permit.zone_id})
                            </p>
                          </div>
                        </div>
                        
                        {matchingHistoryItem && (
                          <button
                            onClick={() => closePermit(matchingHistoryItem.id)}
                            className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded hover:bg-rose-500 hover:text-white transition"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Issue New Permit Form */}
            <form onSubmit={handleCreatePermit} className="flex flex-col gap-3.5 border-t border-slate-800 pt-4 mt-2">
              <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500 pb-1">Issue New Permit</h4>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Target Facility Zone</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-300"
                  required
                >
                  <option value="" disabled>Select Zone...</option>
                  {graph.nodes
                    .filter(node => !node.is_exit)
                    .map(node => (
                      <option 
                        key={`select-node-${node.id}`} 
                        value={node.id}
                        disabled={activePermits.some(p => p.zone_id === node.id)}
                      >
                        {node.name} (Zone {node.id}) {activePermits.some(p => p.zone_id === node.id) ? '[Active Permit]' : ''}
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Permit Hazard Level</label>
                <select
                  value={permitType}
                  onChange={(e) => setPermitType(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-350"
                >
                  <option value="Hot Work">Hot Work (High Thermal Risk)</option>
                  <option value="Cold Work">Cold Work (Maintenance)</option>
                  <option value="Confined Space Entry">Confined Space Entry</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedZone}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-transparent font-bold text-xs uppercase tracking-wider rounded text-white border border-blue-500/30 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Issue Work Permit
              </button>
            </form>

          </div>

          {/* 5. LIVE SENSOR FEED */}
          <div className="bg-[#0c101d] rounded-xl border border-slate-800 p-5 flex flex-col gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
              Live Telemetry Feeds
            </h3>
            
            <div className={`p-4 rounded-lg border flex justify-between items-center ${getGasBgClass(gasLevel)}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-3.5 h-3.5 rounded-full ${gasLevel >= 12.0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-200">Gas Storage Sensor</p>
                  <p className="text-[9px] font-mono text-slate-450 uppercase mt-0.5">Node 4 • Gas level</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-base font-black tracking-wider ${getGasColorClass(gasLevel)}`}>
                  {gasLevel.toFixed(2)}%
                </p>
                <p className="text-[8px] font-mono text-slate-500">THR: 12.0%</p>
              </div>
            </div>

            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/65 flex justify-between items-center text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-500" /> Last Feed Update</span>
              <span className="font-mono text-[10px]">
                {timestamp ? new Date(timestamp).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="py-4 border-t border-slate-800 text-center text-[10px] text-slate-500 font-mono uppercase tracking-widest bg-[#070b13]">
        SafeGuard Emergency Routing Core • Real-time Stream Active
      </footer>

    </div>
  );
}

export default App;
