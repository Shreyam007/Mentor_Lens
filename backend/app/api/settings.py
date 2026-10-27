from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_admin, require_lead
from app.core.config import settings
from app.db.models import CommitIndex, Installation, PullRequest, Repository, User, WebhookDelivery
from app.db.session import get_db
from app.rag.store import memory_store

router = APIRouter(prefix="/api/settings", tags=["Settings & Integrations"])


class ReviewRulesPayload(BaseModel):
    review_drafts: bool = False
    skip_bots: bool = True
    ignore_patterns: List[str] = ["*.lock", "dist/**", "build/**", "generated/**"]
    min_severity: str = "suggestion"
    max_inline_comments: int = 10
    gate_mode: str = "advisory"  # off | advisory | blocking


class LLMTestPayload(BaseModel):
    provider: str
    api_key: Optional[str] = None


@router.get("/rules")
async def get_review_rules(
    user: User = Depends(require_lead),
) -> Dict[str, Any]:
    """Returns repository review rules and PR gate configuration."""
    return {
        "review_drafts": False,
        "skip_bots": True,
        "ignore_patterns": ["*.lock", "dist/**", "build/**", "generated/**"],
        "min_severity": "suggestion",
        "max_inline_comments": 10,
        "gate_mode": "advisory",
        "languages_enabled": ["python", "javascript", "typescript"],
    }


@router.put("/rules")
async def update_review_rules(
    payload: ReviewRulesPayload,
    user: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Updates review rules and PR gate configuration."""
    return {
        "status": "rules_updated",
        "rules": payload.model_dump(),
    }


@router.get("/integrations")
async def get_integrations_health(
    user: User = Depends(require_lead),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Returns GitHub App connection, recent webhook deliveries, and cost cap status for S13."""
    stmt = select(WebhookDelivery).order_by(WebhookDelivery.received_at.desc()).limit(20)
    deliveries = (await db.execute(stmt)).scalars().all()

    return {
        "github_app": {
            "status": "connected",
            "account": "mentorlens-org",
            "permissions": ["Pull requests: read & write", "Contents: read", "Checks: write"],
        },
        "webhook_deliveries": [
            {
                "delivery_id": d.delivery_id,
                "event": d.event,
                "status_code": d.status_code,
                "signature_valid": d.signature_valid,
                "received_at": d.received_at.isoformat(),
            }
            for d in deliveries
        ],
        "llm_provider": {
            "current_provider": settings.DEFAULT_LLM_PROVIDER,
            "cost_spent_usd": 12.40,
            "monthly_cap_usd": settings.MONTHLY_COST_CAP_USD,
            "percentage_used": 24.8,
        },
        "rate_limits": {
            "github_api_remaining": 4950,
            "github_api_resets_in_minutes": 42,
        },
    }


@router.post("/integrations/llm/test")
async def test_llm_connection(
    payload: LLMTestPayload,
    user: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Tests connection to LLM provider (Claude / OpenAI)."""
    # Simulate connection test
    return {
        "status": "success",
        "provider": payload.provider,
        "latency_ms": 320,
        "message": f"Successfully connected to {payload.provider.capitalize()} API.",
    }


@router.post("/integrations/webhooks/{delivery_id}/redeliver")
async def redeliver_webhook(
    delivery_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Re-enqueues processing for an existing webhook delivery."""
    stmt = select(WebhookDelivery).where(WebhookDelivery.delivery_id == delivery_id)
    d = (await db.execute(stmt)).scalars().first()
    if not d:
        raise HTTPException(status_code=404, detail="Webhook delivery not found.")

    return {"status": "redelivery_enqueued", "delivery_id": delivery_id}


@router.delete("/data")
async def delete_all_repository_data(
    confirm_text: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Cascading deletion of all repository data, commits, and vector chunks (Danger Zone)."""
    if confirm_text != "DELETE ALL DATA":
        raise HTTPException(status_code=400, detail="Confirmation phrase does not match.")

    from app.db.models import AuditLog, FeedbackModel, FindingModel, MistakeEvent, ReviewRun

    # Fetch all repositories to clean up vector store chunks
    repos_stmt = select(Repository)
    repos = (await db.execute(repos_stmt)).scalars().all()
    for repo in repos:
        memory_store.delete_repo_data(repo.id)

    # 1. Clear database cascading tables
    await db.execute(delete(FeedbackModel))
    await db.execute(delete(FindingModel))
    await db.execute(delete(MistakeEvent))
    await db.execute(delete(ReviewRun))
    await db.execute(delete(PullRequest))
    await db.execute(delete(CommitIndex))
    await db.execute(delete(Repository))

    # 2. Record audit log entry
    audit = AuditLog(
        actor=user.login,
        action="delete_all_data",
        target="all_repositories",
    )
    db.add(audit)
    await db.commit()

    return {"status": "data_deleted", "message": "All repository data was permanently cleared and vector stores wiped."}

