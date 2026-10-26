# MentorLens Operations Runbook

## 1. Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node 20+
- Docker & Docker Compose (optional for full containerized stack)

### Starting Backend Locally
```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload --port 8000
```

### Starting Frontend Locally
```bash
cd frontend
npm install
npm run dev
```

### Starting Full Stack with Docker
```bash
docker compose up -d
```

## 2. Health & Readiness Verification
- **Liveness:** `GET http://localhost:8000/health`
- **Readiness:** `GET http://localhost:8000/ready`
