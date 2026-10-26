import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CommitIndex, Repository
from app.rag.heuristics import is_bugfix_commit
from app.rag.redaction import redact_secrets
from app.rag.store import memory_store

logger = logging.getLogger(__name__)

INGESTION_STAGES = [
    "fetching_commits",
    "extracting_bugfixes",
    "chunking_functions",
    "embedding",
    "ready",
]


async def ingest_commit_record(
    db: AsyncSession,
    repo_id: str,
    sha: str,
    message: str,
    author: str,
    committed_at: datetime,
    file_path: str,
    diff_snippet: str,
    function_name: str = "main",
) -> Optional[str]:
    """
    Ingests a single commit into both SQL database and vector store if it is a bug-fix commit.
    """
    is_bugfix, category = is_bugfix_commit(message)
    if not is_bugfix:
        return None

    # Redact secrets before saving or embedding
    clean_message = redact_secrets(message)
    clean_snippet = redact_secrets(diff_snippet)

    # 1. Insert/update SQL commits_index
    stmt = select(CommitIndex).where(CommitIndex.repo_id == repo_id, CommitIndex.sha == sha)
    res = await db.execute(stmt)
    commit_row = res.scalars().first()

    if not commit_row:
        commit_row = CommitIndex(
            repo_id=repo_id,
            sha=sha,
            message=clean_message,
            author=author,
            committed_at=committed_at,
            category=category.value,
            is_bugfix=True,
            stale=False,
        )
        db.add(commit_row)
        await db.commit()

    # 2. Upsert vector chunk into TeamMemoryStore
    chunk_id = memory_store.upsert_chunk(
        repo_id=repo_id,
        sha=sha,
        file=file_path,
        function=function_name,
        category=category.value,
        snippet=clean_snippet,
        commit_message=clean_message,
        author=author,
        committed_at=committed_at.isoformat(),
        is_stale=False,
    )

    return chunk_id


async def run_repo_ingestion(
    db: AsyncSession,
    repo_id: str,
    commits_data: List[Dict[str, Any]],
    progress_callback: Optional[Callable[[str, int, int], None]] = None,
) -> Dict[str, Any]:
    """
    Orchestrates the repository history ingestion pipeline with progress reporting for S03.
    """
    total_commits = len(commits_data)
    indexed_count = 0

    def report(stage: str, current: int, total: int):
        if progress_callback:
            progress_callback(stage, current, total)
        logger.info(f"Ingestion [{repo_id}] {stage} ({current}/{total})")

    # Stage 1: Fetching commits
    report("fetching_commits", total_commits, total_commits)

    # Stage 2: Extracting bug-fix commits & Chunking
    report("extracting_bugfixes", 0, total_commits)
    bugfix_commits = []
    for c in commits_data:
        is_bf, cat = is_bugfix_commit(c.get("message", ""))
        if is_bf:
            bugfix_commits.append((c, cat))

    # Stage 3 & 4: Chunking & Embedding
    report("embedding", 0, len(bugfix_commits))
    for idx, (commit, category) in enumerate(bugfix_commits, start=1):
        committed_at = commit.get("committed_at")
        if isinstance(committed_at, str):
            committed_at = datetime.fromisoformat(committed_at.replace("Z", "+00:00"))
        elif not isinstance(committed_at, datetime):
            committed_at = datetime.now(timezone.utc)

        chunk_id = await ingest_commit_record(
            db=db,
            repo_id=repo_id,
            sha=commit.get("sha", "0000000"),
            message=commit.get("message", ""),
            author=commit.get("author", "unknown"),
            committed_at=committed_at,
            file_path=commit.get("file", "app.py"),
            diff_snippet=commit.get("diff", ""),
            function_name=commit.get("function", "handler"),
        )
        if chunk_id:
            indexed_count += 1
        report("embedding", idx, len(bugfix_commits))

    # Update repo index_status
    stmt = select(Repository).where(Repository.id == repo_id)
    res = await db.execute(stmt)
    repo = res.scalars().first()
    if repo:
        repo.index_status = "ready"
        repo.indexed_at = datetime.now(timezone.utc)
        await db.commit()

    # Stage 5: Ready
    report("ready", indexed_count, indexed_count)

    return {
        "status": "ready",
        "total_commits_scanned": total_commits,
        "bugfix_commits_indexed": indexed_count,
        "is_cold_start": indexed_count < 3,
    }
