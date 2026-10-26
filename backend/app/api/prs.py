from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth import require_developer
from app.core.errors import NotFoundError
from app.db.models import FindingModel, PullRequest, Repository, ReviewRun, User
from app.db.session import get_db

router = APIRouter(prefix="/api/prs", tags=["Pull Requests"])


@router.get("")
async def list_pull_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    author: Optional[str] = None,
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Lists pull requests with pagination, status filters, and severity counts."""
    offset = (page - 1) * limit
    stmt = select(PullRequest).options(
        selectinload(PullRequest.repository),
        selectinload(PullRequest.runs).selectinload(ReviewRun.findings),
    )

    if status_filter:
        stmt = stmt.where(PullRequest.state == status_filter)
    if author:
        stmt = stmt.where(PullRequest.author_id == author)

    count_stmt = select(func.count(PullRequest.id))
    if status_filter:
        count_stmt = count_stmt.where(PullRequest.state == status_filter)
    if author:
        count_stmt = count_stmt.where(PullRequest.author_id == author)

    total = (await db.execute(count_stmt)).scalar() or 0
    prs = (await db.execute(stmt.offset(offset).limit(limit))).scalars().all()

    items = []
    for pr in prs:
        latest_run = pr.runs[-1] if pr.runs else None
        findings = latest_run.findings if latest_run else []

        counts = {"critical": 0, "warning": 0, "suggestion": 0, "info": 0}
        for f in findings:
            counts[f.severity] = counts.get(f.severity, 0) + 1

        items.append({
            "id": pr.id,
            "number": pr.number,
            "title": pr.title,
            "author": pr.author_id,
            "repo_name": pr.repository.full_name if pr.repository else "unknown",
            "base_branch": pr.base_branch,
            "head_sha": pr.head_sha,
            "state": pr.state,
            "is_draft": pr.is_draft,
            "is_bot": pr.is_bot,
            "is_fork": pr.is_fork,
            "status": latest_run.status if latest_run else "queued",
            "counts": counts,
            "updated_at": pr.updated_at.isoformat(),
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{pr_id}")
async def get_pull_request_detail(
    pr_id: str,
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Returns PR review detail: diff, findings, citations, and pipeline stages."""
    stmt = (
        select(PullRequest)
        .where(PullRequest.id == pr_id)
        .options(
            selectinload(PullRequest.repository),
            selectinload(PullRequest.runs).selectinload(ReviewRun.findings).selectinload(FindingModel.citations),
        )
    )
    pr = (await db.execute(stmt)).scalars().first()
    if not pr:
        raise NotFoundError(f"Pull Request {pr_id} not found.")

    latest_run = pr.runs[-1] if pr.runs else None
    findings = latest_run.findings if latest_run else []

    findings_data = []
    for f in findings:
        citations_data = [
            {
                "sha": c.commit_sha,
                "verdict": c.verdict,
                "reason": c.reason,
                "similarity": c.similarity,
            }
            for c in f.citations
        ]
        findings_data.append({
            "id": f.id,
            "file": f.file,
            "line_start": f.line_start,
            "line_end": f.line_end,
            "category": f.category,
            "severity": f.severity,
            "title": f.title,
            "why_risky": f.why_risky,
            "fix": f.fix,
            "suggested_code": f.suggested_code,
            "status": f.status,
            "citations": citations_data,
        })

    return {
        "id": pr.id,
        "number": pr.number,
        "title": pr.title,
        "author": pr.author_id,
        "repo_name": pr.repository.full_name if pr.repository else "unknown",
        "head_sha": pr.head_sha,
        "base_branch": pr.base_branch,
        "state": pr.state,
        "run": {
            "id": latest_run.id if latest_run else None,
            "status": latest_run.status if latest_run else "queued",
            "stage": latest_run.stage if latest_run else "intake",
            "trace": latest_run.trace_json if latest_run else {},
        },
        "findings": findings_data,
        "skill_level": "intermediate",
    }
