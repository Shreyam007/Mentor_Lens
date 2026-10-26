# ANTIGRAVITY.md — MentorLens Build Plan

> **Agent instructions:** Read this whole file first. Execute phases **in order**. Do not start a phase until the previous phase's **Done when** checks pass. After each phase: run the tests, commit with the message shown, and write a short note in `/docs/progress.md`. If something is ambiguous, choose the simplest option, record it in `/docs/decisions.md`, and continue.

## 0. Product summary

**MentorLens** is an agentic AI code-review mentor. On every GitHub Pull Request it:

1. receives a webhook, 2. fetches the diff, 3. runs static analysis (Pylint / ESLint / Bandit),
4. **Retriever agent** finds similar past mistakes in the team's commit history (vector DB),
5. **Explainer agent** writes a teaching-style comment (issue, why risky, how to fix),
6. **Verifier agent** fact-checks every cited commit and claim,
7. posts inline comments on the PR and updates a progress dashboard.

It competes on **teaching value and institutional memory**, not raw bug detection. Orchestrated with LangGraph.

## 1. Tech stack (fixed)

| Layer | Choice |
|---|---|
| Backend | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2 + Alembic |
| GitHub | GitHub App + webhooks, PyGithub, `ngrok` for dev |
| Agents | LangGraph + LangChain, Claude API (default) with OpenAI as switchable provider |
| RAG | ChromaDB, sentence-transformers (default, local) or OpenAI embeddings, tree-sitter, GitPython |
| Static analysis | Pylint, Bandit, ESLint (via Node subprocess) |
| DB | PostgreSQL 16 |
| Queue | Redis + ARQ (async job queue) — *added so webhooks return fast and runs are retryable* |
| Frontend | React 18 + Vite + TypeScript, Tailwind CSS, Recharts, TanStack Query, React Router |
| Design | Stitch exports in `/design/screens/`, tokens from `MentorLens_Stitch_Prompts.md` |
| Deploy | Docker, docker-compose; Render / Railway / AWS free tier |
| Tests | pytest, pytest-asyncio, respx, Vitest, React Testing Library, Playwright |

## 2. Repository layout

```
mentorlens/
├─ ANTIGRAVITY.md
├─ docker-compose.yml
├─ .env.example
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/            # config, logging, security, errors, rate limiting
│  │  ├─ db/              # models, session, migrations (alembic/)
│  │  ├─ api/             # routers: auth, repos, prs, runs, memory, developers, analytics, settings, health, demo
│  │  ├─ github/          # app auth, client, webhook handler, diff parsing, comment poster
│  │  ├─ analysis/        # pylint/bandit/eslint runners + normalizer
│  │  ├─ rag/             # ingestion, chunking, embeddings, vector store, retrieval
│  │  ├─ agents/          # retriever, explainer, verifier, graph.py, schemas.py, prompts/
│  │  ├─ workers/         # ARQ tasks: review_pr, ingest_repo, resync_repo
│  │  └─ services/        # skill calibration, mistake taxonomy, metrics, redaction
│  └─ tests/
├─ frontend/
│  └─ src/ (app/, components/, pages/, hooks/, lib/, styles/tokens.css)
├─ design/screens/        # Stitch exports S01..S16
├─ demo-repo/             # seeded repo content + scripts
└─ docs/                  # progress.md, decisions.md, architecture.md, runbook.md
```

## 3. Data model (Alembic migrations)

- `users` (id, github_id, login, avatar_url, role[`developer|lead|admin`], created_at)
- `installations` (id, github_installation_id, account_login, status[`active|suspended|revoked`], permissions_json)
- `repositories` (id, installation_id, full_name, default_branch, language_set, index_status, indexed_at, settings_json)
- `commits_index` (id, repo_id, sha, message, author, committed_at, category, is_bugfix, stale bool)
- `pull_requests` (id, repo_id, number, title, author_id, head_sha, base_branch, state, is_draft, is_fork, is_bot)
- `review_runs` (id, pr_id, head_sha, status[`queued|running|succeeded|partial|failed|skipped|cancelled`], stage, error_code, delivery_id UNIQUE, started_at, finished_at, tokens_in, tokens_out, cost_usd, trace_json)
- `findings` (id, run_id, file, line_start, line_end, category, severity, title, why_risky, fix, source[`static|llm`], github_comment_id, status[`open|fixed|dismissed|outdated`], dismiss_reason)
- `citations` (id, finding_id, commit_sha, verdict[`approved|rejected`], reason, similarity)
- `feedback` (id, finding_id, user_id, value[`helpful|not_helpful`])
- `mistake_events` (id, developer_id, repo_id, category, finding_id, occurred_at)
- `webhook_deliveries` (id, delivery_id UNIQUE, event, status_code, signature_valid, received_at, payload_hash)
- `eval_samples`, `eval_results`
- `audit_log` (actor, action, target, at)

