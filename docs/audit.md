# MentorLens Security & Architecture Audit Report

**Date:** 2026-10-28  
**Scope:** ANTIGRAVITY.md Section 4, Phase 1 (Redis limiter, 429 headers, fail-closed auth tier), SEC-01..SEC-20, and Edge-Case Matrix rows 31–40.  
**Auditor:** MentorLens Lead Engineer  
**Status Legend:**  
- `[IMPLEMENTED]` Fully implemented with automated tests and production code.  
- `[PARTIAL]` Partially implemented or lacks runtime enforcement / complete test coverage.  
- `[MISSING]` Not yet implemented; requires implementation in Step 2.

---

## 1. Rate Limiting & Phase 1 Specifications Audit

| Item | Requirement | Status | File Paths | Current State & Gaps |
|---|---|:---:|---|---|
| **RL-01** | **Tiered Redis Rate Limiter** | `[PARTIAL]` | `backend/app/core/errors.py`, `backend/app/api/` | `RateLimitExceededError` defined in `errors.py`. Redis client available in `backend/app/api/health.py`, but automated per-route tiered limiter dependency/middleware across all API routes is not yet attached. |
| **RL-02** | **429 Response Headers** | `[PARTIAL]` | `backend/app/core/errors.py`, `backend/app/main.py` | `429` status code mapped in exception handler, but standard `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers are not dynamically emitted. |
| **RL-03** | **Fail-Closed Auth Tier** | `[MISSING]` | `backend/app/api/auth.py` | Auth routes (`/api/auth/*`) currently authenticate via JWT without verifying that the Redis rate limiter is active; if Redis is down, auth routes must fail-closed (reject with 503/429) while public read routes fail-open. |
| **RL-04** | **Exhaustive Route Coverage Test** | `[MISSING]` | `backend/tests/` | Needs a test that inspects `app.routes` and fails if any API route lacks an explicit rate-limit tier declaration. |
| **RL-05** | **Outbound GitHub Budgeting** | `[IMPLEMENTED]` | `backend/app/github/client.py:L43-L48`, `backend/tests/edge_cases/test_matrix.py:L242` | Primary and secondary rate limits detected; `Retry-After` header honored with delayed backoff. |
| **RL-06** | **Outbound LLM Cost Budgeting** | `[IMPLEMENTED]` | `backend/app/api/settings.py:L83-L93`, `backend/tests/edge_cases/test_matrix.py:L333` | Monthly spend tracked against `settings.MONTHLY_COST_CAP_USD`; switches to static-only mode when cap is exceeded. |
| **RL-07** | **429 UI Countdown Timer** | `[PARTIAL]` | `frontend/src/pages/SystemStates.tsx:L194-L215`, `frontend/src/pages/SettingsIntegrations.tsx` | UI includes the 429 countdown frame and status display; needs global Axios/Fetch response interceptor in `api.ts` to trigger the countdown modal upon receiving 429 on any API call. |

---

## 2. SEC-01 through SEC-20 Security Controls Matrix

| Control | Name | Status | File Paths | Details & Findings |
|---|---|:---:|---|---|
| **SEC-01** | Constant-Time Signature Verification | `[IMPLEMENTED]` | `backend/app/core/security.py:L24-L31`, `backend/app/github/webhook.py:L47-L55` | `hmac.compare_digest` used on raw payload bytes before JSON parsing. Returns 401 on failure. |
| **SEC-02** | Webhook Payload Size Limit | `[IMPLEMENTED]` | `backend/app/github/webhook.py:L31-L44` | Enforces 5 MB ceiling via `Content-Length` and `len(body_bytes)`. Returns 413. |
| **SEC-03** | Webhook Idempotency (Anti-Replay) | `[IMPLEMENTED]` | `backend/app/github/webhook.py:L61-L82`, `backend/tests/edge_cases/test_matrix.py:L35` | Tracks `X-GitHub-Delivery` in `webhook_deliveries`; duplicate delivery acknowledges with 200 without re-enqueuing. |
| **SEC-04** | Tiered Redis Limiter on All Routes | `[MISSING]` | `backend/app/core/rate_limit.py` | Needs implementation in `app/core/rate_limit.py` attached to every FastAPI router. |
| **SEC-05** | Fail-Closed Auth Tier on Outage | `[MISSING]` | `backend/app/api/auth.py` | Rate limiter must fail-closed for authentication/mutation, and fail-open for public read paths. |
| **SEC-06** | CSRF Protection on Mutating Routes | `[PARTIAL]` | `backend/app/api/auth.py:L97-L116`, `backend/app/core/security.py:L14` | Generates `ml_csrf` cookie on OAuth callback, but lacks middleware verifying `X-CSRF-Token` header on `POST/PUT/DELETE`. |
| **SEC-07** | Secure Session Cookie Architecture | `[IMPLEMENTED]` | `backend/app/api/auth.py:L100-L107`, `backend/app/core/config.py:L33` | Emits `ml_session` with `HttpOnly=True`, `Secure=True` (in prod), `SameSite=Lax`. |
| **SEC-08** | Least-Privilege GitHub App Permissions | `[IMPLEMENTED]` | `backend/app/api/settings.py:L71`, `docs/architecture.md:L116` | Documented and verified: PRs (read/write), Contents (read), Metadata (read), Checks (write). |
| **SEC-09** | Sandboxed Static Analysis | `[IMPLEMENTED]` | `backend/app/analysis/runner.py:L108-L168` | Executes in isolated tempdir; AST pre-parsed; never executes PR code; 15s timeout and 1MB stdout cap. |
| **SEC-10** | Untrusted PR Content Isolation | `[IMPLEMENTED]` | `backend/app/agents/prompts.py:L54-L67`, `backend/tests/edge_cases/test_matrix.py:L218` | All PR code and metadata encapsulated inside `<UNTRUSTED_PR_CONTENT>` tags; prompt directives prohibit command execution. |
| **SEC-11** | Secret Redaction Before LLM & RAG | `[IMPLEMENTED]` | `backend/app/rag/redaction.py`, `backend/tests/test_rag.py:L17` | Regex patterns redact AWS keys, GitHub tokens, Anthropic/OpenAI keys, Slack tokens, private keys, passwords. |
| **SEC-12** | Zero Unverified Citations (Verifier Gate) | `[IMPLEMENTED]` | `backend/app/agents/verifier.py`, `backend/tests/edge_cases/test_matrix.py:L148` | Deterministic verifier checks SHA existence, embedding similarity (≥ 0.40), and diff lines. Strips unverified citations fail-closed. |
| **SEC-13** | SQL Injection Prevention (ORM Exclusivity) | `[IMPLEMENTED]` | `backend/app/db/`, `backend/app/api/` | All queries use SQLAlchemy 2.0 async ORM with parameterized bindings; zero raw SQL concatenation. |
| **SEC-14** | Cross-Site Scripting (XSS) Prevention | `[IMPLEMENTED]` | `backend/app/github/poster.py:L20-L80`, `frontend/src/` | React escapes HTML; markdown comments sanitize backticks and HTML tags; diff viewer uses safe code blocks. |
| **SEC-15** | Server-Side Request Forgery (SSRF) Guard | `[MISSING]` | `backend/app/core/security.py`, `backend/app/github/client.py` | Needs validator blocking outbound requests to loopback (`127.0.0.1`), private RFC1918 subnets, and AWS/cloud metadata (`169.254.169.254`). |
| **SEC-16** | IDOR & Multi-Tenant Boundary Isolation | `[PARTIAL]` | `backend/app/api/prs.py`, `backend/app/api/repos.py` | Repositories filtered by installation, but explicit tenant boundary check verifying PR belongs to caller's repo needs fortification. |
| **SEC-17** | Role-Based Access Control (RBAC) | `[IMPLEMENTED]` | `backend/app/api/auth.py:L39-L57`, `backend/tests/test_api.py:L18` | `require_developer`, `require_lead`, `require_admin` guards return 403 Forbidden for unauthorized tiers. |
| **SEC-18** | Comprehensive Security Headers & CSP | `[IMPLEMENTED]` | `backend/app/main.py:L46-L65`, `backend/tests/test_eval_and_observability.py:L26` | Enforces `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`. |
| **SEC-19** | Strict CORS Allow-List | `[IMPLEMENTED]` | `backend/app/main.py:L84-L90`, `backend/app/core/config.py:L25` | Explicit origins allow-list (`http://localhost:5173`, etc.); no wildcard `*` with credentials. |
| **SEC-20** | Cascading Data Deletion & Audit Log | `[IMPLEMENTED]` | `backend/app/api/settings.py:L126-L162`, `backend/tests/test_eval_and_observability.py:L45` | Wipes DB records, purges ChromaDB vector collections, and logs immutable event to `AuditLog`. |

---

## 3. Edge-Case Matrix Rows 31–40 Audit

| Row | Scenario | Expected Behaviour | Status | Gap / Remediation Needed |
|---|---|---|:---:|---|
| **31** | Route rate limit tier exceeded | Returns `HTTP 429 Too Many Requests` with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Reset` | `[MISSING]` | Implement in `app/core/rate_limit.py` + write automated test. |
| **32** | Redis outage during rate limiting | Auth routes fail-closed (503/429); public read routes fail-open (200) | `[MISSING]` | Add fallback logic to rate limit dependency + test both auth and read routes under Redis disconnect. |
| **33** | CSRF token missing / mismatched | Mutating request (`POST/PUT/DELETE`) rejected with `403 Forbidden` | `[MISSING]` | Implement CSRF middleware/dependency verifying `X-CSRF-Token` against `ml_csrf` cookie + test. |
| **34** | Outbound LLM token budget exceeded | Explainer agent halts, reverts to static analysis mode with user banner | `[IMPLEMENTED]` | Covered by test #22 and cost cap handler. |
| **35** | Outbound GitHub API quota reached | Queue pauses execution, sets delayed retry honoring `Retry-After` header | `[IMPLEMENTED]` | Covered by test #14 and GitHub client backoff. |
| **36** | SSRF attempt in webhook / external URL | Request to private IP (`127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`) blocked | `[MISSING]` | Implement `validate_safe_url` in `app/core/security.py` + test SSRF prevention. |
| **37** | IDOR attempt across tenant repos | Caller accessing PR from another organization receives `403/404` without leaking repo existence | `[IMPLEMENTED]` | Covered by test #26 and repo tenant filter. |
| **38** | Stored XSS payload in PR title/diff | Dangerous scripts (`<script>`, `javascript:`) rendered harmlessly as plain text | `[MISSING]` | Add automated test verifying sanitization of XSS payloads in comments and diff viewer. |
| **39** | High-entropy secret in commit diff | Redacted before LLM and excluded from vector embeddings | `[IMPLEMENTED]` | Covered by test #13 and `test_secret_redaction`. |
| **40** | Unauthenticated access to private API | Returns clean `401 Unauthorized` envelope without internal stack traces | `[IMPLEMENTED]` | Covered by `test_unauthenticated_access` in `test_auth.py`. |

---

## 4. Summary of Gaps to Close in Step 2

1. **Tiered Redis Rate Limiter (`app/core/rate_limit.py`):**
   - Public read tier: 60 req/min
   - Auth tier: 10 req/min (fails closed if Redis down)
   - Mutating / analysis tier: 20 req/min
   - Webhook tier: 120 req/min
   - Dynamic headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
   - Test: `test_every_route_has_rate_limit_tier` ensuring 100% route coverage across `app.routes`.
2. **CSRF Enforcement (`app/core/csrf.py` or middleware):**
   - Enforce `X-CSRF-Token` header matches `ml_csrf` cookie on state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`), exempting HMAC-authenticated `/webhooks/github`.
3. **SSRF Guard (`app/core/security.py`):**
   - URL validator checking resolved IP addresses against private / loopback / link-local / cloud metadata ranges.
4. **Extend Test Matrix (Rows 31–40):**
   - Add tests 31–40 to `backend/tests/edge_cases/test_matrix.py` so the complete 40-scenario suite passes.
5. **Frontend 429 UI Countdown Interceptor:**
   - Attach global error interceptor in frontend API client to trigger the rate-limit countdown banner.
