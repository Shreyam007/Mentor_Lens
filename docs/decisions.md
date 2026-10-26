# Architecture & Technical Decisions

Documenting choices made whenever requirements permit multiple implementations.

## Decision Log

### 1. Monorepo Organization & Windows Environment Support
- **Context:** Project runs on Windows (with PowerShell / cmd) during local development and uses Docker for containerized deployment.
- **Decision:** Provide native scripts/configurations that work seamlessly on Windows (`npm.cmd`, Python virtualenv or direct python execution) while keeping standard Docker & docker-compose configurations for multi-service execution.
- **Date:** 2026-10-26

### 2. Design System Alignment with Neo-Brutalist Stitch Prompts
- **Context:** `MentorLens_Stitch_Prompts.md` defines a distinct neo-brutalist aesthetic with glass floating nav, specific hex tokens, hard 4px shadows, chunky display typography, and zero-blur borders.
- **Decision:** All frontend design tokens in `frontend/src/styles/tokens.css` and Tailwind config strictly implement the color palette (Paper, Surface, Ink, Cobalt, Tangerine, Mint, Sun, Tomato, Sky) and 4px offset shadow system.
- **Date:** 2026-10-26