Indexes: `(repo_id, number)`, `(delivery_id)`, `(developer_id, occurred_at)`, `(repo_id, sha)`.

## 4. Agent contracts (Pydantic, strict)

```python
class Finding(BaseModel):
    file: str; line_start: int; line_end: int
    category: MistakeCategory          # enum taxonomy e.g. security.sql_injection
    severity: Literal["critical","warning","suggestion","info"]
    title: str; why_risky: str; fix: str; suggested_code: str | None
    cited_commits: list[str] = []      # SHAs the Explainer wants to cite
    confidence: float

class VerifierResult(BaseModel):
    finding_id: str
    verdict: Literal["approved","rejected","citation_stripped"]
    checks: dict[str, bool]            # sha_exists, touches_similar_code, claim_matches, line_in_diff
    reason: str
```

**LangGraph state:** `PRContext → StaticFindings → RetrievedHistory → DraftFindings → VerifiedFindings → PostedReview`. Each node has timeout, 3 retries with exponential backoff + jitter, and writes its result to `review_runs.trace_json`. LLM output must parse into the schemas; on parse failure retry once with a repair prompt, then fall back.

**Verifier rules (must all be implemented):**
1. Cited SHA exists in the repo (GitHub API / GitPython).
2. The commit actually touches code similar to the PR snippet (embedding similarity ≥ threshold).
3. The claim in the comment matches the commit message/diff (LLM check with strict JSON verdict).
4. Reported line numbers exist in the PR diff.
Failure of 1–3 ⇒ **strip the citation, keep the comment** (flagged "general guidance"). Failure of 4 ⇒ move comment to the PR-level summary. Never post an unverified citation.

---

## PHASE 0 — Scaffold & Environment

1. Create the layout above, `docker-compose.yml` (postgres, redis, chroma, backend, worker, frontend), `.env.example` (all secrets listed, none committed), pre-commit (ruff, black, mypy, eslint, prettier).
2. FastAPI app with `/health` (liveness) and `/ready` (DB + Redis + Chroma checks), structured JSON logging with request IDs, global exception handler returning `{error:{code,message,request_id}}`.
3. CI workflow (GitHub Actions): lint, type-check, tests for backend and frontend.

**Done when:** `docker compose up` starts all services; `/ready` returns 200; CI is green.
**Commit:** `chore: scaffold monorepo and infra`

## PHASE 1 — Auth, GitHub App & Webhook Intake

1. GitHub OAuth login for the dashboard (session cookie: HttpOnly, Secure, SameSite=Lax; CSRF protection on mutating routes).
2. GitHub App auth: JWT → installation access token, **cached and refreshed before the 1-hour expiry**.
3. `POST /webhooks/github`:
   - Verify `X-Hub-Signature-256` with constant-time compare **before parsing**; reject with 401 otherwise.
   - Store in `webhook_deliveries`; **idempotency** by `X-GitHub-Delivery` (duplicate ⇒ 200, no new run).
   - Handle `pull_request` (opened, synchronize, reopened, ready_for_review, closed), `installation`, `installation_repositories`.
   - Enqueue job and return **200 in < 1s**; never do heavy work inline.
4. Handle `installation` deleted/suspended ⇒ mark `revoked`, cancel queued runs, show banner in UI.
5. Role-based access: developer sees own data; lead sees team; admin manages settings.

**Edge cases:** invalid/missing signature, replayed delivery, oversized payload (cap 5 MB), unknown event type (ack and ignore), clock skew on JWT, repo not enabled in MentorLens, user without repo access (403, never leak existence).
**Done when:** tests prove signature failure, duplicate delivery, and revoked installation behaviours.
**Commit:** `feat: github app auth and webhook intake`

