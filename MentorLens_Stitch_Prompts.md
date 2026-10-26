# MentorLens — Google Stitch Screen Prompts

*Context-aware code review that teaches.*

Design direction (v2: neo-brutalist + glass navigation) built on the `ui-ux-pro-max-skill` (`search.py --design-system`, plus `ux`, `chart` and `style` domain searches).

**How to use in Stitch**

1. Create a new project, pick **Web (Desktop)** unless a prompt says Mobile.
2. For **every** screen, paste the **Master Design Brief** first, then the screen prompt. Stitch generates each screen independently, so repeating the brief keeps all screens consistent.
3. After generating, use "Edit" prompts to refine rather than regenerating from scratch.
4. Export each screen's HTML/Tailwind or Figma, and save it into `/design/screens/SXX-name/` so Antigravity can implement from it.

---

## Master Design Brief (paste before every screen prompt)

```
PRODUCT: MentorLens — an AI code-review mentor for GitHub Pull Requests. It explains WHY code is risky, cites the team's own past bugs (real commit SHAs), and tracks each developer's learning progress. Audience: junior developers, student dev clubs, and the senior reviewers/leads who mentor them. Tone: calm, precise, encouraging, never shaming.

STYLE: Clean NEO-BRUTALIST. Warm off-white "paper" page background, thick 2-3px solid near-black borders, HARD OFFSET shadows (4px 4px 0 #111, no blur), flat saturated colour fills, square-ish corners (0-6px radius), chunky display headings, generous whitespace on a 12-column grid, faint dotted graph-paper texture on the page background only. It must look hand-crafted and clean, NOT like a generic AI SaaS template: NO gradients, NO purple/indigo, NO soft blurry shadows, NO emoji icons, NO stock illustrations.
NAVIGATION (the only glassmorphic element): a floating top bar inset 12px from the top, max-width 1280px, radius 10px, translucent paper background (about 60% opacity) with backdrop blur, 2px ink border and a hard 4px offset shadow. Contents: wordmark + small lens logo mark, links (Dashboard, Pull Requests, Memory, Progress, Analytics), repo switcher, search (Cmd+K), theme toggle, notifications, avatar. Active link = cobalt pill with ink border. Mobile: condensed glass bar + bottom tab bar (max 5 items).

COLOURS (light default): Paper #F4EFE6, Surface #FFFFFF, Surface-2 #EAE3D3, Ink #111111, Muted text #4A4740, Cobalt (primary) #2F4BFF with white text, Tangerine (accent) #FF6B2C, Mint (verified/success) #2DD4A0, Sun (warning) #FFC53D, Tomato (critical) #E5383B, Sky (info) #5BC0EB.
Dark theme: Paper #141414, Surface #1E1E1E, Surface-2 #2A2A2A, Ink/borders/text #F4EFE6, Cobalt #6F86FF, Tangerine #FF8A55, Mint #3DE0AE, Sun #FFD166, Tomato #FF5A5D, Sky #7CD0F2; hard shadows in #F4EFE6.

TYPOGRAPHY: Bricolage Grotesque 700/800 for headings (tight leading), IBM Plex Sans for UI/body (base 16px, never below 14px), JetBrains Mono for code, SHAs, file paths and metrics.

COMPONENTS: Lucide-style line icons (SVG). Buttons: flat fill, 3px ink border, hard shadow; hover lifts (-2px,-2px, shadow 6px), pressed sinks to no shadow; min 44x44px. Cards: white surface, 2px border, hard shadow; hero cards may use a flat colour fill (sun, mint, sky, tangerine) with ink text. Severity badges ALWAYS combine icon + text label + colour: Critical (tomato), Warning (sun), Suggestion (sky), Info (grey). A "Verified" mint shield-check badge on every citation that passed the Verifier. Commit SHAs as monospace chips with a copy button. Visible 3px tangerine focus ring.

LAYOUT: Responsive at 375 / 768 / 1024 / 1440px, no horizontal page scroll.

ACCESSIBILITY: WCAG AA (4.5:1 text contrast), keyboard navigable, aria-labels on icon-only buttons, errors with role="alert", charts have a data-table toggle and distinguish series by pattern + direct labels (not colour alone), respect prefers-reduced-motion.

DATA REALISM: Use believable sample data (developers: Aarav, Meera, Rohan, Ishita; repo "campus-portal"; SHAs like a3f21c9; categories like SQL Injection, Unclosed File Handle, Missing Error Handling, Hardcoded Secret, Mutable Default Argument).
```

---

## S01 — Sign In

