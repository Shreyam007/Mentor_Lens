import logging
from typing import Any, Dict, List, Optional
from app.agents.schemas import RetrievedCommit
from app.rag.redaction import redact_secrets
from app.rag.store import memory_store

logger = logging.getLogger(__name__)


def retrieve_team_memory(
    repo_id: str,
    pr_snippet: str,
    category: Optional[str] = None,
    top_k: int = 3,
    min_similarity: float = 0.50,
) -> Dict[str, Any]:
    """
    Retrieves the most relevant past bug-fix commits from the repository's team memory.
    Applies secret redaction, similarity thresholding, and cold start detection.
    """
    # 1. Redact any secrets in the PR snippet before searching
    sanitized_query = redact_secrets(pr_snippet)
    if category:
        sanitized_query = f"{category} {sanitized_query}"

    # 2. Search vector store
    raw_results = memory_store.search_similar(
        repo_id=repo_id,
        query=sanitized_query,
        top_k=top_k,
        min_similarity=min_similarity,
    )

    # 3. Cold start detection
    if not raw_results:
        return {
            "status": "no_history",
            "message": "No similar past mistakes found in team memory — general guidance will be provided.",
            "commits": [],
        }

    # 4. Convert to structured schema
    commits: List[RetrievedCommit] = []
    for r in raw_results:
        commits.append(
            RetrievedCommit(
                sha=r["sha"],
                message=r["commit_message"],
                author=r["author"],
                committed_at=r["committed_at"],
                file=r["file"],
                diff_snippet=r["diff_snippet"],
                similarity=r["similarity"],
                category=r["category"],
            )
        )

    return {
        "status": "found",
        "count": len(commits),
        "commits": commits,
    }