## PHASE 2 — Diff Fetch & Pre-filtering

1. Fetch changed files via GitHub API with pagination (files > 100 are paginated; API caps at 3000 files).
2. Normalize into hunks with a **line map** (file line ↔ diff position) for accurate inline comments.
3. Filtering: skip binary, lockfiles, minified/vendored/generated paths, files over size limit, deleted-only files, and user ignore patterns. Language detection; unsupported languages ⇒ get PR-level note only.
4. Size budget: cap files and changed lines per run; prioritize by risk (new code, security-sensitive paths). Record `partial` with "reviewed N of M files".
5. Skip rules: draft PRs (configurable), bot authors, PRs with no reviewable changes, PRs closed before the run starts.
6. **Stale-run cancellation:** a new `synchronize` event cancels any queued/running run for the same PR and starts a new one.

**Edge cases:** rename-only changes, mode changes, force-push (head SHA changed mid-run), empty PR, 3000+ file PR, CRLF line endings, non-UTF8 files, very long lines.
**Done when:** unit tests with fixture diffs cover every filter and the line map is verified against GitHub's position rules.
**Commit:** `feat: diff fetching, filtering and line mapping`

## PHASE 3 — Static Analysis

1. Runners for Pylint, Bandit (Python) and ESLint (JS/TS) executed in a **sandboxed temp dir with timeouts and resource limits**; never execute PR code, only analyse it.
2. Normalizer maps each tool's output to `Finding` with `source="static"` and the mistake taxonomy.
3. Only keep findings on **changed lines**. De-duplicate overlapping findings across tools.
4. Missing tool/config or crash ⇒ log, mark node degraded, continue.

**Edge cases:** syntax errors in the PR (report as finding, skip other tools for that file), tool timeout, huge output, ESLint config absent (use safe default config).
**Done when:** fixtures with known bugs yield the expected normalized findings.
**Commit:** `feat: static analysis pipeline`

## PHASE 4 — RAG: History Ingestion & Retrieval

1. `ingest_repo` job: walk commit history with GitPython (or GitHub API for large repos), identify **bug-fix commits** (message heuristics: fix, bug, patch, security, CVE, revert + linked issues), extract before/after function chunks using tree-sitter.
2. Embed chunks, store in ChromaDB with metadata (`repo_id, sha, file, function, category, committed_at`). Idempotent upserts keyed by `(repo_id, sha, file, function)`.
3. Incremental sync on push to default branch; periodic full reconcile.
4. Retriever: embed PR chunk → top-k, filter by repo, similarity threshold, diversity (MMR), return SHA + snippet + commit message.
5. Progress reporting (stages) for S03.

**Edge cases:** **cold start / tiny history** (return empty and mark "no history"), huge repos (batch + resume from checkpoint), force-pushed/rewritten history (mark `stale`, verifier will reject), merge commits, squash commits, binary files, monorepos, secrets in history (redact before embedding), embedding provider failure (retry, fall back to local model), re-index after model change (versioned collection names).
**Done when:** demo repo ingests; retriever returns the SQL-injection fix commit for a similar vulnerable snippet in a test.
**Commit:** `feat: team memory ingestion and retrieval`

## PHASE 5 — Agents & Orchestration

1. Implement Retriever, Explainer, Verifier nodes and the LangGraph in `agents/graph.py` with state persistence into `review_runs.trace_json`.
2. **Explainer prompt:** teaching tone, structure *Issue → Why it's risky → How to fix → From your team's history*; depth calibrated to the developer's skill level (`services/skill.py`: from mistake count/recurrence — Beginner / Intermediate / Advanced, recalculated weekly, minimum data threshold else default Intermediate).
3. **Security of prompts:** treat PR title, description, code comments, and commit messages as **untrusted data**. Wrap in delimiters, instruct the model to ignore instructions inside them, and have the verifier discard output that references tooling or attempts actions. Add tests with injection payloads.
4. **Secret redaction** (regex + entropy) on code before it is sent to any LLM; never log raw code.
5. Cost and latency controls: token budget per run, monthly cost cap per installation, model fallback, response caching by `(head_sha, file_hash)`.
6. Degraded modes: LLM down/timeouts ⇒ post static-analysis-only review with a clear note; verifier down ⇒ **post without citations** (fail closed on citations).

