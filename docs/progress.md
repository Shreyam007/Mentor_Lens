# MentorLens Build Progress

Tracks progress phase-by-phase according to `ANTIGRAVITY.md`.

## Status Summary

- [x] Phase 0: Scaffold & Environment
- [x] Phase 1: Auth, GitHub App & Webhook Intake
- [x] Phase 2: Diff Fetch & Pre-filtering
- [x] Phase 3: Static Analysis
- [x] Phase 4: RAG: History Ingestion & Retrieval
- [x] Phase 5: Agents & Orchestration
- [x] Phase 6: Posting Reviews to GitHub
- [ ] Phase 7: Backend APIs for the Dashboard
- [ ] Phase 8: Frontend (screen by screen S01..S16)
- [ ] Phase 9: Edge-Case Hardening Matrix
- [ ] Phase 10: Quality, Evaluation & Observability
- [ ] Phase 11: Demo Repo & Deployment

## Phase 0 Notes
- Scaffolded monorepo: `backend/`, `frontend/`, `docs/`, `design/screens/`, `demo-repo/`.
- Created `docker-compose.yml` with postgres, redis, chroma, backend, worker, frontend.
- Configured `.env.example` with all secrets and configuration values.
- Configured pre-commit and GitHub Actions CI workflow in `.github/workflows/ci.yml`.
- Implemented FastAPI app with structured JSON logging, X-Request-ID propagation, custom AppError hierarchy, `/health`, and `/ready` endpoints.
- Configured Vite + React 18 + TypeScript frontend with Tailwind CSS and the Neo-Brutalist design tokens from `MentorLens_Stitch_Prompts.md`.
- Verified backend test suite (6/6 passing) and frontend build (`tsc && vite build` passing).

## Phase 1 Notes
- Implemented GitHub OAuth login with secure HttpOnly session cookies (`ml_session`) and CSRF tokens (`ml_csrf`).
- Implemented GitHub App JWT generation and cached installation access token refresh management.
- Implemented `POST /webhooks/github` intake with constant-time HMAC-SHA256 signature verification before JSON parsing, returning 401 on failure.
- Implemented idempotency using `X-GitHub-Delivery` recorded in `webhook_deliveries`. Duplicate deliveries return 200 immediately without duplicate job enqueueing.
- Implemented lifecycle event handling: `pull_request` (opened, synchronize, closed) and `installation` (created, deleted, suspend, unsuspend).
- Implemented stale-run cancellation: synchronize cancels superseded runs; installation deletion marks status `revoked` and cancels all pending/running runs.
- All 13 tests in test suite passing.

## Phase 2 Notes
- Implemented unified diff parser with exact line-map position calculation corresponding to GitHub's position index specification (1-based from @@ header).
- Handled multi-hunk diffs, additions, deletions, context lines, CRLF normalizations.
- Implemented robust file filtering: binary files, lockfiles, vendored/generated files, user-defined globs, size thresholds, deleted-only files.
- Implemented language detection for Python and JavaScript/TypeScript.
- Implemented PR skip rules (draft PRs, bot authors, closed PRs).
- Implemented risk-prioritized file budgeting (`apply_size_budget`) giving precedence to security-sensitive modules and new files, recording partial state when capped.
- All 24 tests in test suite passing.

## Phase 3 Notes
- Implemented Pydantic models for `Finding`, `VerifierResult`, `PRContext`, and `MistakeCategory` taxonomy.
- Implemented taxonomy mapping for Bandit (B608 SQL injection, B105/B106 hardcoded secret, B307 unsafe eval, B110 bare except) and Pylint (W0102 mutable default, W0702 bare except, E0001 syntax error).
- Implemented sandboxed static analysis runner with ast pre-parsing for instant syntax error isolation, timeouts (15s), and output capping.
- Implemented normalizer pipeline that enforces strict changed-lines filtering against PR diff positions and de-duplicates overlapping findings across tools by highest severity.
- All 31 tests in test suite passing.

## Phase 4 Notes
- Implemented secret redaction on code diffs, logs, and vector storage (AWS, GitHub, Anthropic, OpenAI tokens, passwords).
- Implemented commit message heuristics identifying bug-fix commits and mapping them into the mistake taxonomy.
- Implemented `TeamMemoryStore` with ChromaDB integration, versioned collections (`mentorlens_commits_v1`), idempotent upserts by `(repo_id, sha, file, function)`, and stale commit marking.
- Implemented repository history ingestion pipeline with S03 multi-stage progress tracking (`fetching_commits` → `extracting_bugfixes` → `chunking_functions` → `embedding` → `ready`).
- Implemented retriever with similarity thresholding, secret sanitization, and cold-start fallback ("no_history").
- All 36 tests in test suite passing.

## Phase 5 Notes
- Implemented multi-agent pipeline: Retriever, Explainer, and Verifier in `backend/app/agents/graph.py` with state and execution trace persistence into `review_runs.trace_json`.
- Implemented developer skill calibration in `backend/app/services/skill.py` (Beginner / Intermediate / Advanced) dynamically tuning the pedagogical depth of the Explainer.
- Implemented prompt injection defenses with strict `<UNTRUSTED_PR_CONTENT>` delimiters and system directives prohibiting instruction execution inside user code.
- Implemented strict 4-rule Verifier (`backend/app/agents/verifier.py`): fact-checks existence of cited SHAs, diff similarity (>= 0.40), claim alignment, and line presence in PR diff.
- Enforced citation stripping on hallucinated/unverified SHAs while retaining pedagogical guidance.
- Handled out-of-diff line errors by routing to PR summary level.
- All 42 tests in test suite passing.

## Phase 6 Notes
- Implemented GitHub review poster (`backend/app/github/poster.py`) with hidden markers `<!-- mentorlens:finding:... -->` for zero-duplicate idempotent updates.
- Implemented batch inline review comment posting + comprehensive PR summary comment table.
- Implemented 422 line-not-in-diff fallback cleanly redirecting to PR issue comments.
- Implemented optional PR checks gate via GitHub Checks API (`off`, `advisory`, `blocking-on-critical`).
- Verified via mocked GitHub API test suite using `respx` (initial post, update-on-synchronize, 422 fallback).
- All 45 tests in test suite passing.