```
[Master Design Brief]
Screen: Sign in. Centered 400px card on a quiet dark background with a subtle grid pattern. MentorLens wordmark with a small lens/eye-with-checkmark logo mark. Headline "Code review that teaches." One-line subtext. Primary button "Continue with GitHub" (GitHub icon, full width). Below: small text "We request read access to pull requests and commit history. We never push code." Links: Privacy, Terms. Include a footer status chip "All systems operational".
Also show variants as separate frames: (a) loading state after click with spinner and disabled button, (b) error state "GitHub authorization was cancelled. Try again." with role=alert, (c) error state "Your session expired. Sign in again."
```

## S02 — Onboarding: Install GitHub App & Select Repositories

```
[Master Design Brief]
Screen: 3-step onboarding wizard with a top stepper (1 Connect GitHub, 2 Choose repositories, 3 Learn from history). This frame shows STEP 2. Left: searchable, paginated list of repositories with checkbox, repo name, language chip, last commit date, and commit count. Disabled rows for archived repos and repos where the app lacks permission, each with a tooltip/inline reason. Right: summary panel "Selected: 2 repositories", estimated indexing time, and a note "Only Python and JavaScript are analysed in this version." Footer: Back and Continue buttons. Include inline banners for: GitHub App not installed yet (with "Install GitHub App" button), and "Permissions changed — re-authorize".
```

## S03 — History Indexing Progress (Learning from your team's past)

```
[Master Design Brief]
Screen: Step 3 of onboarding — indexing repository history into the team memory. Show a large progress card per repository: stage list (Fetching commits → Extracting bug-fix commits → Chunking functions → Embedding → Ready) with the current stage highlighted, percentage bar, commits processed counter in monospace, ETA, and a live log drawer. Show these states as separate frames: (a) in progress, (b) completed with summary "214 bug-fix commits indexed, 1,832 function chunks", (c) partial failure with per-repo "Retry" button and plain-language reason, (d) COLD START warning: "Only 6 commits found. Reviews will work, but history citations will be limited." with a "Continue anyway" button. Include a "Run in background" button.
```

## S04 — Team Dashboard (Home)

```
[Master Design Brief]
Screen: Team overview dashboard for repo "campus-portal". Top row of 4 stat cards with sparkline and delta: "PRs reviewed (30d)", "Fix-acceptance rate", "Median time-to-feedback", "Repeat-mistake rate" (down is good, shown green). Middle: large line chart "Repeated mistakes per week" (solid vs dashed lines, direct series labels, no legend-only encoding) with a visible "View as table" toggle. Right column: "Top recurring mistakes" ranked list with category, count, and trend arrow with text. Bottom: "Recent reviews" table (PR title, author avatar+name, severity counts, verification status, time ago) with row click. Include a date-range selector and a repo switcher. Add an empty-state frame for a brand-new repo: friendly message, "Open your first pull request" button and a copyable test snippet.
```

## S05 — Pull Request Review Queue

```
[Master Design Brief]
Screen: List of Pull Requests with filters. Tabs: All, Reviewing, Reviewed, Blocked by gate, Failed. Each row: PR number + title, branch chips (monospace), author, status pill (Queued, Analysing, Reviewed, Needs attention, Failed, Skipped), counts of Critical/Warning/Suggestion, "Gate: Passing/Blocking" chip, updated time. Filters: author, severity, status, date. Sticky table header, keyboard-navigable rows, pagination (not infinite scroll) with page size selector. Show these row states in the sample data: Draft PR (greyed with "Draft — skipped"), Bot PR ("Skipped: bot author"), Fork PR ("Limited: fork permissions"), Very large PR ("Partially reviewed: 40 of 212 files"), Failed run with "Retry review" action. Include loading skeleton frame and a "No pull requests match filters" empty state with Clear filters.
```

## S06 — PR Review Detail (the hero screen)

```
[Master Design Brief]
Screen: Pull Request review detail — the core of the product. Header: PR title, number, author, branch → base, status pill, "Re-run review" and "Open on GitHub" buttons, gate status. Left (65%): unified diff viewer in JetBrains Mono with line numbers, red/green line tints that also use +/- markers, and inline AI comment cards anchored under the relevant lines. Each comment card contains: severity badge (icon+label), title ("Possible SQL injection"), three labelled sections "Why this is risky", "How to fix" (with a copyable code suggestion block), and "From your team's history" showing a citation card: monospace SHA chip "a3f21c9", commit message, author, date, the 6-line fixed snippet, a green "Verified" shield badge, and "View commit" link. Buttons per comment: "Helpful", "Not helpful", "Mark as fixed", "Dismiss with reason". Right (35%) sticky panel: Review summary (counts by severity), "Skill-calibrated for: Intermediate" chip with tooltip, list of files with issue counts, and a "Pipeline" mini-timeline (Static analysis ✓, Retriever ✓, Explainer ✓, Verifier ✓ – 2 citations rejected) linking to the trace.
Show alternate frames: (a) comment with NO citation because none was found, labelled "No similar past mistake found — general guidance", (b) citation removed by verifier with subtle note "1 unverifiable reference was removed", (c) review in progress with skeleton and live stage indicator, (d) review failed with retry, (e) outdated comment "Code changed since this comment — resolved by a newer commit".
```

