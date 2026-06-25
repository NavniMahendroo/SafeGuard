import React from 'react';

function FloorLayoutSchematic({ graph, workers, gasLevel, systemStatus, safeRoute, activePermits }) {
  // Coordinates helper mapping if graph is not loaded yet
  const nodesMap = React.useMemo(() => {
    const map = {};
    if (graph && graph.nodes) {
      graph.nodes.forEach(n => {
        map[n.id] = { x: n.x, y: n.y, name: n.name, is_exit: n.is_exit };
      });
    }
    return map;
  }, [graph]);

  // Format path coordinates for the glowing safeRoute polyline
  const safeRoutePoints = React.useMemo(() => {
    if (!safeRoute || safeRoute.length === 0) return '';
    return safeRoute
      .map(nodeId => {
        const node = nodesMap[nodeId];
        return node ? `${node.x},${node.y}` : '';
      })
      .filter(p => p !== '')
      .join(' ');
  }, [safeRoute, nodesMap]);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
        <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin mb-4" />
        <p className="text-xs font-mono tracking-wider">AWAITING SYSTEM GRAPH SCHEMATIC...</p>
      </div>
    );
  }

  // Get indicator colors based on Gas Storage telemetry (Node 4)
  const getGasIndicatorColors = () => {
    if (gasLevel < 6.0) {
      return {
        fill: 'fill-emerald-500/10',
        stroke: 'stroke-emerald-500',
        glow: 'rgba(16, 185, 129, 0.4)',
        pulsing: false
      };
    } else if (gasLevel < 12.0) {
      return {
        fill: 'fill-amber-500/15',
        stroke: 'stroke-amber-500',
        glow: 'rgba(245, 158, 11, 0.5)',
        pulsing: true
      };
    } else {
      return {
        fill: 'fill-rose-500/20 animate-pulse',
        stroke: 'stroke-rose-500',
        glow: 'rgba(244, 63, 94, 0.8)',
        pulsing: true
      };
    }
  };

  const gasColors = getGasIndicatorColors();

  return (
    <div className="relative w-full h-full bg-[#070b13] rounded-lg border border-slate-900 overflow-hidden flex items-center justify-center p-4">
      {/* Self-contained CSS for path marching animations, glows, and expanding hazard radii */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes march {
          to {
            stroke-dashoffset: -20;
          }
        }
        @keyframes pulse-opacity {
          0%, 100% {
            opacity: 0.95;
            stroke-width: 8;
            filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.8));
          }
          50% {
            opacity: 0.6;
            stroke-width: 10;
            filter: drop-shadow(0 0 18px rgba(16, 185, 129, 0.95));
          }
        }
        @keyframes expand-hazard {
          0% {
            r: 38;
            opacity: 0.9;
            stroke-width: 1.5;
          }
          100% {
            r: 150;
            opacity: 0;
            stroke-width: 3.5;
          }
        }
        .glowing-evac-path {
          animation: march 0.8s linear infinite, pulse-opacity 1.5s ease-in-out infinite;
        }
        .expanding-hazard-circle {
          animation: expand-hazard 2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
          pointer-events: none;
        }
        .hazard-corridor-alert {
          animation: march 1.6s linear infinite;
          filter: drop-shadow(0 0 6px rgba(244, 63, 94, 0.6));
        }
        .node-pulse-ring {
          animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}} />

      {/* Grid schematic overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(#0891b2 1.5px, transparent 1.5px)', 
          backgroundSize: '30px 30px' 
        }} 
      />

      <svg viewBox="0 0 1000 1000" className="w-full h-full max-h-[600px] select-none p-4">
        <defs>
          {/* SVG Glow Filter specs */}
          <filter id="svg-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="svg-glow-rose" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="svg-glow-amber" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. DRAW BASE CORRIDOR EDGES */}
        {graph.edges.map((edge, idx) => {
          const fromNode = nodesMap[edge.source];
          const toNode = nodesMap[edge.target];
          if (!fromNode || !toNode) return null;

          // Determine corridor risk
          const isDangerConnection = edge.source === 4 || edge.target === 4;
          const isHazardAlert = systemStatus === "EVACUATING" && isDangerConnection;

          return (
            <line
              key={`edge-${idx}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={
                isHazardAlert
                  ? '#f43f5e'
                  : systemStatus === "EVACUATING"
                  ? '#10b981'
                  : '#1e293b'
              }
              strokeWidth={systemStatus === "EVACUATING" ? (isDangerConnection ? '3.5' : '2.5') : '1.5'}
              strokeDasharray={isDangerConnection && systemStatus === "EVACUATING" ? '6 4' : 'none'}
              opacity={systemStatus === "EVACUATING" ? (isDangerConnection ? '0.7' : '0.85') : '0.5'}
              strokeLinecap="round"
            />
          );
        })}

        {/* 2. DRAW EVACUATION PATH (A* safeRoute) */}
        {systemStatus === "EVACUATING" && safeRoutePoints && (
          <polyline
            points={safeRoutePoints}
            fill="none"
            stroke="#10b981"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="15 8"
            className="glowing-evac-path"
            opacity="0.9"
          />
        )}

        {/* 3. DRAW CORRIDOR HIGHLIGHTS FOR ACTIVE WORKER PATHS */}
        {workers.map((worker) => {
          if (worker.status === 'Evacuated' || !worker.path || worker.path.length === 0) return null;
          
          const pathPoints = [];
          pathPoints.push(`${worker.x},${worker.y}`);
          worker.path.forEach(nId => {
            const node = nodesMap[nId];
            if (node) pathPoints.push(`${node.x},${node.y}`);
          });

          return (
            <polyline
              key={`worker-route-${worker.id}`}
              points={pathPoints.join(' ')}
              fill="none"
              stroke={worker.color || '#06b6d4'}
              strokeWidth="2.5"
              strokeDasharray="4 4"
              opacity="0.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* 4. DRAW FACILITY ZONES (Nodes) */}
        {graph.nodes.map((node) => {
          const hasActivePermit = activePermits.some(p => p.zone_id === node.id);

          // Configure bubble styles based on zone status
          let borderClass = 'stroke-slate-800';
          let fillClass = 'fill-slate-900/90';
          let outerGlow = '';
          let showPulsingRing = false;
          let ringColor = 'stroke-slate-800';

          if (node.id === 4) {
            // Gas storage zone colors are mapped to live telemetry readings
            borderClass = gasColors.stroke;
            fillClass = gasColors.fill;
            outerGlow = gasLevel >= 12.0 ? 'svg-glow-rose' : gasLevel >= 6.0 ? 'svg-glow-amber' : '';
            showPulsingRing = gasLevel >= 6.0;
            ringColor = gasLevel >= 12.0 ? 'stroke-rose-500/30' : 'stroke-amber-500/20';
          } else if (node.is_exit) {
            // Exit zones glow cyan
            borderClass = 'stroke-cyan-500';
            fillClass = 'fill-cyan-950/80';
            outerGlow = 'svg-glow-cyan';
            ringColor = 'stroke-cyan-500/30';
          } else if (hasActivePermit) {
            // Active permit zones glow warning amber
            borderClass = 'stroke-amber-500';
            fillClass = 'fill-slate-950/90';
            outerGlow = 'svg-glow-amber';
            ringColor = 'stroke-amber-500/20';
          }

          return (
            <g key={`node-${node.id}`} className="group cursor-pointer">
              {/* Outer pulsing ring for warning/critical zones */}
              {showPulsingRing && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="52"
                  fill="none"
                  stroke={gasLevel >= 12.0 ? '#f43f5e' : '#f59e0b'}
                  strokeWidth="1"
                  opacity="0.3"
                  className="node-pulse-ring"
                />
              )}

              {/* Expanding Hazard Radius (Demo Drama) */}
              {node.id === 4 && systemStatus === "EVACUATING" && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="38"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  className="expanding-hazard-circle"
                />
              )}

              {/* Node Outer Ring */}
              <circle
                cx={node.x}
                cy={node.y}
                r="38"
                fill="none"
                className={`transition-all duration-300 ${ringColor}`}
                strokeWidth="2"
              />

              {/* Node Core Bubble */}
              <circle
                cx={node.x}
                cy={node.y}
                r="28"
                className={`transition-all duration-300 ${borderClass} ${fillClass}`}
                strokeWidth="2.5"
                filter={outerGlow ? `url(#${outerGlow})` : ''}
              />

              {/* Node text identification */}
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                fill={node.is_exit ? '#22d3ee' : '#f8fafc'}
                fontSize="13"
                fontWeight="900"
                fontFamily="monospace"
              >
                {node.id}
              </text>

              {/* Label card block underneath node bubble */}
              <g transform={`translate(${node.x}, ${node.y + 54})`}>
                <rect
                  x="-85"
                  y="-14"
                  width="170"
                  height="32"
                  rx="6"
                  fill="#0c101d"
                  stroke={node.id === 4 ? (gasLevel >= 12.0 ? '#f43f5e' : gasLevel >= 6.0 ? '#f59e0b' : '#1e293b') : '#1e293b'}
                  strokeWidth="1"
                  opacity="0.9"
                />
                
                {/* Node Name */}
                <text
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                  letterSpacing="0.5"
                >
                  {node.name}
                </text>

                {/* Subtext sensor/status */}
                {node.id === 4 && (
                  <text
                    y="12"
                    textAnchor="middle"
                    className={`text-[9px] font-black ${
                      gasLevel >= 12.0 ? 'fill-rose-400 animate-pulse' : gasLevel >= 6.0 ? 'fill-amber-400' : 'fill-emerald-400'
                    }`}
                    fontFamily="monospace"
                  >
                    GAS LEAK: {gasLevel.toFixed(2)}%
                  </text>
                )}
                
                {node.is_exit && (
                  <text y="12" textAnchor="middle" fill="#22d3ee" className="text-[9px] font-bold">
                    EXIT CORRIDOR
                  </text>
                )}

                {!node.is_exit && node.id !== 4 && hasActivePermit && (
                  <text y="12" textAnchor="middle" fill="#fbbf24" className="text-[9px] font-bold uppercase">
                    ⚠️ PERMIT ACTIVE
                  </text>
                )}
              </g>
            </g>
          );
        })}

        {/* 5. DRAW PLAYERS / WORKERS */}
        {workers.map((worker) => {
          if (worker.status === 'Evacuated') return null;

          return (
            <g key={`worker-group-${worker.id}`} className="transition-all duration-1000 ease-linear">
              {/* Outer pulsing ping */}
              <circle
                cx={worker.x}
                cy={worker.y}
                r="18"
                fill={worker.color || '#06b6d4'}
                opacity="0.1"
                className="animate-ping"
                style={{ animationDuration: '2.5s' }}
              />

              {/* Outer stroke border */}
              <circle
                cx={worker.x}
                cy={worker.y}
                r="9"
                fill="#090c15"
                stroke={worker.color || '#06b6d4'}
                strokeWidth="2.5"
                style={{ transition: 'cx 1.0s linear, cy 1.0s linear' }}
              />

              {/* Inner core */}
              <circle
                cx={worker.x}
                cy={worker.y}
                r="4.5"
                fill={worker.color || '#06b6d4'}
                className={worker.status === 'Rerouting' ? 'animate-pulse' : ''}
                style={{ transition: 'cx 1.0s linear, cy 1.0s linear' }}
              />

              {/* ID Tag indicator label */}
              <g 
                transform={`translate(${worker.x}, ${worker.y - 15})`}
                style={{ transition: 'transform 1.0s linear' }}
              >
                <rect
                  x="-20"
                  y="-9"
                  width="40"
                  height="14"
                  rx="3"
                  fill="#0d111d"
                  stroke={worker.status === 'Rerouting' ? '#f43f5e' : '#334155'}
                  strokeWidth="1"
                  opacity="0.85"
                />
                <text
                  textAnchor="middle"
                  fill={worker.status === 'Rerouting' ? '#f43f5e' : '#f1f5f9'}
                  fontSize="8"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  {worker.id}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default FloorLayoutSchematic;
