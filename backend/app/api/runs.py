import uuid
from typing import Any, Dict
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_developer
from app.core.errors import NotFoundError
from app.db.models import ReviewRun, User
from app.db.session import get_db
from app.workers.queue import enqueue_job

router = APIRouter(prefix="/api/runs", tags=["Review Runs"])


@router.post("/{run_id}/rerun")
async def rerun_review(
    run_id: str,
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Re-triggers an execution run for a pull request."""
    stmt = select(ReviewRun).where(ReviewRun.id == run_id)
    run = (await db.execute(stmt)).scalars().first()
    if not run:
        raise NotFoundError(f"Review run {run_id} not found.")

    new_run = ReviewRun(
        pr_id=run.pr_id,
        head_sha=run.head_sha,
        status="queued",
        stage="intake",
        delivery_id=f"rerun-{str(uuid.uuid4())[:8]}",
    )
    db.add(new_run)
    await db.commit()

    await enqueue_job(
        "review_pr",
        run_id=new_run.id,
        pr_id=run.pr_id,
        head_sha=run.head_sha,
        delivery_id=new_run.delivery_id,
    )

    return {
        "status": "rerun_enqueued",
        "new_run_id": new_run.id,
    }


@router.get("/{run_id}/trace")
async def get_run_trace(
    run_id: str,
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Returns execution trace for S07 (pipeline inspector)."""
    stmt = select(ReviewRun).where(ReviewRun.id == run_id)
    run = (await db.execute(stmt)).scalars().first()
    if not run:
        raise NotFoundError(f"Review run {run_id} not found.")

    return {
        "run_id": run.id,
        "status": run.status,
        "stage": run.stage,
        "head_sha": run.head_sha,
        "trace": run.trace_json,
    }
