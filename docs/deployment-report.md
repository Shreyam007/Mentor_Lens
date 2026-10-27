# MentorLens v1.0.0 — Production Deployment & Operations Guide

> **Release Tag:** `v1.0.0`  
> **GitHub Repository:** `https://github.com/Shreyam007/Mentor_Lens.git`  
> **Production Branch:** `main`  
> **Date:** October 28, 2026  

---

## 1. Architecture Overview

MentorLens is architected for zero-downtime, independent horizontal scaling:
- **Frontend:** Static SPA built with React 18, TypeScript, and Vite. Deployed to Vercel with custom Neo-Brutalist routing, reverse proxy rewrites, and asset caching.
  - **Live URL:** `https://mentorlens-nine.vercel.app`
  - **Deployment ID:** `dpl_4yyhzKHrQk5MT8VG3gNGtLD5oP7a`
- **Backend API:** FastAPI (ASGI) running on Python 3.11+ / Uvicorn. Deployed on Render with automated health checks (`/health`, `/ready`).
  - **Live API Endpoint:** `https://mentor-lens.onrender.com`
- **Data Tier:**
  - **Relational:** PostgreSQL (or persistent SQLite for single-node deployments).
  - **Cache & Rate Limiting:** Redis 7+ for distributed tiered rate limits and fair worker queueing.
  - **Vector Database:** ChromaDB in persistent embedded mode storing sanitized historical bugfix embeddings.

---

## 2. Frontend Deployment (Vercel)

### CLI Deployment
1. Authenticate Vercel CLI:
   ```bash
   vercel login
   ```
2. Navigate to `frontend/`:
   ```bash
   cd frontend
   vercel link --project mentorlens --yes
   ```
3. Trigger production build & deployment:
   ```bash
   vercel --prod --yes
   ```

### Output Configuration
The `frontend/vercel.json` ensures client-side routing fallback:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 3. Backend Deployment (Render / Railway / Docker)

### Environment Variables
Configure the following in the host environment:
```ini
ENVIRONMENT=production
PROJECT_NAME="MentorLens"
VERSION="1.0.0"
LOG_LEVEL="INFO"
BACKEND_URL="https://api.mentorlens.dev"
FRONTEND_URL="https://mentorlens.dev"
ALLOWED_ORIGINS=["https://mentorlens.dev"]
SECRET_KEY="<strong-random-hex-string-at-least-32-bytes>"
DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/mentorlens"
REDIS_URL="rediss://default:pass@host:6379"
ENFORCE_REDIS_RATE_LIMIT=true
GITHUB_APP_ID="123456"
GITHUB_CLIENT_ID="<client-id>"
GITHUB_CLIENT_SECRET="<client-secret>"
GITHUB_WEBHOOK_SECRET="<webhook-secret>"
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
OPENAI_API_KEY="sk-..."
MONTHLY_LLM_COST_CAP_USD=100.00
```

### Health Check Endpoints
- **Liveness:** `GET /health` (returns 200 `{"status": "ok"}`)
- **Readiness:** `GET /ready` (validates database connection and vector store before receiving traffic)
- **Metrics:** `GET /metrics` (Prometheus-formatted metrics for Prometheus/Grafana)

---

## 4. Live Smoke Testing Protocol

Execute the following checks against the production deployment:

1. **Health Verification:**
   ```bash
   curl -i https://api.mentorlens.dev/health
   # Expected: 200 OK, X-Request-ID header, nosniff, DENY, CSP headers
   ```
2. **Rate Limit Headers:**
   ```bash
   curl -i https://api.mentorlens.dev/health
   # Expected: X-RateLimit-Limit: 60, X-RateLimit-Remaining: 59, X-RateLimit-Reset: <timestamp>
   ```
3. **Double Submit Anti-CSRF Check:**
   ```bash
   curl -i -X POST https://api.mentorlens.dev/api/demo/reset -H "Cookie: ml_csrf=test_token"
   # Expected: 403 Forbidden (CSRF_TOKEN_MISMATCH)
   ```
4. **Clean 401 Envelope Check:**
   ```bash
   curl -i https://api.mentorlens.dev/api/auth/me
   # Expected: 401 Unauthorized with clean JSON error envelope and X-Request-ID, 0 tracebacks
   ```
5. **SSRF Guard Validation:**
   Ensure webhooks or integrations targeting internal IP addresses (`127.0.0.1`, `169.254.169.254`) return 400 Bad Request with `SSRF_ATTEMPT_BLOCKED`.
