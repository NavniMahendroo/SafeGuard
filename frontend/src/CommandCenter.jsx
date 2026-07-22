import React, { useEffect, useState } from 'react';
import { useStore, getHttpUrl } from './store';
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
  AlertTriangle,
  CheckCircle,
  MapPin,
  ArrowLeft,
  Server,
  Volume2,
  VolumeX,
  RotateCcw
} from 'lucide-react';

function CommandCenter({ onBack }) {
  const {
    connected,
    wsStatus,
    status,
    telemetry,
    lead_time_minutes,
    workers,
    active_permits,
    triggered_rules,
    evacuation_paths,
    nodes,
    cooldown_seconds_remaining,
    incidents,
    connect,
    disconnect,
    issuePermit,
    revokePermit,
    resolveIncident,
    fetchIncidents,
    resetDemo,
    apiHost
  } = useStore();

  const [selectedZone, setSelectedZone] = useState('');
  const [permitType, setPermitType] = useState('Hot Work');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [audioCtx, setAudioCtx] = useState(null);

  // Toast notifications
  const [toast, setToast] = useState(null);

  // RAG Compliance Audit States (incidents loaded from global store)
  const [activeAudit, setActiveAudit] = useState(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const handleViewAudit = async (incidentId) => {
    try {
      const response = await fetch(getHttpUrl(apiHost, `/api/audit/${incidentId}`));
      if (response.ok) {
        const data = await response.json();
        setActiveAudit(data);
        setIsAuditModalOpen(true);
      } else {
        alert("RAG Audit context not generated yet or not found for this incident.");
      }
    } catch (e) {
      console.error("Failed to fetch audit snapshot:", e);
      alert("Error fetching RAG Audit details.");
    }
  };

  const handleResetDemo = async () => {
    try {
      setIsSubmitting(true);
      await resetDemo();
      setToast({ type: 'success', message: 'Demo reset to baseline settings successfully!' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to reset demo: ' + err.message });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [status, fetchIncidents]);

  // Initialize AudioContext on first toggle
  const toggleMute = () => {
    if (!audioCtx) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      setAudioCtx(ctx);
    }
    setIsMuted(!isMuted);
  };

  useEffect(() => {
    if (status !== 'EVACUATING' || isMuted || !audioCtx) return;

    let intervalId;
    const playSiren = () => {
      try {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        // Warning siren frequency sweep (880Hz down to 440Hz)
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.8);
        
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime); // low volume
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      } catch (e) {
        console.error("Audio playback error:", e);
      }
    };

    // Play immediately and then every 1.5 seconds
    playSiren();
    intervalId = setInterval(playSiren, 1500);

    return () => {
      clearInterval(intervalId);
    };
  }, [status, isMuted, audioCtx]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const handleCreatePermit = async (e) => {
    e.preventDefault();
    if (!selectedZone) return;
    setIsSubmitting(true);
    try {
      await issuePermit(permitType, selectedZone);
      setSelectedZone('');
    } catch (error) {
      console.error('Failed to issue permit:', error);
    }
    setIsSubmitting(false);
  };

  const handleRevokePermit = async (permitId) => {
    try {
      await revokePermit(permitId);
    } catch (error) {
      console.error('Failed to revoke permit:', error);
    }
  };

  const handleResolve = async () => {
    try {
      await resolveIncident();
    } catch (error) {
      console.error('Failed to resolve incident:', error);
    }
  };

  const gasLevel = telemetry?.gas_level || 4.0;
  const temperature = telemetry?.temperature || 32.0;
  const pressure = telemetry?.pressure || 1.8;

  const zones = [
    "Entry Gate",
    "Assembly Line A",
    "Assembly Line B",
    "Gas Storage Zone",
    "Control Room"
  ];

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans select-none relative">
      {(wsStatus === 'reconnecting' || wsStatus === 'connecting') && (
        <div className="bg-accent-rose text-white text-center py-2 px-4 animate-pulse flex items-center justify-center space-x-2 font-semibold text-xs tracking-wider z-50 sticky top-0 border-b border-accent-rose/30 shadow-[0_4px_12px_rgba(244,63,94,0.3)]">
          <span className="w-2 h-2 bg-white rounded-full animate-ping" />
          <span>SAFETY DATASTREAM DISCONNECTED: RECONNECTING TO BACKEND SENSORS ({wsStatus.toUpperCase()})...</span>
        </div>
      )}
      {status === 'EVACUATING' && (
        <div className="absolute inset-0 pointer-events-none z-50 border-8 border-accent-rose/20 animate-pulse" style={{ boxShadow: 'inset 0 0 80px rgba(244, 63, 94, 0.2)' }} />
      )}
      <header className="border-b border-border bg-bg-card/95 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button onClick={onBack} className="p-2 hover:bg-bg-panel rounded-lg border border-border transition text-text-muted hover:text-text">
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-cyan/10 rounded-lg border border-accent-cyan/30">
              <Shield className="w-6 h-6 text-accent-cyan" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-widest text-text uppercase">
                SafeGuard <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">COMMAND CENTER</span>
              </h1>
              <p className="text-[10px] text-text-muted font-mono tracking-wider">FACILITY GRAPH AUTOMATED RISK RESPONSE MATRIX</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
          <div className="flex items-center gap-5 bg-bg-panel/60 px-4 py-2 rounded-lg border border-border text-xs font-mono">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent-cyan" />
              <span className="text-text-muted">WORKERS:</span>
              <span className="font-bold text-text">{workers.length}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-cyan" />
              <span className="text-text-muted">STATUS:</span>
              {status === 'EVACUATING' ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-rose/10 border border-accent-rose/30 text-accent-rose animate-pulse text-xs font-black uppercase rounded">
                  <AlertTriangle className="w-3 h-3" /> CRITICAL
                </span>
              ) : status === 'COOLDOWN' ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber text-xs font-black uppercase rounded">
                  <Clock className="w-3 h-3" /> COOLDOWN {cooldown_seconds_remaining}s
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald text-xs font-black uppercase rounded">
                  <CheckCircle className="w-3 h-3" /> NORMAL
                </span>
              )}
              {status === 'EVACUATING' && (
                <button onClick={handleResolve} className="ml-2 px-2 py-0.5 bg-accent-rose hover:bg-accent-rose/80 text-white text-[9px] font-black uppercase rounded border border-accent-rose/30 transition">
                  Resolve
                </button>
              )}
            </div>
          </div>

          <button 
            onClick={toggleMute} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold tracking-wider transition ${
              isMuted 
                ? 'bg-bg-panel/40 text-text-muted border-border hover:bg-bg-panel' 
                : 'bg-accent-amber/10 text-accent-amber border-accent-amber/20 hover:bg-accent-amber/20'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 animate-bounce" />}
            {isMuted ? 'AUDIO: OFF' : 'AUDIO: ON'}
          </button>

          <button
            onClick={handleResetDemo}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-bg-panel/20 text-text-muted hover:text-text hover:bg-bg-panel/40 transition text-[10px] font-mono font-bold tracking-wider disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET DEMO
          </button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold tracking-wider ${
            wsStatus === 'connected' ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20' :
            wsStatus === 'connecting' ? 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20 animate-pulse' :
            wsStatus === 'reconnecting' ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/20 animate-pulse' :
            'bg-accent-rose/10 text-accent-rose border-accent-rose/20 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected' ? 'bg-accent-emerald animate-pulse' :
              wsStatus === 'connecting' ? 'bg-accent-cyan animate-ping' :
              wsStatus === 'reconnecting' ? 'bg-accent-amber animate-ping' :
              'bg-accent-rose animate-ping'
            }`} />
            {wsStatus === 'connected' ? 'WS: CONNECTED' :
             wsStatus === 'connecting' ? 'WS: CONNECTING' :
             wsStatus === 'reconnecting' ? 'WS: RECONNECTING' :
             'WS: DISCONNECTED'}
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto max-w-[1600px] mx-auto w-full">
        <section className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-bg-card rounded-xl border border-border p-5 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4.5 h-4.5 text-accent-cyan animate-pulse" />
                <h2 className="text-xs font-black uppercase tracking-widest text-text">Live Facility Node Topology</h2>
              </div>
              <div className="text-[10px] font-mono text-text-muted flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan animate-ping" />
                REAL-TIME GRAPH ROUTING
              </div>
            </div>

            <div className="flex-1 min-h-[500px]">
              <FloorLayoutSchematic
                nodes={nodes}
                workers={workers}
                status={status}
                evacuation_paths={evacuation_paths}
                active_permits={active_permits}
                telemetry={telemetry}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-bg-panel/40 p-3 rounded-lg border border-border text-[10px] font-mono text-text-muted mt-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-accent-cyan/20 border border-accent-cyan inline-block" />
                <span>EXITS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-accent-amber/20 border border-accent-amber inline-block" />
                <span>PERMIT ACTIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded border border-accent-emerald bg-accent-emerald/20 inline-block" />
                <span>A* EVAC PATH</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-accent-cyan animate-ping inline-block" />
                <span>WORKER BEACON</span>
              </div>
            </div>
          </div>

          {/* Regulatory Audit Log (RAG) Card */}
          <div className="bg-bg-card rounded-xl border border-border p-5 flex flex-col gap-4">
            <div className="border-b border-border pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-text flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-accent-cyan" />
                  ⚖️ Regulatory Audit Log & RAG Compliance
                </h2>
                <p className="text-[10px] text-text-muted font-mono mt-0.5">COMPLIANCE ANALYSIS RETRIEVED FROM SAFETY DATABASES</p>
              </div>
              <button 
                onClick={fetchIncidents} 
                className="px-2.5 py-1 rounded bg-bg-panel border border-border hover:bg-border text-[10px] font-mono text-text transition"
              >
                REFRESH LOGS
              </button>
            </div>

            {incidents.length === 0 ? (
              <div className="text-[10px] font-mono text-text-muted py-8 text-center border border-dashed border-border bg-bg-panel/10 rounded-lg">
                NO HISTORICAL INCIDENTS RECORDED IN DATABASE
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                {incidents.map((inc) => (
                  <div key={inc.id} className="bg-bg-panel/40 p-3.5 rounded-lg border border-border hover:border-accent-cyan/30 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                          inc.severity === 'CRITICAL' ? 'bg-accent-rose/10 text-accent-rose border border-accent-rose/20' : 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20'
                        }`}>
                          {inc.severity}
                        </span>
                        <span className="font-mono text-text-muted text-[10px]">ID: #{inc.id}</span>
                        <span className="text-text-muted font-mono text-[10px]">•</span>
                        <span className="text-text-muted font-mono text-[10px]">{new Date(inc.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="font-bold text-text">Trigger: {inc.rule_id}</p>
                      <p className="text-[10px] text-text-muted font-mono">
                        Telemetry: Gas {inc.gas_level.toFixed(2)}% | Temp {inc.temperature.toFixed(1)}°C | Workers Affected: {inc.workers_affected}
                      </p>
                      {inc.resolved_at ? (
                        <p className="text-[9px] font-mono text-accent-emerald flex items-center gap-1">
                          ✓ RESOLVED AT: {new Date(inc.resolved_at).toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-[9px] font-mono text-accent-rose animate-pulse">
                          ⚠️ ACTIVE UNRESOLVED INCIDENT
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => handleViewAudit(inc.id)}
                      className="self-start md:self-center px-3 py-1.5 bg-accent-cyan/10 hover:bg-accent-cyan hover:text-bg text-accent-cyan text-[10px] font-bold uppercase tracking-wider rounded-lg border border-accent-cyan/20 transition"
                    >
                      VIEW RAG SAFETY CLAUSES
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          {status === 'EVACUATING' && (
            <div className="bg-accent-rose/10 border-2 border-accent-rose rounded-xl p-5 shadow-lg flex flex-col gap-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent-rose rounded-full text-bg">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wider uppercase text-text">CRITICAL SAFETY ALERT</h3>
                  <p className="text-[10px] text-accent-rose font-semibold font-mono">COMPOUND HAZARD EVACUATION ACTIVE</p>
                </div>
              </div>
              {triggered_rules.length > 0 && (
                <div className="bg-accent-rose/20 p-3 rounded border border-accent-rose/30">
                  {triggered_rules.map((rule, idx) => (
                    <div key={idx} className="text-[10px] font-mono mb-1">
                      <strong>{rule.rule_id}:</strong> {rule.action}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={handleResolve} className="w-full py-2 bg-accent-rose hover:bg-accent-rose/80 text-white font-bold text-xs uppercase tracking-widest rounded-lg border border-accent-rose/30 transition">
                Resolve Incident
              </button>
            </div>
          )}

          {lead_time_minutes !== null && status === 'NORMAL' && (
            <div className="bg-accent-amber/10 border border-accent-amber/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-accent-amber" />
                <h3 className="text-xs font-black uppercase text-accent-amber">Lead Time Warning</h3>
              </div>
              <p className="text-lg font-black font-mono text-accent-amber">
                ⚠ Critical threshold in ~{lead_time_minutes.toFixed(1)} min
              </p>
            </div>
          )}

          <div className="bg-bg-card rounded-xl border border-border p-5 flex flex-col gap-4">
            <div className="border-b border-border pb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-text flex items-center gap-2">
                <Radio className="w-4.5 h-4.5 text-accent-cyan animate-pulse" />
                Live Sensor Telemetry
              </h2>
              <p className="text-[10px] text-text-muted font-mono mt-0.5">HIGH-VELOCITY ENVIRONMENT CAPTURE</p>
            </div>

            <div className={`p-4 rounded-lg border transition-all ${
              gasLevel >= 12.0 ? 'bg-accent-rose/10 border-accent-rose/30 animate-pulse' : gasLevel >= 8.0 ? 'bg-accent-amber/10 border-accent-amber/30' : 'bg-bg-panel/60 border-border'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-text">Gas Level</span>
                <span className={`text-2xl font-black font-mono ${gasLevel >= 12.0 ? 'text-accent-rose' : gasLevel >= 8.0 ? 'text-accent-amber' : 'text-accent-emerald'}`}>
                  {gasLevel.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${gasLevel >= 12.0 ? 'bg-accent-rose' : gasLevel >= 8.0 ? 'bg-accent-amber' : 'bg-accent-emerald'}`} style={{ width: `${Math.min(100, (gasLevel / 15) * 100)}%` }} />
              </div>
            </div>

            <div className="p-4 rounded-lg border border-border bg-bg-panel/60">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-text">Temperature</span>
                <span className="text-xl font-black font-mono text-accent-cyan">{temperature.toFixed(1)}°C</span>
              </div>
              <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-accent-cyan transition-all" style={{ width: `${Math.min(100, (temperature / 80) * 100)}%` }} />
              </div>
            </div>

            <div className="p-4 rounded-lg border border-border bg-bg-panel/60">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-text">Pressure</span>
                <span className="text-xl font-black font-mono text-accent-cyan">{pressure.toFixed(2)} bar</span>
              </div>
              <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-accent-cyan transition-all" style={{ width: `${Math.min(100, (pressure / 4) * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-bg-card rounded-xl border border-border p-5 flex flex-col gap-4">
            <div className="border-b border-border pb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-text flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-accent-cyan" />
                Work Permit Registry
              </h2>
              <p className="text-[10px] text-text-muted font-mono mt-0.5">REGISTER THERMAL HAZARD ACTIVITIES</p>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Active Clearances</span>
              {active_permits.length === 0 ? (
                <div className="text-[10px] font-mono text-text-muted py-3 text-center border border-dashed border-border bg-bg-panel/30 rounded-lg">
                  NO ACTIVE PERMITS
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {active_permits.map((permit) => (
                    <div key={permit.id} className="bg-bg-panel/60 p-3 rounded-lg border border-border flex justify-between items-center gap-3">
                      <div className="flex items-center gap-2.5">
                        <Flame className="w-4 h-4 text-accent-amber animate-pulse" />
                        <div>
                          <p className="text-xs font-bold text-text">{permit.type}</p>
                          <p className="text-[9px] font-mono text-text-muted flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {permit.zone}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleRevokePermit(permit.id)} className="text-[9px] font-mono uppercase font-bold px-2.5 py-1 bg-accent-rose/10 hover:bg-accent-rose hover:text-white border border-accent-rose/20 rounded transition">
                        REVOKE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleCreatePermit} className="border-t border-border pt-4 flex flex-col gap-3">
              <span className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Authorize Facility Zone</span>
              <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)} className="bg-bg-panel border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent-cyan text-text" required>
                <option value="">Select sector zone...</option>
                {zones.map(zone => (
                  <option key={zone} value={zone} disabled={active_permits.some(p => p.zone === zone)}>
                    {zone} {active_permits.some(p => p.zone === zone) ? '[BLOCKED]' : ''}
                  </option>
                ))}
              </select>
              <select value={permitType} onChange={(e) => setPermitType(e.target.value)} className="bg-bg-panel border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent-cyan text-text">
                <option value="Hot Work">Hot Work</option>
                <option value="Cold Work">Cold Work</option>
                <option value="Confined Space">Confined Space</option>
              </select>
              <button type="submit" disabled={isSubmitting || !selectedZone} className="w-full py-2.5 px-3 bg-accent-cyan hover:bg-accent-cyan/80 disabled:bg-bg-panel disabled:text-text-muted font-bold text-xs uppercase tracking-wider rounded-lg text-bg border border-accent-cyan/20 transition flex items-center justify-center gap-1.5">
                <Plus className="w-4.5 h-4.5" /> AUTHORIZE
              </button>
            </form>
          </div>
        </section>
      </div>
      {/* RAG Audit Modal */}
      {isAuditModalOpen && activeAudit && (
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-border rounded-xl max-w-2xl w-full p-6 flex flex-col gap-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative animate-fade-in text-text">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-text flex items-center gap-2">
                  ⚖️ Compliance Audit Report: Incident #{activeAudit.incident_id}
                </h3>
                <p className="text-[10px] text-text-muted font-mono mt-0.5">GENERATED BY AUTOMATED REGULATORY RAG SYSTEM</p>
              </div>
              <button 
                onClick={() => setIsAuditModalOpen(false)}
                className="text-xs font-mono font-bold text-text-muted hover:text-text px-2 py-1 border border-border rounded hover:bg-bg-panel transition"
              >
                CLOSE
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto max-h-[450px] pr-2">
              <div className="bg-bg-panel/40 p-4 rounded-lg border border-border flex flex-col gap-2 font-mono text-[11px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-text-muted">
                  <div>TRIGGER REASON: <span className="text-text font-bold">{activeAudit.trigger_reason}</span></div>
                  <div>RULE TRIGGERED: <span className="text-text font-bold">{activeAudit.triggered_rules?.[0]?.rule_id}</span></div>
                  <div>GAS LEVEL AT TRIGGER: <span className="text-text font-bold">{activeAudit.gas_level?.toFixed(2)}%</span></div>
                  <div>TEMP AT TRIGGER: <span className="text-text font-bold">{activeAudit.temperature?.toFixed(1)}°C</span></div>
                  <div>ANOMALY DETECTOR SCORE: <span className="text-text font-bold">{activeAudit.anomaly_score?.toFixed(4)}</span></div>
                  <div>PREDICTED LEAD TIME: <span className="text-text font-bold">{activeAudit.lead_time_at_trigger ? `${activeAudit.lead_time_at_trigger.toFixed(1)} min` : 'N/A'}</span></div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Retrieved Safety Regulations (FAISS Match)</span>
                {activeAudit.rag_context && activeAudit.rag_context.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {activeAudit.rag_context.map((reg, idx) => (
                      <div key={idx} className="bg-accent-cyan/5 p-4 rounded-lg border border-accent-cyan/15 flex flex-col gap-2">
                        <div className="flex justify-between items-center border-b border-accent-cyan/10 pb-1.5">
                          <span className="text-xs font-bold text-accent-cyan font-mono">{reg.id}</span>
                          <span className="text-[10px] text-text-muted font-mono">
                            MATCH QUALITY: {(reg.similarity_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-text leading-relaxed">
                          <strong>Standard Clause:</strong> {reg.text}
                        </p>
                        <p className="text-xs text-accent-cyan font-mono mt-1 leading-relaxed">
                          <strong>Mandated Compliance Action:</strong> {reg.action}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-text-muted text-center py-4">
                    No relevant regulatory contexts found.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button 
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 bg-accent-cyan text-bg hover:bg-accent-cyan/80 text-xs font-bold uppercase tracking-widest rounded-lg border border-accent-cyan/20 transition"
              >
                Acknowledge and Close
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg border shadow-xl flex items-center gap-3 transition text-xs font-mono font-bold max-w-sm animate-bounce ${
          toast.type === 'success'
            ? 'bg-accent-emerald/20 border-accent-emerald text-accent-emerald'
            : 'bg-accent-rose/20 border-accent-rose text-accent-rose'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default CommandCenter;
