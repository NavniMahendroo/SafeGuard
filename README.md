# 🛡️ SafeGuard: AI-Powered Industrial Safety Intelligence Platform

> **"Intelligence that prevents the unthinkable."**
> 
> *An event-driven industrial safety platform combining real-time IoT telemetry, compound risk fusion engines, ML anomaly detection, lead time prediction, regulatory RAG, and dynamic graph-theoretic evacuation routing (A*) to protect personnel in high-hazard industrial environments.*

---

## ⚡ Overview

SafeGuard is a comprehensive safety intelligence system for industrial facilities that fuses live sensor data with work permit registries to detect compound hazards and trigger automated evacuation protocols. The system includes:

- **Real-time Telemetry Simulation**: Digital twin of factory floor with gas, temperature, and pressure sensors.
- **Compound Risk Engine**: Multi-rule evaluation against regulatory standards (OISD-STD-137, FACTORY-ACT-SEC-36, DGMS-THERMAL-STRESS).
- **ML Anomaly Detection**: Isolation Forest for detecting abnormal sensor patterns.
- **Lead Time Prediction**: Linear regression to predict time to critical threshold breach.
- **Regulatory RAG**: Sentence-transformers + FAISS for retrieving relevant regulations.
- **Dynamic A* Pathfinding**: NetworkX-based evacuation routing with complete incoming/outgoing edge hazard penalization.
- **Flight Data Recorder & Audit Logs**: Generates and persists JSON audit snapshots with RAG safety context.
- **Self-Healing Reconnections**: Auto-reconnect with exponential backoff on connection drops and dual-stack IPv4/IPv6 host rotations.
- **One-Click Demo Reset**: Instantly returns database permits, incident ledgers, and telemetry coordinates back to clean baselines.
- **Platform Benchmarks**: A built-in time-series scenario simulation suite to run pipeline evaluations.

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
- PostgreSQL with SQLAlchemy async for data persistence (with SQLite fallback)
- NetworkX for graph modeling and A* pathfinding
- scikit-learn Isolation Forest for anomaly detection
- NumPy for lead time prediction (linear regression)
- sentence-transformers + FAISS for regulatory RAG
- tabulate (with custom text fallbacks) for formatting statistics

**Frontend (React/Vite):**
- React 18 with Vite for fast development
- Zustand for state management with exponential backoff WebSocket re-establishment
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
│   ├── main.py                   # FastAPI app, WebSocket, REST endpoints, and Reset Actions
│   ├── models.py                 # SQLAlchemy async models (Permit, Incident, Worker)
│   ├── engine.py                 # NetworkX graph, A* pathfinding, compound risk rules
│   ├── simulator.py              # Async telemetry simulation loop
│   ├── anomaly.py               # Isolation Forest anomaly detector
│   ├── predictor.py             # Lead time prediction (polyfit)
│   ├── rag.py                   # Regulatory RAG (sentence-transformers + FAISS)
│   ├── audit.py                 # Flight data recorder with RAG context
│   └── benchmark.py              # Performance evaluation benchmark suite
├── audits/                       # Generated incident audit JSON files
├── requirements.txt              # Python dependencies (added tabulate)
├── benchmark_results.json        # Raw benchmark statistics JSON file
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
        ├── store.js              # Zustand store with reconnect logic & reset actions
        ├── CommandCenter.jsx     # Main dashboard grid layout & RAG logs card
        ├── FloorLayoutSchematic.jsx  # SVG floor map with coordinate transitions
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
- Click "Enter Command Center" to access the dashboard.

---

## 🎮 Verification Checklist

### Backend Verification
- [x] Health check passes: `curl http://localhost:8000/health` → `{"status": "healthy"}`
- [x] WebSocket connects and telemetry flows every 2 seconds
- [x] Compound risk rule triggers at correct thresholds (gas > 12% with Hot Work permit)
- [x] A* reroutes correctly when hazard node is penalized (both incoming and outgoing directions blocked)
- [x] Isolation Forest returns negative score on anomalous input
- [x] Lead time predictor returns float when gas is trending up
- [x] RAG retrieves correct regulation for "gas explosion hot work" (`OISD-STD-137`)
- [x] Audit JSON written to `/audits/` with `rag_context` and `anomaly_score` fields

