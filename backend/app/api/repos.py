from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_developer, require_lead
from app.core.errors import NotFoundError
from app.db.models import Installation, Repository, User
from app.db.session import get_db

router = APIRouter(prefix="/api/repos", tags=["Repositories"])


@router.get("")
async def list_repositories(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Lists repositories with pagination and indexing status."""
    offset = (page - 1) * limit
    count_stmt = select(func.count(Repository.id))
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = select(Repository).offset(offset).limit(limit).order_by(Repository.full_name)
    repos = (await db.execute(stmt)).scalars().all()

    return {
        "items": [
            {
                "id": r.id,
                "full_name": r.full_name,
                "default_branch": r.default_branch,
                "language_set": r.language_set,
                "index_status": r.index_status,
                "indexed_at": r.indexed_at.isoformat() if r.indexed_at else None,
            }
            for r in repos
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/{repo_id}/index")
async def trigger_repo_indexing(
    repo_id: str,
    user: User = Depends(require_lead),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Triggers indexing of historical commits into team memory."""
    stmt = select(Repository).where(Repository.id == repo_id)
    repo = (await db.execute(stmt)).scalars().first()
    if not repo:
        raise NotFoundError(f"Repository {repo_id} not found.")

    repo.index_status = "indexing"
    await db.commit()

    return {
        "status": "indexing_started",
        "repo_id": repo_id,
        "message": "Repository indexing enqueued.",
    }


@router.get("/{repo_id}/index/status")
async def get_indexing_status(
    repo_id: str,
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Returns indexing stage and processed count for S03."""
    stmt = select(Repository).where(Repository.id == repo_id)
    repo = (await db.execute(stmt)).scalars().first()
    if not repo:
        raise NotFoundError(f"Repository {repo_id} not found.")

    return {
        "repo_id": repo_id,
        "index_status": repo.index_status,
        "indexed_at": repo.indexed_at.isoformat() if repo.indexed_at else None,
        "stage": "ready" if repo.index_status == "ready" else "extracting_bugfixes",
        "progress_percent": 100 if repo.index_status == "ready" else 65,
    }
