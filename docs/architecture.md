# MentorLens Architecture

MentorLens is an agentic AI code-review mentor designed to turn PR reviews into high-retention institutional learning opportunities.

```mermaid
flowchart TD
    GH[GitHub PR Webhook] --> Intake[FastAPI Webhook Intake]
    Intake --> Signature[HMAC-SHA256 Verification]
    Signature --> Dedup[Idempotency & Delivery Store]
    Dedup --> Queue[(Redis & ARQ Queue)]
    
    Queue --> Worker[Worker: review_pr]
    Worker --> Diff[Diff Fetch & Pre-filtering]
    Diff --> HunkMap[Line Position Mapping]
    
    HunkMap --> Graph[LangGraph Orchestrator]
    
    subgraph Agents [LangGraph Agent Pipeline]
        SA[Static Analysis: Pylint / Bandit / ESLint]
        Retriever[Retriever Agent: ChromaDB Team Memory]
        Explainer[Explainer Agent: Teaching-Style Findings]
        Verifier[Verifier Agent: Fact-Check Citations & Lines]
        
        SA --> Retriever
        Retriever --> Explainer
        Explainer --> Verifier
    end
    
    Graph --> Post[Batch Review Poster & Checks Gate]
    Post --> GHPull[GitHub Pull Request Inline Comments]
    Post --> UI[Dashboard SSE / Realtime Feed]
```

## Core Tenets
1. **Never Post an Unverified Citation**: Every cited SHA and historical diff is fact-checked against the repository and verified with semantic matching.
2. **Teaching First**: Findings follow the structured learning framework:
   - What the issue is
   - Why it is risky
   - How to fix it (with actionable code suggestion)
   - Real institutional memory context from past team commits
3. **Fail-Closed on Unverified Citations, Fail-Open on Guidance**: If a citation fails verification, the citation is stripped while keeping the educational guidance.