## S07 — Agent Run Trace (Pipeline Inspector)

```
[Master Design Brief]
Screen: Run inspector for one review run, for senior reviewers and for demoing the agentic system. Horizontal pipeline of 6 nodes (Webhook → Diff fetch → Static analysis → Retriever agent → Explainer agent → Verifier agent → Post to GitHub), each node showing status icon, duration in ms, and token/cost for LLM nodes. Clicking a node opens a right drawer with structured JSON input/output in a code block with copy button, retries count, and errors. A "Verifier decisions" table below lists each cited commit SHA, check performed (exists in repo, touches similar code, claim matches), result Approved/Rejected, and reason. Include a run history dropdown and "Re-run from this stage" button. Show frames for: all green, a node failed with automatic retry (attempt 2 of 3), and LLM timeout with fallback to static-analysis-only comments.
```

## S08 — Team Memory Explorer

```
[Master Design Brief]
Screen: Searchable explorer of the indexed team history ("institutional memory"). Top: large search input with natural-language placeholder "Search past mistakes, e.g. 'unclosed file'", filters (category, author, date, language), and an index freshness chip "Last synced 4 min ago". Results as cards: SHA chip, commit message, category badge, affected file/function, before/after mini-diff, "Times cited in reviews: 7". Right drawer for the selected commit with full diff, linked PRs where it was cited, and a "Exclude from memory" toggle with confirmation. Include states: no results, index syncing, and a "Commit no longer exists on GitHub (history rewritten)" warning badge on stale items with "Re-sync" action.
```

## S09 — Developer Progress Profile

```
[Master Design Brief]
Screen: Individual developer progress page for "Meera Sharma". Header: avatar, name, GitHub handle, skill-level chip (Beginner / Intermediate / Advanced) with a "How this is calculated" popover, and a streak-style "Weeks without a repeated mistake: 3". Main: line chart "Mistakes per week by category" (distinct line styles + direct labels + data-table toggle), a horizontal bar chart "Most common categories", a "Learning path" list of 3 recommended topics each with a short explanation and a link to past PRs where she hit it, and a timeline "Milestones" (first review, first fully clean PR, etc.). Encouraging tone, no rankings or public shaming. Privacy note: "Visible to you and team leads." Include empty state ("Not enough data yet — complete 3 reviewed PRs") and a frame for when the viewer is the developer vs. the team lead.
```

## S10 — Team Analytics

```
[Master Design Brief]
Screen: Team-wide analytics for team leads. Sections: (1) Heatmap of mistake categories by week (with numbers in cells and a pattern/legend, not colour only), (2) Stacked bar "Mistakes by category per developer" with option to anonymise names, (3) Bar chart "Time to feedback: MentorLens vs human reviewer", (4) "Agreement with senior reviews" gauge-like stat with sample size, (5) "Suggested team training topics" card list. Top controls: date range, repo, language, export CSV button. Include a frame with insufficient data ("Need at least 4 weeks of data for trends") and an anonymised-mode frame.
```

## S11 — Evaluation & Quality Metrics

```
[Master Design Brief]
Screen: Evaluation dashboard matching the four project metrics: Fix-acceptance rate, Drop in repeated mistake patterns over weeks, Time-to-feedback vs human review, Agreement with senior-developer reviews. Also show "Hallucination guard": citations proposed vs verified vs rejected (funnel or bar), and "Helpful / Not helpful" feedback ratio. A table of the labelled sample set used for agreement scoring (PR, senior verdict, agent verdict, match ✓/✗) with a "Run evaluation" button and a progress state. Include methodology note footer with "How we measure this".
```

## S12 — Settings: Repositories & Review Rules

