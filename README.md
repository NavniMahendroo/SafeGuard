# 🛡️ SafeGuard: AI-Powered Industrial Safety Intelligence Platform

> **"Intelligence that prevents the unthinkable."**
> 
> *An event-driven industrial safety platform combining real-time IoT telemetry, compound risk fusion engines, ML anomaly detection, lead time prediction, regulatory RAG, and dynamic graph-theoretic evacuation routing (A*) to protect personnel in high-hazard industrial environments.*

---

## ⚡ Overview

SafeGuard is a comprehensive safety intelligence system for industrial facilities that fuses live sensor data with work permit registries to detect compound hazards and trigger automated evacuation protocols. The system includes:

- **Real-time Telemetry Simulation**: Digital twin of factory floor with gas, temperature, and pressure sensors
- **Compound Risk Engine**: Multi-rule evaluation against regulatory standards (OISD-STD-137, FACTORY-ACT-SEC-36, DGMS-THERMAL-STRESS)
- **ML Anomaly Detection**: Isolation Forest for detecting abnormal sensor patterns
- **Lead Time Prediction**: Linear regression to predict time to critical threshold breach
- **Regulatory RAG**: Sentence-transformers + FAISS for retrieving relevant regulations
- **Dynamic A* Pathfinding**: NetworkX-based evacuation routing with dynamic hazard penalization
- **Flight Data Recorder**: Audit snapshots with RAG context for incident analysis

---

## 🛰️ System Architecture

```mermaid
graph TD
    A[IoT Sensors] -->|Telemetry| B[FastAPI Backend]
    C[React Frontend] -->|WebSocket| B
    C -->|REST API| B
    B -->|Async Queries| D[PostgreSQL]
    B -->|ML Inference| E[Anomaly Detector]
    B -->|Prediction| F[Lead Time Predictor]
    B -->|RAG Query| G[Regulatory RAG]
    B -->|Pathfinding| H[NetworkX Graph]
    B -->|Audit Logs| I["/audits/ JSON Files"]
```

### Tech Stack

**Backend (Python/FastAPI):**
- FastAPI with WebSockets for real-time telemetry broadcast
- PostgreSQL with SQLAlchemy async for data persistence
- NetworkX for graph modeling and A* pathfinding
- scikit-learn Isolation Forest for anomaly detection
- NumPy for lead time prediction (linear regression)
- sentence-transformers + FAISS for regulatory RAG

**Frontend (React/Vite):**
- React 18 with Vite for fast development
- Zustand for state management with auto-reconnecting WebSocket
- Tailwind CSS with industrial dark theme
- Lucide React for icons
- Native SVG for floor layout rendering

**Infrastructure:**
- Docker Compose with 3 services (PostgreSQL, Backend, Frontend)
- Nginx for frontend serving and API proxying

---

## 🗂️ Project Structure

```bash
SafeGuard/
├── app/                          # Backend package
│   ├── __init__.py
│   ├── main.py                   # FastAPI app, WebSocket, REST endpoints
│   ├── models.py                 # SQLAlchemy async models (Permit, Incident, Worker)
│   ├── engine.py                 # NetworkX graph, A* pathfinding, compound risk rules
│   ├── simulator.py              # Async telemetry simulation loop
│   ├── anomaly.py               # Isolation Forest anomaly detector
│   ├── predictor.py             # Lead time prediction (polyfit)
│   ├── rag.py                   # Regulatory RAG (sentence-transformers + FAISS)
│   └── audit.py                 # Flight data recorder with RAG context
├── audits/                       # Generated incident audit JSON files
├── requirements.txt              # Python dependencies
├── Dockerfile                    # Backend Docker image
├── docker-compose.yml           # Multi-service orchestration
├── README.md
└── frontend/                     # React frontend
    ├── package.json
    ├── Dockerfile
    ├── nginx.conf
    ├── tailwind.config.js
    ├── vite.config.js
    └── src/
        ├── App.jsx               # Landing page with radar pulse
        ├── store.js              # Zustand store with WebSocket
        ├── CommandCenter.jsx     # Main dashboard grid layout
        ├── FloorLayoutSchematic.jsx  # SVG floor map with exact coordinates
        └── index.css
```

---

## 🚀 Quick Start (Docker Compose)

### Prerequisites
- Docker Desktop installed and running
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd SafeGuard
```

2. Start all services:
```bash
docker-compose up --build
```

This will build and start:
- **PostgreSQL** on port 5432
- **FastAPI Backend** on port 8000
- **React Frontend** on port 80

3. Open your browser:
- Navigate to `http://localhost`
- You'll see the SafeGuard landing page with radar pulse animation
- Click "Enter Command Center" to access the dashboard

---

## 🎮 Verification Checklist

Once the system is running, verify the following:

### Backend Verification
- [ ] Health check passes: `curl http://localhost:8000/health` → `{"status": "healthy"}`
- [ ] WebSocket connects and telemetry flows every 2 seconds
- [ ] Compound risk rule triggers at correct thresholds (gas > 12% with Hot Work permit)
- [ ] A* reroutes correctly when hazard node is penalized
- [ ] Isolation Forest returns negative score on anomalous input
- [ ] Lead time predictor returns float when gas is trending up
- [ ] RAG retrieves correct regulation for "gas explosion hot work"
- [ ] Audit JSON written to `/audits/` with `rag_context` and `anomaly_score` fields

### Frontend Verification
- [ ] Landing page renders with radar pulse animation
- [ ] WebSocket connects (green "WS: CONNECTED" indicator)
- [ ] SVG floor map renders with correct node positions
- [ ] Workers displayed as blue tracking beacons
- [ ] Telemetry dials show live gas/temperature/pressure values

