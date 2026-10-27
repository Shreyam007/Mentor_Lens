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

### 3. ChromaDB Persistent Storage Strategy on Render
- **Context:** Chroma requires disk persistence for vector embeddings across process restarts. On Render, persistent disks are supported on Starter plans ($7/mo web service + $0.25/GB disk), whereas Free plan instances operate with ephemeral container storage and spin down after 15 minutes of inactivity.
- **Decision:**
  1. Define a persistent disk `chroma-data` (`/data/chroma`) in `render.yaml` for production instances with persistent plans.
  2. For free-tier deployments without persistent disks, fallback to container-local volume `/app/chroma_data` with cold-start background re-sync on container wake-up via `/api/memory/resync`.
  3. Keep Chroma operating strictly in embedded SQLite/HNSW mode (`chromadb.PersistentClient`) rather than exposing an unauthenticated Chroma HTTP port.
- **Date:** 2026-10-28

