from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_developer, require_lead
from app.db.models import CommitIndex, Repository, User
from app.db.session import get_db
from app.rag.retriever import retrieve_team_memory
from app.rag.store import memory_store

router = APIRouter(prefix="/api/memory", tags=["Team Memory"])


@router.get("/search")
async def search_memory(
    q: str = Query(..., min_length=1),
    repo_id: Optional[str] = None,
    category: Optional[str] = None,
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Natural-language search across indexed past bug-fix commits."""
    # Find default repo if not provided
    target_repo_id = repo_id
    if not target_repo_id:
        stmt = select(Repository.id).limit(1)
        target_repo_id = (await db.execute(stmt)).scalar() or "default-repo"

    results = retrieve_team_memory(
        repo_id=target_repo_id,
        pr_snippet=q,
        category=category,
        top_k=10,
        min_similarity=0.35,
    )
    return results


@router.post("/{sha}/exclude")
async def exclude_memory_commit(
    sha: str,
    repo_id: str = Query(...),
    user: User = Depends(require_lead),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Excludes commit from memory and marks it stale."""
    # Update SQL
    stmt = select(CommitIndex).where(CommitIndex.repo_id == repo_id, CommitIndex.sha == sha)
    commit = (await db.execute(stmt)).scalars().first()
    if commit:
        commit.stale = True
        await db.commit()

    # Update Vector store
    marked = memory_store.mark_stale(repo_id, [sha])
    return {
        "status": "excluded",
        "sha": sha,
        "repo_id": repo_id,
        "chunks_marked_stale": marked,
    }


@router.post("/resync")
async def resync_team_memory(
    repo_id: str = Query(...),
    user: User = Depends(require_lead),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Re-syncs and reconciles repository commit memory."""
    stmt = select(Repository).where(Repository.id == repo_id)
    repo = (await db.execute(stmt)).scalars().first()
    if repo:
        repo.index_status = "indexing"
        await db.commit()

    return {"status": "resync_started", "repo_id": repo_id}