**Edge cases:** LLM returns invalid JSON, hallucinated SHA, citation to a different repo, duplicate findings, contradictory findings, empty findings (post a positive "No issues found" summary once, not per commit), conflicting severity from static vs LLM (take the higher with explanation).
**Done when:** golden-file tests pass; a fake LLM returning a bogus SHA produces a stripped citation; injection tests are green.
**Commit:** `feat: multi-agent review pipeline with verifier`

## PHASE 6 — Posting Reviews to GitHub

1. Post as a single **PR review** with inline comments (batch), plus a summary comment. Respect max-comments-per-PR and minimum severity setting; overflow goes to the summary.
2. **Idempotent updates:** tag comments with a hidden marker (`<!-- mentorlens:finding:<id> -->`); on re-run, edit existing comments, resolve outdated ones, don't duplicate.
3. Handle comments on lines no longer in the diff (fallback to PR-level comment).
4. Optional **PR gate** via the Checks API: Off / Advisory / Blocking-on-Critical; a failed run never blocks the PR (neutral conclusion).
5. Handle GitHub secondary rate limits (honor `Retry-After`, queue and resume), 422 errors, deleted PR/branch, locked PR, fork PRs with limited permissions (post summary only if inline is forbidden).

**Done when:** an end-to-end test against a mocked GitHub (respx) covers post, update-on-synchronize, and rate-limit retry.
**Commit:** `feat: idempotent github review posting and checks gate`

## PHASE 7 — Backend APIs for the Dashboard

Implement (all paginated, validated, authorised, with OpenAPI docs):

`GET /api/repos`, `POST /api/repos/{id}/index`, `GET /api/repos/{id}/index/status` (SSE or polling) · `GET /api/prs`, `GET /api/prs/{id}` · `POST /api/runs/{id}/rerun`, `GET /api/runs/{id}/trace` · `POST /api/findings/{id}/feedback`, `/dismiss`, `/mark-fixed` · `GET /api/memory/search`, `POST /api/memory/{sha}/exclude`, `POST /api/memory/resync` · `GET /api/developers/{id}/progress` · `GET /api/analytics/team`, `/api/analytics/eval` · `GET/PUT /api/settings/*` · `GET /api/integrations/webhooks`, `POST /api/integrations/webhooks/{id}/redeliver` · `POST /api/integrations/llm/test` · `POST /api/demo/reset`, `/api/demo/create-pr`.

Live updates through Server-Sent Events: `GET /api/events` (run stage changes). Consistent error envelope. Rate-limit per user/IP.

**Done when:** API tests cover authorisation (developer vs lead vs admin), pagination bounds, and validation errors.
**Commit:** `feat: dashboard api`

## PHASE 8 — Frontend (screen by screen)

**Setup first:** Vite + TS, Tailwind configured with the **design tokens** from the brief in `styles/tokens.css` (dark default + light), IBM Plex Sans + JetBrains Mono, Lucide icons, TanStack Query, error boundary, theme toggle persisted, typed API client generated from OpenAPI.

**Shared components (build once, reuse):** `AppShell`, `Sidebar/BottomNav`, `StatCard`, `SeverityBadge` (icon + text + color), `VerifiedBadge`, `ShaChip`, `DataTable` (sticky header, pagination, keyboard nav), `ChartWithTable` (every chart gets a data-table toggle), `DiffViewer`, `CommentCard`, `EmptyState`, `ErrorState`, `Skeleton`, `ConfirmDialog` (typed confirmation for destructive actions), `Toast` (aria-live), `Banner`.

For **each** screen below: open the matching Stitch export in `/design/screens/`, implement it **pixel-faithfully with real API data**, and make sure it has **loading, empty, error, and partial states**. Run Playwright + axe accessibility checks before moving on.