```
[Master Design Brief]
Screen: Settings with left sub-navigation (Repositories, Review rules, PR gate, Notifications, LLM & Limits, Data & Privacy, Team). This frame shows "Review rules" and "PR gate" for one repository. Controls: toggle "Review draft PRs", toggle "Skip bot PRs", file ignore patterns (tag input, e.g. *.lock, dist/**, generated/**), languages enabled, review depth (Auto-calibrate / Beginner / Intermediate / Advanced) with preview of how a comment changes, minimum severity to post, max inline comments per PR (slider with explanation), PR gate mode (Off / Advisory / Blocking on Critical) with a clear warning explanation of blocking mode, and a "Save changes" sticky footer with unsaved-changes indicator. Inline validation errors under fields, helper text, and a Reset to defaults button with confirmation dialog.
```

## S13 — Settings: Integrations, Webhook Health & Limits

```
[Master Design Brief]
Screen: Settings → "Integrations & Health". Cards: (1) GitHub App connection status with installed account, permissions list, "Reconfigure" and "Disconnect" (destructive, confirmation dialog); (2) Webhook health: last 20 deliveries table with event, status code, duration, signature-valid chip, "Redeliver" button; (3) LLM provider selector (Claude / OpenAI) with API key field (masked, "Test connection" button with success/failure states) and monthly cost cap progress bar with alerts at 80% and 100%; (4) Rate limit status for GitHub API and LLM with reset timers; (5) Data & privacy: "Secrets are redacted before sending code to the LLM" toggle (on, locked), data retention selector, "Delete all repository data" danger zone. Include a frame where webhook is failing with a red banner and troubleshooting steps.
```

## S14 — System States Kit (one frame each)

```
[Master Design Brief]
Screen set: a consistent library of full-page and inline system states, each as its own frame in the product's visual language, with an icon, a plain-language title, one helpful sentence, and a primary action:
1. 404 Not found. 2. 403 No access to this repository (with "Request access / Switch account"). 3. 500 Something went wrong (with request ID in monospace and copy button). 4. Offline / lost connection banner with auto-retry countdown. 5. GitHub API rate limit reached ("Resets in 12 min", reviews are queued, not lost). 6. LLM unavailable — "Showing static-analysis feedback only" banner. 7. GitHub App uninstalled or access revoked. 8. Session expired modal. 9. Loading skeletons for table, chart and diff viewer. 10. Generic empty state. 11. Maintenance mode. 12. Destructive-action confirmation dialog with typed confirmation. 13. Toast variants (success, error, info) that are announced to screen readers.
```

## S15 — Demo Mode (for the seminar / viva)

```
[Master Design Brief]
Screen: "Demo mode" control panel to run the live demonstration reliably. Shows a seeded repo "mentorlens-demo" with the 8–10 deliberate past bug-fix commits listed (SQL injection, unclosed file, hardcoded secret, mutable default argument, bare except, etc.) as a checklist. Big step-by-step guide: 1 Verify webhook tunnel is up, 2 Open the pre-made PR with a similar mistake, 3 Watch the review appear. Live activity feed on the right showing events arriving in real time (webhook received → diff fetched → retriever found a3f21c9 → verifier approved → comment posted). Buttons: "Reset demo", "Create demo PR", "Replay last run (offline)". Include a prominent frame for "Webhook tunnel down" with a one-click "Switch to offline replay".
```

## S16 — Mobile Views (375px)

```
[Master Design Brief]
Screens (Mobile, 375px): (1) Dashboard with stacked stat cards and bottom navigation (Home, PRs, Memory, Progress, Settings), (2) PR review detail with collapsible comment cards and horizontally scrollable code blocks inside their own container (page itself never scrolls sideways), (3) Developer progress with a single-column chart and data-table toggle. Touch targets at least 44px, 8px spacing between targets, safe-area padding.
```

---

## Stitch Edit Prompts (use after first generation)

- "Make all severity badges include an icon and text label, not just color."
- "Increase contrast of muted text to meet 4.5:1 against the card background."
- "Add a visible 2px focus ring to every interactive element."
- "Replace any emoji with Lucide-style SVG icons."
- "Use 2-3px ink borders and hard offset shadows (no blur) on all cards and buttons."
- "Add a skeleton loading frame for this screen."
- "Add a 'View as table' toggle to every chart."

## Pre-delivery checklist (from the skill)

- [ ] No emojis as icons
- [ ] cursor-pointer on all clickable elements
- [ ] Hover transitions 150–300ms
- [ ] Text contrast ≥ 4.5:1 in both themes
- [ ] Visible focus states
- [ ] prefers-reduced-motion respected
- [ ] Responsive at 375 / 768 / 1024 / 1440px
- [ ] Every screen has loading, empty, error, and partial states