### End-to-End Evacuation Demo
1. **Normal State**: Gas levels at safe baseline (~4%), workers moving normally
2. **Issue Permit**: Select "Gas Storage Zone" → "Hot Work" → Click "AUTHORIZE"
3. **Gas Rise**: Wait for gas to drift upward (simulated with Hot Work permit)
4. **Lead Time Warning**: Countdown appears when gas trending toward 12% threshold
5. **EVACUATING State**: Gas exceeds 12% → System triggers evacuation
6. **Evacuation Path**: Green polyline appears on SVG map showing A* escape route
7. **Worker Rerouting**: Workers move away from hazard zone
8. **Revoke Permit**: Click "REVOKE" on the permit
9. **Cooldown**: 30-second cooldown timer appears
10. **Normal Return**: System returns to NORMAL state after cooldown

### Audit Verification
- [ ] `/audits/` directory contains at least one JSON file
- [ ] Audit file includes: `timestamp`, `gas_level`, `temperature`, `triggered_rules`, `rag_context`, `anomaly_score`, `lead_time_at_trigger`

---

## 📋 Compound Risk Rules

SafeGuard evaluates three regulatory standards:

| Rule ID | Standard | Trigger Conditions | Action |
|---------|----------|-------------------|--------|
| OISD-STD-137 | Work Permit System in Hazardous Areas | Gas > 12.0% AND Hot Work permit active AND workers in zone > 0 | Evacuate immediately |
| FACTORY-ACT-SEC-36 | Factory Act Section 36 | Gas > 8.0% AND Confined Space permit active AND workers in zone > 2 | Evacuate and reduce occupancy |
| DGMS-THERMAL-STRESS | DGMS Technical Circular | Temperature > 65.0°C AND Cold Work permit active | Cease work and cool down equipment |

---

## 🔧 Manual Development Setup

### Backend (Local Development)

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\Activate.ps1
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure the database:
- **SQLite (Zero-Config Fallback)**: If `DATABASE_URL` is omitted, the platform automatically initializes a local SQLite database file at `./safeguard.db`. No manual setup is required.
- **PostgreSQL (Optional)**: If you prefer using PostgreSQL for local runs, set the environment variable:
  ```bash
  export DATABASE_URL="postgresql+asyncpg://admin:safeguard@localhost:5432/safeguard"
  ```

4. Run backend:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Local Development)

1. Navigate to frontend:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run dev server:
```bash
npm run dev
```

Open `http://localhost:5173`

---

## 🔌 API Endpoints

### WebSocket
- `GET /ws` - Real-time telemetry broadcast (every 2 seconds)

### REST API
- `POST /api/permits` - Issue new permit `{type, zone}`
- `DELETE /api/permits/{permit_id}` - Revoke permit
- `GET /api/permits` - List active permits
- `POST /api/resolve` - Manual override to reset to NORMAL
- `GET /api/incidents` - List incident history
- `GET /api/insights` - Get violation distribution analytics
- `GET /api/audit/{incident_id}` - Fetch audit snapshot JSON
- `GET /health` - Health check

---

## 📊 WebSocket Payload Structure

```json
{
  "status": "NORMAL|EVACUATING|COOLDOWN",
  "timestamp": "2025-01-15T10:30:00Z",
  "telemetry": {
    "gas_level": 4.0,
    "temperature": 32.0,
    "pressure": 1.8,
    "anomaly_score": 0.5
  },
  "lead_time_minutes": null,
  "workers": [
    {"id": "W1", "node": "Assembly Line A", "x": 240, "y": 180, "status": "normal"}
  ],
  "active_permits": [
    {"id": 1, "type": "Hot Work", "zone": "Gas Storage Zone", "issued_at": "..."}
  ],
  "triggered_rules": [],
  "evacuation_paths": {},
  "nodes": [
    {"id": "Entry Gate", "x": 80, "y": 300, "is_exit": false}
  ],
  "cooldown_seconds_remaining": 0
}
```

---

## 🗺️ Factory Floor Layout

The factory is modeled as a NetworkX DiGraph with the following node coordinates:

| Node | X | Y | Type |
|------|---|---|------|
| Entry Gate | 80 | 300 | Entry |
| Assembly Line A | 240 | 180 | Work Zone |
| Assembly Line B | 240 | 420 | Work Zone |
| Gas Storage Zone | 480 | 300 | Hazard Zone |
| Control Room | 640 | 180 | Work Zone |
| Exit North | 720 | 80 | Exit |
| Exit South | 720 | 520 | Exit |

---

## 🧪 ML Components

### Anomaly Detection
- **Model**: Isolation Forest (scikit-learn)
- **Contamination**: 0.1
- **Features**: [gas_level, temperature, pressure, worker_count]
- **Training**: Synthetic normal data (gas 0-8%, temp 20-50°C, pressure 1-3 bar)
- **Output**: Anomaly score (negative = anomalous, positive = normal)

### Lead Time Prediction
- **Model**: Linear regression (numpy.polyfit degree 1)
- **Window Size**: 10 readings
- **Critical Threshold**: 12.0% gas level
- **Output**: Minutes until threshold breach (null if not trending up)

### Regulatory RAG
- **Embedding Model**: all-MiniLM-L6-v2 (sentence-transformers)
- **Vector Index**: FAISS (CPU)
- **Regulations**: Pre-loaded industrial safety standards
- **Query**: Natural language description of incident
- **Output**: Top-k relevant regulatory texts

---

## 📝 License

This project is built for demonstration and educational purposes.

---

## 🤝 Contributing

This is a demonstration project. For production use, consider:
- Adding authentication/authorization
- Implementing proper error handling and logging
- Adding unit and integration tests
- Configuring production-grade database backups
- Implementing proper SSL/TLS for WebSocket connections