| Step | Screen | Route | Notes |
|---|---|---|---|
| 8.1 | S01 Sign In | `/login` | Handle OAuth cancel and expired session |
| 8.2 | S02 Onboarding: repos | `/onboarding/repos` | Paginated list, disabled rows with reasons, install-app banner |
| 8.3 | S03 Indexing progress | `/onboarding/index` | SSE progress, retry, cold-start warning, background mode |
| 8.4 | S04 Team dashboard | `/` | Stat cards, trend chart, recurring list, recent reviews |
| 8.5 | S05 PR queue | `/prs` | Filters in URL query, all status pills (draft, bot, fork, partial, failed) |
| 8.6 | S06 PR review detail | `/prs/:id` | **Most important.** Diff + inline comments + citations + side panel; handles outdated, no-citation, stripped-citation, in-progress, failed |
| 8.7 | S07 Run trace | `/runs/:id` | Pipeline nodes, JSON drawer, verifier decisions, re-run |
| 8.8 | S08 Memory explorer | `/memory` | Search, filters, stale warnings, exclude with confirm |
| 8.9 | S09 Developer progress | `/developers/:login` | Skill popover, learning path, privacy by role |
| 8.10 | S10 Team analytics | `/analytics` | Heatmap, anonymise mode, CSV export, insufficient-data state |
| 8.11 | S11 Evaluation | `/evaluation` | 4 metrics + hallucination guard funnel + sample set table |
| 8.12 | S12 Settings: rules & gate | `/settings/rules` | Dirty-state tracking, inline validation, reset confirm |
| 8.13 | S13 Settings: integrations | `/settings/integrations` | Webhook table, redeliver, key test, cost cap, danger zone |
| 8.14 | S14 System states | global | 404/403/500, offline, rate-limit, LLM-down, revoked, session expired |
| 8.15 | S15 Demo mode | `/demo` | Reset, create demo PR, live feed, offline replay |
| 8.16 | S16 Mobile | all | Verify 375px layouts, bottom nav, no horizontal page scroll |

**Frontend edge cases to handle globally:** token/session expiry (silent refresh then modal), 401/403/404/429/5xx mapping to S14 states, request cancellation on route change, race conditions (ignore stale responses), optimistic updates with rollback for feedback/dismiss, very long titles/branch names (truncate with tooltip), 10,000-line diffs (virtualised rendering), huge comment counts (collapse + "show more"), RTL-safe layout, timezone-correct relative times, `prefers-reduced-motion`, keyboard shortcuts documented, no layout shift (reserve space for charts/images).

**Done when:** every route renders all states; axe reports zero critical/serious issues; Lighthouse accessibility ≥ 95 on S04 and S06.
**Commit per screen:** `feat(ui): S0X <name>`

## PHASE 9 — Edge-Case Hardening Matrix

Create `backend/tests/edge_cases/` with one test per row. All must pass.

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | Invalid webhook signature | 401, logged, no job |
| 2 | Duplicate delivery ID | 200, no duplicate run |
| 3 | PR updated mid-run | Old run cancelled, new run for latest SHA |
| 4 | 3000-file / huge PR | Partial review with clear "N of M files" notice |
| 5 | Binary/lock/generated files | Skipped silently, counted in summary |
| 6 | Unsupported language | PR-level note, no crash |
| 7 | Empty or tiny commit history | Review works, no citations, UI explains why |
| 8 | Cited SHA doesn't exist | Citation stripped, comment kept |
| 9 | History rewritten (force-push) | Commits marked stale, re-sync offered |
| 10 | LLM timeout / 5xx | Retries, then static-only review with banner |
| 11 | LLM returns invalid JSON | One repair attempt, then fallback |
| 12 | Prompt injection in PR text/code | Ignored, no behaviour change, test asserts |
| 13 | Secrets in diff | Redacted before LLM; never logged |
| 14 | GitHub rate limit (primary/secondary) | Queue + resume honoring Retry-After; UI shows reset timer |
| 15 | Installation token expired | Transparent refresh |
| 16 | App uninstalled mid-run | Run cancelled, banner shown, data retained per policy |
| 17 | Fork PR / read-only token | Summary-only, labelled |
| 18 | Comment line not in diff | PR-level fallback comment |
| 19 | Re-run on same SHA | Comments updated in place, no duplicates |
| 20 | Draft PR / bot PR | Skipped with reason, configurable |
| 21 | PR closed/merged/deleted during run | Run ends gracefully, no post |
| 22 | Cost cap reached | Static-only mode, admin alerted |
| 23 | DB or Redis outage | `/ready` fails, jobs retried after recovery, no data loss |
| 24 | Worker crash mid-run | Job re-queued, idempotent resume |
| 25 | Concurrent runs for many PRs | Bounded concurrency, fair queue, no cross-tenant leakage |
| 26 | User opens another team's repo | 403/404 without leaking existence |
| 27 | Developer with <3 reviewed PRs | Progress page empty-state, default skill level |
| 28 | Duplicate/contradictory findings | De-duplicated; higher severity wins with explanation |
| 29 | Non-UTF8 / CRLF / very long lines | Parsed safely |
| 30 | Time zones & DST in analytics | Weekly buckets correct in UTC, displayed locally |

