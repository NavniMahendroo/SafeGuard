import React from 'react';

function FloorLayoutSchematic({ nodes, workers, status, evacuation_paths, active_permits, telemetry }) {
  // Exact node coordinates from specification
  const nodeCoordinates = {
    "Entry Gate": { x: 80, y: 300 },
    "Assembly Line A": { x: 240, y: 180 },
    "Assembly Line B": { x: 240, y: 420 },
    "Gas Storage Zone": { x: 480, y: 300 },
    "Control Room": { x: 640, y: 180 },
    "Exit North": { x: 720, y: 80 },
    "Exit South": { x: 720, y: 520 }
  };

  // Format evacuation path points for polyline
  const evacuationPathPoints = React.useMemo(() => {
    const points = [];
    Object.values(evacuation_paths).forEach(path => {
      path.forEach(nodeId => {
        const coords = nodeCoordinates[nodeId];
        if (coords) points.push(`${coords.x},${coords.y}`);
      });
    });
    return points.join(' ');
  }, [evacuation_paths]);

  // Group workers by node to prevent overlapping
  const workersByNode = React.useMemo(() => {
    const groups = {};
    workers.forEach(w => {
      if (!groups[w.node]) groups[w.node] = [];
      groups[w.node].push(w);
    });
    return groups;
  }, [workers]);

  // Calculate worker positions inside the card (bottom half) to avoid overlapping text
  const getWorkerPosition = (worker) => {
    const nodeCoords = nodeCoordinates[worker.node];
    if (!nodeCoords) return { x: worker.x, y: worker.y };

    const nodeWorkers = workersByNode[worker.node] || [];
    const idx = nodeWorkers.findIndex(w => w.id === worker.id);
    const total = nodeWorkers.length;

    // Cluster center is shifted downward inside the card (leaving the top half for labels)
    const centerY = nodeCoords.y + 16;

    if (total <= 1) {
      return { x: nodeCoords.x, y: centerY };
    }

    // Distribute around center in a small circular configuration
    const angle = (idx * 2 * Math.PI) / total;
    const radius = 12; // tight clustering radius
    return {
      x: nodeCoords.x + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  };

  return (
    <div className="relative w-full h-full bg-bg rounded-xl border border-border overflow-hidden shadow-2xl">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes march {
            to { stroke-dashoffset: -20; }
          }
          @keyframes pulse-danger {
            0%, 100% { opacity: 1; filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.8)); }
            50% { opacity: 0.5; filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.2)); }
          }
          @keyframes expand-hazard {
            0% { r: 20; opacity: 0.8; }
            100% { r: 90; opacity: 0; }
          }
          @keyframes beacon-pulse {
            0% { r: 5; opacity: 0.9; }
            100% { r: 18; opacity: 0; }
          }
          .evac-path {
            animation: march 0.8s linear infinite;
          }
          .danger-pulse {
            animation: pulse-danger 1s ease-in-out infinite;
          }
          .hazard-expand {
            animation: expand-hazard 2.5s ease-out infinite;
          }
          .worker-group {
            transition: transform 2s linear;
          }
          .worker-beacon {
            animation: beacon-pulse 1.6s ease-out infinite;
          }
        `
      }} />

      <svg viewBox="0 0 800 600" className="w-full h-full">
        <defs>
          <linearGradient id="normal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="danger-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a0b0b" />
            <stop offset="100%" stopColor="#3b0f0f" />
          </linearGradient>
          <linearGradient id="warning-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e150a" />
            <stop offset="100%" stopColor="#3d2a0f" />
          </linearGradient>
          <linearGradient id="exit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#062f22" />
            <stop offset="100%" stopColor="#022c22" />
          </linearGradient>

          <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Level 1: Draw Corridor Tracks ( Hallways ) */}
        <g stroke="#0f172a" strokeWidth="26" strokeLinecap="round" opacity="0.9">
          <line x1="80" y1="300" x2="240" y2="180" />
          <line x1="80" y1="300" x2="240" y2="420" />
          <line x1="240" y1="180" x2="240" y2="420" />
          <line x1="240" y1="180" x2="480" y2="300" />
          <line x1="240" y1="420" x2="480" y2="300" />
          <line x1="480" y1="300" x2="640" y2="180" />
          <line x1="480" y1="300" x2="720" y2="80" />
          <line x1="480" y1="300" x2="720" y2="520" />
          <line x1="640" y1="180" x2="720" y2="80" />
          <line x1="640" y1="180" x2="720" y2="520" />
        </g>
        <g stroke="#1e293b" strokeWidth="20" strokeLinecap="round" opacity="0.75">
          <line x1="80" y1="300" x2="240" y2="180" />
          <line x1="80" y1="300" x2="240" y2="420" />
          <line x1="240" y1="180" x2="240" y2="420" />
          <line x1="240" y1="180" x2="480" y2="300" />
          <line x1="240" y1="420" x2="480" y2="300" />
          <line x1="480" y1="300" x2="640" y2="180" />
          <line x1="480" y1="300" x2="720" y2="80" />
          <line x1="480" y1="300" x2="720" y2="520" />
          <line x1="640" y1="180" x2="720" y2="80" />
          <line x1="640" y1="180" x2="720" y2="520" />
        </g>
        <g stroke="#334155" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" opacity="0.4">
          <line x1="80" y1="300" x2="240" y2="180" />
          <line x1="80" y1="300" x2="240" y2="420" />
          <line x1="240" y1="180" x2="240" y2="420" />
          <line x1="240" y1="180" x2="480" y2="300" />
          <line x1="240" y1="420" x2="480" y2="300" />
          <line x1="480" y1="300" x2="640" y2="180" />
          <line x1="480" y1="300" x2="720" y2="80" />
          <line x1="480" y1="300" x2="720" y2="520" />
          <line x1="640" y1="180" x2="720" y2="80" />
          <line x1="640" y1="180" x2="720" y2="520" />
        </g>

        {/* Level 2: Evacuation path display */}
        {status === 'EVACUATING' && evacuationPathPoints && (
          <polyline
            points={evacuationPathPoints}
            fill="none"
            stroke="#10b981"
            strokeWidth="5"
            strokeDasharray="12 6"
            className="evac-path"
            filter="url(#glow-green)"
          />
        )}

        {/* Level 3: Draw Room Cards (Nodes) */}
        {nodes.map((node) => {
          const coords = nodeCoordinates[node.id];
          if (!coords) return null;

          const isDanger = node.status === 'danger';
          const isWarning = node.status === 'warning';
          const isExit = node.id.includes('Exit');
          
          let borderColor = '#0ea5e9'; // standard cyan
          let bgGradient = 'url(#normal-grad)';
          let statusText = 'SAFE';
          let statusColor = '#0ea5e9';
          
          if (isDanger) {
            borderColor = '#ef4444';
            bgGradient = 'url(#danger-grad)';
            statusText = 'HAZARD';
            statusColor = '#ef4444';
          } else if (isWarning) {
            borderColor = '#f59e0b';
            bgGradient = 'url(#warning-grad)';
            statusText = 'ALERT';
            statusColor = '#f59e0b';
          } else if (isExit) {
            borderColor = '#10b981';
            bgGradient = 'url(#exit-grad)';
            statusText = 'EXIT';
            statusColor = '#10b981';
          }
          
          const hasPermit = active_permits.some(p => p.zone === node.id);
          const activePermit = active_permits.find(p => p.zone === node.id);

          return (
            <g key={node.id}>
              {/* Hazard ring expansion */}
              {isDanger && (
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r="20"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  className="hazard-expand"
                />
              )}

              {/* Room Card */}
              <rect
                x={coords.x - 70}
                y={coords.y - 35}
                width="140"
                height="70"
                rx="8"
                fill={bgGradient}
                stroke={borderColor}
                strokeWidth="1.5"
                className={isDanger ? 'danger-pulse' : ''}
                filter={isDanger ? 'url(#glow-red)' : ''}
              />
              
              {/* Sector / Node label */}
              <text
                x={coords.x - 60}
                y={coords.y - 16}
                fill="#f8fafc"
                fontSize="9.5"
                fontWeight="800"
                fontFamily="sans-serif"
                letterSpacing="0.3"
              >
                {node.id}
              </text>
              
              {/* Status Badge */}
              <rect
                x={coords.x - 60}
                y={coords.y - 3}
                width="45"
                height="12"
                rx="2.5"
                fill={`${statusColor}15`}
                stroke={statusColor}
                strokeWidth="0.5"
              />
              <text
                x={coords.x - 37.5}
                y={coords.y + 6}
                textAnchor="middle"
                fill={statusColor}
                fontSize="7.5"
                fontWeight="900"
                fontFamily="monospace"
              >
                {statusText}
              </text>

              {/* Active Permit Indicator */}
              {hasPermit && activePermit && (
                <g>
                  <rect
                    x={coords.x - 8}
                    y={coords.y - 3}
                    width="68"
                    height="12"
                    rx="2.5"
                    fill="#f59e0b15"
                    stroke="#f59e0b"
                    strokeWidth="0.5"
                  />
                  <text
                    x={coords.x + 26}
                    y={coords.y + 6}
                    textAnchor="middle"
                    fill="#f59e0b"
                    fontSize="7"
                    fontWeight="800"
                    fontFamily="monospace"
                  >
                    {activePermit.type.toUpperCase()}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Level 4: Draw Workers (As clustered telemetry beacons) */}
        {workers.map((worker) => {
          const coords = getWorkerPosition(worker);
          const isEvacuating = worker.status === 'evacuating';
          const workerColor = isEvacuating ? '#ef4444' : '#3b82f6';
          
          return (
            <g
              key={worker.id}
              transform={`translate(${coords.x}, ${coords.y})`}
              className="worker-group"
            >
              {/* Pulsing signal wave */}
              <circle
                cx="0"
                cy="0"
                r="10"
                fill="none"
                stroke={workerColor}
                strokeWidth="1.5"
                className="worker-beacon"
              />
              
              {/* Inner beacon core */}
              <circle
                cx="0"
                cy="0"
                r="5.5"
                fill={workerColor}
                stroke="#ffffff"
                strokeWidth="1.5"
                filter={isEvacuating ? 'url(#glow-red)' : 'url(#glow-cyan)'}
              />
              
              {/* Worker ID Badge tag below the dot to avoid overlapping text */}
              <g>
                <rect
                  x="-13"
                  y="9"
                  width="26"
                  height="11"
                  rx="3"
                  fill="#0b0f19"
                  stroke={workerColor}
                  strokeWidth="1"
                  opacity="0.95"
                />
                <text
                  x="0"
                  y="17"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="7"
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
