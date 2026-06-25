import React, { useEffect, useState } from 'react';
import { useSafetyStore } from './store';
import FloorLayoutSchematic from './FloorLayoutSchematic';
import {
  Shield,
  Activity,
  Users,
  Flame,
  Radio,
  FileText,
  Clock,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  MapPin,
  ArrowLeft,
  Server
} from 'lucide-react';

function CommandCenter({ onBack }) {
  const {
    connected,
    timestamp,
    systemStatus,
    gasLevel,
    activePermits,
    workers,
    graph,
    safeRoute,
    permitHistory,
    incidentHistory,
    connect,
    disconnect,
    createPermit,
    closePermit,
    fetchPermits,
    fetchIncidents
  } = useSafetyStore();

  const [selectedZone, setSelectedZone] = useState('');
  const [permitType, setPermitType] = useState('Hot Work');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize store connection on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const handleRefresh = () => {
    fetchPermits();
    fetchIncidents();
  };

  const handleCreatePermit = async (e) => {
    e.preventDefault();
    if (!selectedZone) return;
    setIsSubmitting(true);

    const zoneId = parseInt(selectedZone, 10);
    const zoneName = graph.nodes?.find(n => n.id === zoneId)?.name || `Zone ${zoneId}`;

    await createPermit(zoneId, zoneName, permitType);
    setSelectedZone('');
    setIsSubmitting(false);
  };

  // Status helper mapping
  const getStatusBadge = () => {
    switch (systemStatus) {
      case 'EVACUATING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-450 animate-pulse text-xs font-black uppercase tracking-wider rounded-md">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-450" />
            CRITICAL EVACUATION
          </span>
        );
      case 'WARNING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse text-xs font-black uppercase tracking-wider rounded-md">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
            ZONE WARNING
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-450 text-xs font-black uppercase tracking-wider rounded-md">
            <CheckCircle className="w-4.5 h-4.5 text-emerald-400" />
            SYSTEM SAFE
          </span>
        );
    }
  };

  const activeCount = workers.filter(w => w.status !== 'Evacuated').length;
  const evacuatedCount = workers.filter(w => w.status === 'Evacuated').length;

  return (
    <div className="min-h-screen bg-[#060814] text-slate-200 flex flex-col font-sans select-none">
      
      {/* 1. HEADER PANEL */}
      <header className="border-b border-slate-900 bg-[#0b0e1a]/95 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Back to Hero CTA */}
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-900 rounded-lg border border-slate-800 transition text-slate-400 hover:text-slate-200"
            title="Return to Welcome Screen"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-widest text-slate-100 uppercase flex items-center gap-2">
                SafeGuard <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 tracking-wider">COMMAND CENTRE</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">FACILITY GRAPH AUTOMATED RISK RESPONSE MATRIX</p>
            </div>
          </div>
        </div>

        {/* Global state gauges in Header */}
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
          
          {/* Live Stats */}
          <div className="flex items-center gap-5 bg-slate-950/60 px-4 py-2 rounded-lg border border-slate-900 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-500">WORKERS:</span>
              <span className="font-bold text-slate-200">{activeCount} active / {evacuatedCount} evacuated</span>
            </div>
            <div className="h-4 w-px bg-slate-900" />
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-500">TELEMETRY STATS:</span>
              {getStatusBadge()}
            </div>
          </div>

          {/* Web Socket Pulse */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold tracking-wider ${
            connected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-450 border-rose-500/20 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-450 animate-ping'}`} />
            {connected ? 'WS FEED: ESTABLISHED' : 'WS FEED: DISCONNECTED'}
          </div>

        </div>

      </header>

      {/* 2. DENSE DASHBOARD GRID */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto max-w-[1600px] mx-auto w-full">
        
        {/* LEFT COLUMN: SVG Floor Layout Schematic */}
        <section className="lg:col-span-2 flex flex-col gap-6">
          
          <div className="bg-[#0b0e1a] rounded-xl border border-slate-900 p-5 flex flex-col h-full shadow-md relative">
            
            {/* Schematic controls */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-350">Live Facility Node Topology</h2>
              </div>
              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                REAL-TIME GRAPH ROUTING MODEL
              </div>
            </div>

            {/* Layout Canvas */}
            <div className="flex-1 min-h-[500px]">
              <FloorLayoutSchematic
                graph={graph}
                workers={workers}
                gasLevel={gasLevel}
                systemStatus={systemStatus}
                safeRoute={safeRoute}
                activePermits={activePermits}
              />
            </div>

            {/* Layout Map Keys */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-900 text-[10px] font-mono text-slate-450 mt-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-cyan-950 border border-cyan-500 inline-block" />
                <span>EXITS (1 & 6)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-slate-950 border border-amber-500 inline-block" />
                <span>PERMIT ISSUED ZONE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-emerald-500 bg-emerald-500/20 inline-block" />
                <span>DYNAMIC A* ESCAPE PATH</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                <span>WORKER LOCATOR BEACON</span>
              </div>
            </div>

          </div>

        </section>

        {/* RIGHT COLUMN: Sensor Feed & Work Permit Controls */}
        <section className="flex flex-col gap-6">

          {/* TELEMETRY FEED (MIDDLE RIGHT PANEL) */}
          <div className="bg-[#0b0e1a] rounded-xl border border-slate-900 p-5 shadow-md flex flex-col gap-4">
            
            <div className="border-b border-slate-900 pb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-350 flex items-center gap-2">
                <Radio className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
                Live Sensor Telemetry
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">HIGH-VELOCITY ENVIRONMENT CAPTURE LOG</p>
            </div>

            {/* Telemetry Gauge Display */}
            <div className={`p-5 rounded-lg border transition-all duration-350 ${
              gasLevel >= 12.0
                ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse'
                : gasLevel >= 6.0
                ? 'bg-amber-500/5 border-amber-500/25'
                : 'bg-slate-950/60 border-slate-900'
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold text-slate-200">Gas Storage Area Level</h3>
                  <p className="text-[9px] font-mono text-slate-500 mt-1">SENSOR-NODE-04 • PROBE-A</p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-black font-mono tracking-wider ${
                    gasLevel >= 12.0 ? 'text-rose-450' : gasLevel >= 6.0 ? 'text-amber-400' : 'text-emerald-450'
                  }`}>
                    {gasLevel.toFixed(2)}%
                  </span>
                  <p className="text-[8px] font-mono text-slate-500 mt-0.5">ALERT THRESHOLD: 12.00%</p>
                </div>
              </div>

              {/* Progress bar visual indicator */}
              <div className="w-full bg-slate-900 rounded-full h-1.5 mt-4 overflow-hidden border border-slate-950">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    gasLevel >= 12.0 ? 'bg-rose-500' : gasLevel >= 6.0 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (gasLevel / 15) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 bg-slate-950/40 p-3 rounded border border-slate-900">
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> MATRIX TELEMETRY SYNCED</span>
              <span>{timestamp ? new Date(timestamp).toLocaleTimeString() : 'AWAITING SYNC...'}</span>
            </div>

          </div>

          {/* WORK PERMIT CONTROLLER (TOP RIGHT PANEL) */}
          <div className="bg-[#0b0e1a] rounded-xl border border-slate-900 p-5 shadow-md flex flex-col gap-4">
            
            <div className="border-b border-slate-900 pb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-350 flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-cyan-400" />
                Work Permit Registry
              </h2>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">REGISTER THERMAL HAZARD ACTIVITIES</p>
            </div>

            {/* List active permits */}
            <div className="flex flex-col gap-3">
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Active Clearances</span>
              
              {activePermits.length === 0 ? (
                <div className="text-[10px] font-mono text-slate-500 py-3 text-center border border-dashed border-slate-900 bg-slate-950/30 rounded-lg">
                  NO ACTIVE PERMITS IN CURRENT CYCLE
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {activePermits.map((permit) => {
                    const matchingLog = permitHistory.find(
                      h => h.zone_id === permit.zone_id && h.status === 'Active'
                    );

                    return (
                      <div 
                        key={`permit-${permit.zone_id}`}
                        className="bg-slate-950/60 p-3 rounded-lg border border-slate-900 flex justify-between items-center gap-3 hover:border-slate-800 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
                          <div>
                            <p className="text-xs font-bold text-slate-200">{permit.permit_type}</p>
                            <p className="text-[9px] font-mono text-slate-450 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" /> {permit.zone_name} (Zone {permit.zone_id})
                            </p>
                          </div>
                        </div>
                        {matchingLog && (
                          <button
                            onClick={() => closePermit(matchingLog.id)}
                            className="text-[9px] font-mono uppercase font-bold tracking-widest px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500 rounded transition"
                          >
                            REVOKE
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Create permit form */}
            <form onSubmit={handleCreatePermit} className="border-t border-slate-900 pt-4 mt-1 flex flex-col gap-3">
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Authorize Facility Zone</span>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono text-slate-450 uppercase">Target Facility Sector</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="bg-slate-950 border border-slate-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-slate-350"
                  required
                >
                  <option value="" disabled>Select sector zone...</option>
                  {graph.nodes
                    ?.filter(n => !n.is_exit)
                    .map(n => (
                      <option 
                        key={`sel-node-${n.id}`} 
                        value={n.id}
                        disabled={activePermits.some(p => p.zone_id === n.id)}
                      >
                        {n.name} (Zone {n.id}) {activePermits.some(p => p.zone_id === n.id) ? '[BLOCKED]' : ''}
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-mono text-slate-450 uppercase">Clearing Activity Type</label>
                <select
                  value={permitType}
                  onChange={(e) => setPermitType(e.target.value)}
                  className="bg-slate-950 border border-slate-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-slate-350"
                >
                  <option value="Hot Work">Hot Work (Arc Welding / Torch Cutting)</option>
                  <option value="Cold Work">Cold Work (Electrical / Structural)</option>
                  <option value="Confined Space Entry">Confined Space Entry (Hazardous Env)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedZone}
                className="w-full py-2.5 px-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-950 disabled:text-slate-600 disabled:border-transparent font-bold text-xs uppercase tracking-wider rounded-lg text-slate-950 border border-cyan-400/20 transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4.5 h-4.5" /> AUTHORIZE CLEARANCE
              </button>
            </form>

          </div>

        </section>

      </div>

      {/* 3. INCIDENT AUDIT LOGS PANEL (BOTTOM PANEL) */}
      <footer className="px-6 pb-6 w-full max-w-[1600px] mx-auto">
        <div className="bg-[#0b0e1a] rounded-xl border border-slate-900 p-5 shadow-md">
          
          <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-cyan-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-350">Industrial Incident Audit Registers</h2>
            </div>
            <button 
              onClick={handleRefresh}
              className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3 h-3 animate-spin-hover" /> FORCE RE-SYNC LOGS
            </button>
          </div>

          <div className="overflow-x-auto max-h-[160px] overflow-y-auto">
            {incidentHistory.length === 0 ? (
              <div className="text-[10px] font-mono text-slate-500 text-center py-5">
                NO RECORDED CYCLICAL INCIDENT REPORTS
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-2.5 px-2">Log Index</th>
                    <th className="py-2.5 px-2">Telemetry Timestamp</th>
                    <th className="py-2.5 px-2">Trigger Violation Severity</th>
                    <th className="py-2.5 px-2">Peak Environment Gas</th>
                    <th className="py-2.5 px-2">Subject Workers</th>
                    <th className="py-2.5 px-2 text-right">Emergency Clearance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 font-mono text-[10px] text-slate-300">
                  {incidentHistory.map((inc) => (
                    <tr key={`inc-${inc.id}`} className="hover:bg-slate-950/30">
                      <td className="py-2.5 px-2 font-bold text-cyan-400">INC-{inc.id.toString().padStart(4, '0')}</td>
                      <td className="py-2.5 px-2 text-slate-500">{new Date(inc.timestamp).toLocaleString()}</td>
                      <td className="py-2.5 px-2 text-slate-400 truncate max-w-[300px]" title={inc.trigger_reason}>
                        {inc.trigger_reason}
                      </td>
                      <td className="py-2.5 px-2 font-black text-rose-450">{inc.gas_level.toFixed(2)}%</td>
                      <td className="py-2.5 px-2 text-slate-400">{inc.affected_workers}</td>
                      <td className="py-2.5 px-2 text-right">
                        {inc.resolved_at ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 text-[9px] font-bold rounded">
                            CLEAR / NORMAL
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-450 border border-rose-500/20 text-[9px] font-black rounded animate-pulse">
                            ACTIVE EVACUATION
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
      </footer>

    </div>
  );
}

export default CommandCenter;
