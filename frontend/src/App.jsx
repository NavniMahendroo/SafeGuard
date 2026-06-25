import React, { useState } from 'react';
import CommandCenter from './CommandCenter';
import { Shield, ArrowRight, Zap, Cpu, Bell, Activity } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-[#0b0e1a] text-rose-400 border border-rose-900 rounded-xl m-6 font-mono text-xs max-w-4xl mx-auto">
          <h2 className="text-sm font-bold uppercase mb-2">React Render Crash Detected</h2>
          <p className="mb-4 text-slate-350">{this.state.error?.toString()}</p>
          <pre className="bg-slate-950 p-4 rounded overflow-auto max-h-96 text-[10px] text-rose-300 border border-slate-900">
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  if (showDashboard) {
    return (
      <ErrorBoundary>
        <CommandCenter onBack={() => setShowDashboard(false)} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 flex flex-col relative overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Cinematic grid background overlays */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{ 
          backgroundImage: `linear-gradient(to right, #0891b2 1px, transparent 1px), 
                            linear-gradient(to bottom, #0891b2 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }} 
      />
      <div className="absolute inset-0 bg-radial-glow opacity-30 pointer-events-none" 
           style={{
             background: 'radial-gradient(circle at 50% 50%, #06b6d4 0%, transparent 60%)',
             filter: 'blur(120px)'
           }}
      />
      
      {/* Decorative floating cyber particles */}
      <div className="absolute top-1/4 left-10 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />

      {/* Header / Brand */}
      <header className="px-8 py-6 z-10 flex justify-between items-center w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <span className="text-lg font-black tracking-wider text-slate-100 uppercase">
            SafeGuard <span className="text-xs text-cyan-400 font-mono font-bold tracking-normal lowercase ml-1">core v1.0</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-450 border border-slate-800 bg-slate-900/60 px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          SYSTEM WATCHDOGS ACTIVE
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center px-6 z-10 max-w-5xl mx-auto text-center mt-[-40px]">
        
        {/* Radar Icon Indicator */}
        <div className="mb-8 relative flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full border border-cyan-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute w-16 h-16 rounded-full border border-cyan-500/35 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="w-12 h-12 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Cinematic Headline */}
        <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] font-sans">
          Intelligence that prevents <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400">
            the unthinkable.
          </span>
        </h1>
        
        <p className="text-slate-400 text-sm md:text-lg max-w-2xl mb-10 leading-relaxed font-sans">
          SafeGuard combines real-time sensor streams, in-memory risk engines, and dynamic graph pathfinding (A*) to coordinate emergency routing instantly across industrial complexes.
        </p>

        {/* CTA Button */}
        <button
          onClick={() => setShowDashboard(true)}
          className="group relative px-8 py-4 bg-cyan-500 text-slate-950 font-bold uppercase tracking-wider rounded-lg transition-all duration-300 hover:bg-cyan-400 hover:shadow-[0_0_35px_rgba(6,182,212,0.55)] border border-cyan-300/30 flex items-center gap-3 overflow-hidden text-sm"
        >
          <span className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
          Enter Command Center
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Technical Sub-panel Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl mt-20 border-t border-slate-900 pt-10">
          <div className="bg-[#0b0e1a]/80 p-5 rounded-xl border border-slate-900 text-left hover:border-slate-800 transition">
            <div className="p-2 bg-blue-500/10 rounded-lg w-max mb-3.5 text-blue-400">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">A* Pathfinding</h3>
            <p className="text-[11px] text-slate-500 mt-2 font-sans">
              Computes dynamically penalized route maps inside factory graphs to divert workers away from high-hazard sectors.
            </p>
          </div>

          <div className="bg-[#0b0e1a]/80 p-5 rounded-xl border border-slate-900 text-left hover:border-slate-800 transition">
            <div className="p-2 bg-cyan-500/10 rounded-lg w-max mb-3.5 text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">FastAPI Telemetry Stream</h3>
            <p className="text-[11px] text-slate-500 mt-2 font-sans">
              Event-driven high-velocity WebSockets broadcast live coordinates and sensor data to dispatch units immediately.
            </p>
          </div>

          <div className="bg-[#0b0e1a]/80 p-5 rounded-xl border border-slate-900 text-left hover:border-slate-800 transition">
            <div className="p-2 bg-rose-500/10 rounded-lg w-max mb-3.5 text-rose-450">
              <Bell className="w-4 h-4 text-rose-400" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Risk Mitigation Core</h3>
            <p className="text-[11px] text-slate-500 mt-2 font-sans">
              Combines work permit levels with live environment readings to isolate risk factors before safety incidents trigger.
            </p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-[10px] font-mono text-slate-600 uppercase tracking-widest border-t border-slate-950">
        SafeGuard Cybernetic Safety Matrix • ISO 27001 Certified
      </footer>

    </div>
  );
}

export default App;
