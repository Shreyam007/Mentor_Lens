# MentorLens Operations Runbook

## 1. Quick Start (Local & Production)

### Local Development
```bash
# 1. Backend
.\.venv\Scripts\activate
$env:PYTHONPATH="backend"
uvicorn app.main:app --app-dir backend --reload --port 8000

# 2. Frontend
cd frontend
npm.cmd run dev
```

### Full Containerized Stack
```bash
docker compose up -d
# Access web dashboard at http://localhost:5173
# API & Swagger docs at http://localhost:8000/docs
```

---

## 2. Health & Monitoring Probes

| Probe | Endpoint | Expected Response | Remediation if Failing |
|---|---|---|---|
| **Liveness** | `GET /health` | `HTTP 200 {"status": "ok"}` | Process stuck; restart container |
| **Readiness** | `GET /ready` | `HTTP 200 {"status": "ready"}` | Checks DB, Redis, Chroma. Returns 503 if downstream unreachable |
| **Prometheus Metrics** | `GET /metrics` | `HTTP 200 (text/plain)` | Scraped by Prometheus for Grafana dashboards |

---

## 3. Secret Rotation Procedures

### A. GitHub App Private Key Rotation
1. Generate a new private key in GitHub App settings (`Settings` > `Developer settings` > `GitHub Apps` > `MentorLens` > `Generate private key`).
2. Update `GITHUB_APP_PRIVATE_KEY` in production environment / vault.
3. Restart backend workers. The JWT generator will immediately sign installation token requests with the new key.
4. Verify by calling `GET /ready` and testing a test webhook delivery.
5. Delete the old private key from GitHub App settings.

### B. Webhook Secret Rotation
1. Update webhook secret in GitHub App settings.
2. Update `GITHUB_WEBHOOK_SECRET` in production `.env`.
3. Restart backend service. Webhook verification uses constant-time HMAC-SHA256 comparison and will validate incoming payloads against the new secret.

### C. Session Cookie Key Rotation
1. Update `SECRET_KEY` in backend config.
2. Existing active cookie sessions will invalidate cleanly and redirect users to OAuth login (S01) without crashing.

---

## 4. Webhook Redelivery & Queue Recovery

### Automatic Retries
- Failed review runs are queued up to 3 times with exponential backoff via Redis/ARQ.
- If Redis is temporarily down, review state is preserved in the database.

### Manual Redelivery via Dashboard
1. Navigate to **S13 Settings: Integrations** (`/settings/integrations`).
2. Locate the failed delivery in the Webhook Deliveries audit table.
3. Click **Redeliver**.
4. Alternatively, use the API:
   ```bash
   curl -X POST "http://localhost:8000/api/settings/integrations/webhooks/{delivery_id}/redeliver" \
     -H "Cookie: ml_session=<admin_token>"
   ```

---

## 5. Repository Re-Indexing & Force-Push Recovery

### Triggering Re-Index
- When a repository's default branch receives significant bug fixes or history updates:
  ```bash
  curl -X POST "http://localhost:8000/api/repos/{repo_id}/index" \
    -H "Cookie: ml_session=<lead_token>"
  ```
- SSE progress stream is viewable in real-time on **S03 Indexing Progress** (`/onboarding/index`).

### History Rewritten (Force-Push) Handling
1. If history was rewritten on a monitored branch, commits that no longer exist on GitHub are flagged as stale.
2. The team memory store marks them with `is_stale: true`, excluding them from citation retrieval.
3. To purge stale vector embeddings entirely and trigger a clean backfill:
   - Use S08 Memory Explorer (`/memory`) -> Click "Re-sync Repository History".

---

## 6. Outage & Degraded Mode Recovery

### LLM API Down / 5xx
- **Behavior:** Multi-agent pipeline falls back automatically to static analysis (Bandit + Pylint) with a prominent banner on S06 PR review detail: *"Static Analysis Only: AI Explainer temporarily unavailable"*.
- **Recovery:** Once LLM API recovers, subsequent PR reviews automatically resume full pedagogical explanations.

### Database or Redis Outage
- **Behavior:** `/ready` returns `HTTP 503 Service Unavailable`.
- **Recovery:** Restart Redis / PostgreSQL containers (`docker compose restart redis db`). ARQ workers automatically reconnect with jitter.
