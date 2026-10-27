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
- [x] Phase 7: Backend APIs for the Dashboard
- [x] Phase 8: Frontend (screen by screen S01..S16)
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

## Phase 7 Notes
- Implemented complete suite of dashboard REST and SSE APIs:
  - `GET /api/repos`, `POST /api/repos/{id}/index`, `GET /api/repos/{id}/index/status`
  - `GET /api/prs`, `GET /api/prs/{id}`
  - `POST /api/runs/{id}/rerun`, `GET /api/runs/{id}/trace`
  - `POST /api/findings/{id}/feedback`, `POST /api/findings/{id}/dismiss`, `POST /api/findings/{id}/mark-fixed`
  - `GET /api/memory/search`, `POST /api/memory/{sha}/exclude`, `POST /api/memory/resync`
  - `GET /api/developers/{id}/progress`
  - `GET /api/analytics/team`, `GET /api/analytics/eval`
  - `GET/PUT /api/settings/rules`, `GET /api/settings/integrations`, `DELETE /api/settings/data`
  - `POST /api/demo/reset`, `POST /api/demo/create-pr`, `GET /api/demo/replay`
  - `GET /api/events` (Server-Sent Events)
- Validated role-based access control (developer vs lead vs admin) with strict 403 Forbidden enforcement on mutating settings.
- Enforced pagination bounds (`page >= 1`, `1 <= limit <= 100`) returning 422 on invalid ranges.
- All 48 tests in test suite passing.

## Phase 8 Notes
- Built complete, responsive React 18 + TypeScript + Vite frontend implementing all 16 Stitch design screens (S01–S16) following Clean Neo-Brutalist design tokens:
  - **S01 Sign In (`/login`):** Centered 400px card, GitHub login button, loading/error/expired session states. Commit: `feat(ui): S01 sign in`
  - **S02 Onboarding: repos (`/onboarding/repos`):** 3-step wizard, searchable repo list, disabled archived rows, permission banner. Commit: `feat(ui): S02 onboarding repos`
  - **S03 Indexing progress (`/onboarding/index`):** Step 3, SSE stage progress, percentage bar, cold start warning. Commit: `feat(ui): S03 indexing progress`
  - **S04 Team dashboard (`/`):** 4 stat cards, "Repeated mistakes per week" line chart with table toggle, recurring mistake list, recent reviews table. Commit: `feat(ui): S04 team dashboard`
  - **S05 PR queue (`/prs`):** Filters in URL query, status pills (draft, bot, fork, partial, failed), page size selector. Commit: `feat(ui): S05 pr queue`
  - **S06 PR review detail (`/prs/:id` - HERO SCREEN):** Unified diff viewer + inline `CommentCard`s + sticky summary side panel (severity breakdown, skill chip, pipeline mini-timeline). Commit: `feat(ui): S06 pr review detail`
  - **S07 Run trace (`/runs/:id`):** 6 horizontal pipeline nodes, JSON inspector drawer, Verifier decisions table. Commit: `feat(ui): S07 run trace`
  - **S08 Memory explorer (`/memory`):** Search input, cards with before/after mini-diff, exclude toggle with confirmation. Commit: `feat(ui): S08 memory explorer`
  - **S09 Developer progress (`/developers/:login`):** Skill popover, clean streak, category chart, learning path, milestones. Commit: `feat(ui): S09 developer progress`
  - **S10 Team analytics (`/analytics`):** Mistake heatmap, anonymize mode, human vs AI time-to-feedback bar chart, senior agreement gauge. Commit: `feat(ui): S10 team analytics`
  - **S11 Evaluation (`/evaluation`):** 4 metrics, hallucination guard funnel (0 unverified citations posted), sample set table. Commit: `feat(ui): S11 evaluation`
  - **S12 Settings: rules & gate (`/settings/rules`):** Dirty-state tracking, draft/bot toggles, ignore patterns, gate mode selector. Commit: `feat(ui): S12 settings rules`
  - **S13 Settings: integrations (`/settings/integrations`):** Webhook delivery table, redeliver button, LLM key tester, cost cap progress bar. Commit: `feat(ui): S13 settings integrations`
  - **S14 System states (global):** 404, 403, 500 (with request ID), offline banner, rate-limit timer, session expired modal. Commit: `feat(ui): S14 system states`
  - **S15 Demo mode (`/demo`):** Reset demo, create demo PR, live event feed, offline replay button. Commit: `feat(ui): S15 demo mode`
  - **S16 Mobile views:** Responsive 375px checks, bottom navigation bar, horizontally scrollable diff container without window scroll. Commit: `feat(ui): S16 mobile views`
- All screens compile cleanly with zero TypeScript errors under `tsc && vite build`.

