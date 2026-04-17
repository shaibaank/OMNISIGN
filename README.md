HELLFUCKINGYES

# OmniSign 🤟

**Bidirectional 3D Sign Language Translation Ecosystem**

> Breaking the "Silence Barrier" by creating a seamless, real-time digital interpreter for inclusive public and private spaces.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│              OmniSign Orchestrator (FastAPI :8000)      │
└──────┬──────────────┬───────────────┬──────────────────┘
       │              │               │
  [Agent 1]      [Agent 2]       [Agent 3]       [Agent 4]
 Gesture→Text   Syntax Bridge   Neural Signer    Ubiquity UI
 :8001           :8002           :8003            :5173
```

## Quick Start

### Docker (Recommended)
```bash
docker compose up --build
```

### Local Development
```bash
# Terminal 1: Agent 1
cd agent1_gesture && pip install -r requirements.txt && uvicorn main:app --port 8001

# Terminal 2: Agent 2
cd agent2_syntax && pip install -r requirements.txt && uvicorn main:app --port 8002

# Terminal 3: Agent 3
cd agent3_signer && pip install -r requirements.txt && uvicorn main:app --port 8003

# Terminal 4: Orchestrator
cd orchestrator && pip install -r requirements.txt && uvicorn main:app --port 8000

# Terminal 5: Frontend
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**

## Features

- **Bidirectional Translation** — Sign-to-Text AND Text-to-Sign
- **3D Avatar** with Non-Manual Markers (facial expressions)
- **MediaPipe WASM** — runs entirely in browser, no GPU required
- **Three Deployment Modes** — Desktop, ATM, Hospital, Video Call
- **Microservice Architecture** — each agent is independently deployable
- **PWA** — installable on any device

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Three.js |
| Backend | FastAPI (Python) |
| ML (Client) | MediaPipe WASM |
| ML (Server) | ONNX Runtime / Geometric fallback |
| 3D Rendering | Three.js WebGL |
| Deployment | Docker Compose |