### Frontend Verification
- [x] Landing page renders with radar pulse animation
- [x] WebSocket connects (green "WS: CONNECTED" indicator)
- [x] Reconnect actions handle backoffs cleanly and display warning banner on disconnection
- [x] SVG floor map renders with room labels and coordinate transitions
- [x] Workers displayed as blue tracking beacons with radar pulses
- [x] Telemetry dials show live gas/temperature/pressure values
- [x] One-Click Reset Demo button displays bottom-right toast on trigger

### End-to-End Evacuation Demo
1. **Normal State**: Gas levels at safe baseline (~4%), workers moving normally.
2. **Issue Permit**: Select "Gas Storage Zone" → "Hot Work" → Click "AUTHORIZE".
3. **Gas Rise**: Wait for gas to drift upward (simulated with Hot Work permit).
4. **Lead Time Warning**: Countdown appears when gas trending toward 12% threshold.
5. **EVACUATING State**: Gas exceeds 12% → System triggers evacuation.
6. **Evacuation Path**: Green polyline appears on SVG map showing A* escape route.
7. **Worker Rerouting**: Workers move away from hazard zone.
8. **Revoke Permit**: Click "REVOKE" on the permit.
9. **Cooldown**: 30-second cooldown timer appears.
10. **Normal Return**: System returns to NORMAL state after cooldown, workers return to regular duties.
11. **Reset Demo**: Click "RESET DEMO" in the header to instantly reset telemetry, permits, and database logs back to baseline.

---

## 📋 Compound Risk Rules

SafeGuard evaluates three regulatory standards:

| Rule ID | Standard | Trigger Conditions | Action |
|---------|----------|-------------------|--------|
| OISD-STD-137 | Work Permit System in Hazardous Areas | Gas > 12.0% AND Hot Work permit active AND workers in zone > 0 | Evacuate immediately |
| FACTORY-ACT-SEC-36 | Factory Act Section 36 | Gas > 8.0% AND Confined Space permit active AND workers in zone > 2 | Evacuate and reduce occupancy |
| DGMS-THERMAL-STRESS | DGMS Technical Circular | Temperature > 65.0°C AND Cold Work permit active | Cease work and cool down equipment |

---

## 🧪 ML & Analytics Components

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
- **Query**: Semantically descriptive natural language (e.g. *"Explosion risk due to high gas level during active Hot Work permit..."*)
- **Output**: Top-k relevant regulatory texts (ranks `OISD-STD-137` as top match)

### 📊 System Performance Benchmark (`app/benchmark.py`)
SafeGuard includes a benchmarking tool that evaluates the pipeline accuracy using a test set of **230 synthetic time-series scenarios**:

```grid
+------------------------------------+----------------+--------------------+
| Metric                             | Naive Baseline | SafeGuard Pipeline |
+------------------------------------+----------------+--------------------+
| True Positive Rate (Recall)        | 80.0%          | 100.0%             |
| False Negative Rate                | 20.0%          | 0.0%               |
| False Positive Rate (False Alarms) | 31.2%          | 68.8%              |
| Total Scenarios Evaluated          | 230            | 230                |
| True Incidents Caught              | 120/150        | 150/150            |
| False Alarms Triggered             | 25/80          | 55/80              |
+------------------------------------+----------------+--------------------+
```

Run the benchmark manually via CLI:
```bash
python -m app.benchmark
```

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
- **SQLite (Zero-Config Fallback)**: If `DATABASE_URL` is omitted, the platform automatically initializes a local SQLite database file at `./safeguard.db`.
- **PostgreSQL (Optional)**: If you prefer using PostgreSQL, set the environment variable:
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
- `POST /api/resolve` - Manual override to reset status to NORMAL
- `POST /api/reset` - Demo-ready baseline reset (revokes permits, resolves incidents, resets coordinates)
- `GET /api/incidents` - List incident history
- `GET /api/insights` - Get violation distribution analytics
- `GET /api/audit/{incident_id}` - Fetch audit snapshot JSON
- `GET /health` - Health check