## PHASE 10 — Quality, Evaluation & Observability

1. **Eval harness** (`backend/app/services/eval.py` + CLI): run the pipeline over a labelled sample of PRs, compute the four project metrics — fix-acceptance rate, repeated-mistake drop over weeks, time-to-feedback vs human, agreement with senior reviews — plus the **citation verification rate**. Persist results for S11.
2. Test coverage targets: backend ≥ 85% lines on `agents/`, `github/`, `rag/`; frontend component tests for all shared components; Playwright E2E for sign-in → onboard → PR review → feedback.
3. Observability: structured logs, request/run IDs everywhere, metrics (`runs_total`, `run_duration`, `llm_tokens`, `verifier_rejections`), Sentry hooks optional.
4. Security pass: dependency audit, secrets scan, CSP and security headers, CORS allow-list, input validation, SQL via ORM only, least-privilege GitHub App permissions (Pull requests: read & write, Contents: read, Metadata: read, Checks: write).
5. Data: retention policy, delete-all-data endpoint (cascades DB + vector store), audit log for admin actions.

**Done when:** `make test` and `make e2e` pass; eval report generated in `/docs/eval-report.md`.
**Commit:** `feat: evaluation, observability and security hardening`

## PHASE 11 — Demo Repo & Deployment

1. `demo-repo/seed.sh` creates the repo **mentorlens-demo** with **8–10 past bug-fix commits** (SQL injection, unclosed file, hardcoded secret, mutable default argument, bare `except`, missing input validation, path traversal, unsafe `eval`, race condition, off-by-one), then opens a PR with a similar mistake.
2. Demo mode (S15): reset, create demo PR, live feed, **offline replay** from a recorded run so the viva works even without internet or a tunnel.
3. Deploy: production Dockerfiles (multi-stage, non-root), migrations on start, env-based config, backend + worker on Render/Railway, managed Postgres/Redis, Chroma volume, frontend on static hosting. HTTPS only.
4. `docs/runbook.md`: how to rotate secrets, redeliver webhooks, re-index, and recover from outages. `docs/architecture.md` with the flow diagram. README with a 5-minute quickstart.

**Done when:** a fresh clone + `.env` + `make demo` reproduces the full live demo: open PR → comment with cited past commit appears on GitHub → dashboard updates.
**Commit:** `chore: demo repo, deployment and docs`

---

## Definition of Done (whole project)

- [ ] All 16 screens implemented from Stitch designs, with loading/empty/error/partial states
- [ ] Every row in the Phase 9 matrix has a passing automated test
- [ ] No unverified citation can ever be posted (tested)
- [ ] LLM, GitHub, Redis, or DB outage never crashes the app; degraded modes are visible to the user
- [ ] WCAG AA: axe clean, keyboard-only usable, contrast ≥ 4.5:1 in both themes
- [ ] Secrets never leave the system unredacted or appear in logs
- [ ] Eval report with the four metrics + citation verification rate
- [ ] Live demo runs end-to-end, with offline replay as a fallback
- [ ] README, architecture doc, and runbook complete

## Honest limitations (keep in the README and viva notes)

- Not intended to beat SonarQube / CodeGuru on raw bug detection.
- Does not replace human review of architecture-level decisions.
- Quality depends on the size and quality of the repo's commit history.
- Supports Python and JavaScript/TypeScript only in this version.
