from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_developer
from app.core.errors import NotFoundError
from app.db.models import FeedbackModel, FindingModel, User
from app.db.session import get_db

router = APIRouter(prefix="/api/findings", tags=["Findings & Feedback"])


class FeedbackPayload(BaseModel):
    value: str  # helpful | not_helpful


class DismissPayload(BaseModel):
    reason: str


@router.post("/{finding_id}/feedback")
async def submit_finding_feedback(
    finding_id: str,
    payload: FeedbackPayload,
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Submits developer feedback on whether a mentor comment was helpful."""
    stmt = select(FindingModel).where(FindingModel.id == finding_id)
    finding = (await db.execute(stmt)).scalars().first()
    if not finding:
        raise NotFoundError(f"Finding {finding_id} not found.")

    fb = FeedbackModel(
        finding_id=finding.id,
        user_id=user.id,
        value=payload.value,
    )
    db.add(fb)
    await db.commit()

    return {"status": "feedback_recorded", "value": payload.value}


@router.post("/{finding_id}/dismiss")
async def dismiss_finding(
    finding_id: str,
    payload: DismissPayload,
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Dismisses finding with developer reason (e.g. false positive, intended design)."""
    stmt = select(FindingModel).where(FindingModel.id == finding_id)
    finding = (await db.execute(stmt)).scalars().first()
    if not finding:
        raise NotFoundError(f"Finding {finding_id} not found.")

    finding.status = "dismissed"
    finding.dismiss_reason = payload.reason
    await db.commit()

    return {"status": "dismissed", "finding_id": finding_id, "reason": payload.reason}


@router.post("/{finding_id}/mark-fixed")
async def mark_finding_fixed(
    finding_id: str,
    user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Marks finding as resolved/fixed."""
    stmt = select(FindingModel).where(FindingModel.id == finding_id)
    finding = (await db.execute(stmt)).scalars().first()
    if not finding:
        raise NotFoundError(f"Finding {finding_id} not found.")

    finding.status = "fixed"
    await db.commit()

    return {"status": "marked_fixed", "finding_id": finding_id}
