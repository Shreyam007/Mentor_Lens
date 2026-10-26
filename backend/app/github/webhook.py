import hashlib
import json
import logging
from typing import Any, Dict
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import UnauthorizedError
from app.core.security import verify_webhook_signature
from app.db.models import Installation, PullRequest, Repository, ReviewRun, WebhookDelivery
from app.db.session import get_db
from app.workers.queue import enqueue_job

router = APIRouter(prefix="/webhooks", tags=["GitHub Webhooks"])
logger = logging.getLogger(__name__)

MAX_PAYLOAD_SIZE = 5 * 1024 * 1024  # 5 MB cap


@router.post("/github")
async def handle_github_webhook(
    request: Request,
    response: Response,
    x_github_delivery: str = Header(..., alias="X-GitHub-Delivery"),
    x_github_event: str = Header(..., alias="X-GitHub-Event"),
    x_hub_signature_256: str = Header(None, alias="X-Hub-Signature-256"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    # 1. Payload size check (cap at 5 MB)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_PAYLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Payload exceeds 5 MB limit",
        )

    body_bytes = await request.body()
    if len(body_bytes) > MAX_PAYLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Payload exceeds 5 MB limit",
        )

    # 2. Constant-time signature verification BEFORE parsing JSON
    if not verify_webhook_signature(body_bytes, x_hub_signature_256, settings.GITHUB_WEBHOOK_SECRET):
        logger.warning(
            f"Webhook signature verification failed for delivery {x_github_delivery}",
            extra={"delivery_id": x_github_delivery},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing webhook signature",
        )

    # Calculate payload hash for delivery audit
    payload_hash = hashlib.sha256(body_bytes).hexdigest()

    # 3. Idempotency check via X-GitHub-Delivery
    stmt = select(WebhookDelivery).where(WebhookDelivery.delivery_id == x_github_delivery)
    result = await db.execute(stmt)
    existing_delivery = result.scalars().first()

    if existing_delivery:
        logger.info(f"Duplicate delivery {x_github_delivery} received. Acknowledging with 200 without enqueuing.")
        return {
            "status": "duplicate_acknowledged",
            "delivery_id": x_github_delivery,
            "message": "Delivery was already processed.",
        }

    # Record delivery
    delivery_record = WebhookDelivery(
        delivery_id=x_github_delivery,
        event=x_github_event,
        status_code=200,
        signature_valid=True,
        payload_hash=payload_hash,
    )
    db.add(delivery_record)
    await db.commit()

    # 4. Parse payload
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to parse webhook JSON for delivery {x_github_delivery}: {e}")
        return {"status": "error", "message": "Invalid JSON"}

    # 5. Handle events
    action = payload.get("action", "")

    # Event A: installation (created, deleted, suspend, unsuspend)
    if x_github_event == "installation":
        installation_data = payload.get("installation", {})
        inst_id = installation_data.get("id")
        account_login = installation_data.get("account", {}).get("login", "")
        permissions = installation_data.get("permissions", {})

        if action in ("deleted", "suspend"):
            logger.info(f"Installation {inst_id} ({account_login}) {action}. Marking revoked and cancelling runs.")
            # Mark revoked
            stmt = select(Installation).where(Installation.github_installation_id == inst_id)
            res = await db.execute(stmt)
            inst = res.scalars().first()
            if inst:
                inst.status = "revoked"

            # Cancel any queued or running runs for repositories belonging to this installation
            if inst:
                stmt_repos = select(Repository.id).where(Repository.installation_id == inst.id)
                res_repos = await db.execute(stmt_repos)
                repo_ids = res_repos.scalars().all()
                if repo_ids:
                    stmt_prs = select(PullRequest.id).where(PullRequest.repo_id.in_(repo_ids))
                    res_prs = await db.execute(stmt_prs)
                    pr_ids = res_prs.scalars().all()
                    if pr_ids:
                        cancel_stmt = (
                            update(ReviewRun)
                            .where(ReviewRun.pr_id.in_(pr_ids), ReviewRun.status.in_(["queued", "running"]))
                            .values(status="cancelled", error_code="INSTALLATION_REVOKED")
                        )
                        await db.execute(cancel_stmt)
            await db.commit()
            return {"status": "installation_revoked", "installation_id": inst_id}

        elif action in ("created", "unsuspend"):
            stmt = select(Installation).where(Installation.github_installation_id == inst_id)
            res = await db.execute(stmt)
            inst = res.scalars().first()
            if not inst:
                inst = Installation(
                    github_installation_id=inst_id,
                    account_login=account_login,
                    status="active",
                    permissions_json=permissions,
                )
                db.add(inst)
            else:
                inst.status = "active"
                inst.account_login = account_login
                inst.permissions_json = permissions
            await db.commit()
            return {"status": "installation_activated", "installation_id": inst_id}

    # Event B: pull_request
    elif x_github_event == "pull_request":
        pr_data = payload.get("pull_request", {})
        repo_data = payload.get("repository", {})
        full_name = repo_data.get("full_name")
        pr_number = pr_data.get("number")
        head_sha = pr_data.get("head", {}).get("sha")

        if action in ("opened", "synchronize", "reopened", "ready_for_review"):
            # Check if repo exists or auto-register if test
            stmt_repo = select(Repository).where(Repository.full_name == full_name)
            res_repo = await db.execute(stmt_repo)
            repo = res_repo.scalars().first()

            if not repo:
                # Ensure installation exists
                inst_id = payload.get("installation", {}).get("id", 1)
                stmt_inst = select(Installation).where(Installation.github_installation_id == inst_id)
                res_inst = await db.execute(stmt_inst)
                inst = res_inst.scalars().first()
                if not inst:
                    inst = Installation(
                        github_installation_id=inst_id,
                        account_login=repo_data.get("owner", {}).get("login", "unknown"),
                        status="active",
                    )
                    db.add(inst)
                    await db.flush()

                repo = Repository(
                    installation_id=inst.id,
                    full_name=full_name or "unknown/repo",
                    default_branch=repo_data.get("default_branch", "main"),
                    language_set=["python", "javascript", "typescript"],
                )
                db.add(repo)
                await db.flush()

            # Stale-run cancellation on synchronize:
            # "a new synchronize event cancels any queued/running run for the same PR and starts a new one."
            stmt_pr = select(PullRequest).where(
                PullRequest.repo_id == repo.id,
                PullRequest.number == pr_number,
            )
            res_pr = await db.execute(stmt_pr)
            pr = res_pr.scalars().first()

            if not pr:
                pr = PullRequest(
                    repo_id=repo.id,
                    number=pr_number,
                    title=pr_data.get("title", ""),
                    author_id=pr_data.get("user", {}).get("login", "unknown"),
                    head_sha=head_sha or "",
                    base_branch=pr_data.get("base", {}).get("ref", "main"),
                    state="open",
                    is_draft=pr_data.get("draft", False),
                    is_fork=pr_data.get("head", {}).get("repo", {}).get("fork", False),
                    is_bot=pr_data.get("user", {}).get("type") == "Bot",
                )
                db.add(pr)
                await db.flush()
            else:
                pr.head_sha = head_sha or pr.head_sha
                pr.title = pr_data.get("title", pr.title)
                pr.is_draft = pr_data.get("draft", pr.is_draft)

                # Cancel previous queued/running runs
                if action == "synchronize":
                    cancel_stmt = (
                        update(ReviewRun)
                        .where(ReviewRun.pr_id == pr.id, ReviewRun.status.in_(["queued", "running"]))
                        .values(status="cancelled", error_code="SUPERSEDED_BY_SYNCHRONIZE")
                    )
                    await db.execute(cancel_stmt)

            # Create new ReviewRun
            new_run = ReviewRun(
                pr_id=pr.id,
                head_sha=head_sha or "",
                status="queued",
                stage="intake",
                delivery_id=x_github_delivery,
            )
            db.add(new_run)
            await db.commit()

            # Enqueue review job to background worker
            await enqueue_job(
                "review_pr",
                run_id=new_run.id,
                pr_id=pr.id,
                head_sha=head_sha,
                delivery_id=x_github_delivery,
            )

            return {
                "status": "enqueued",
                "run_id": new_run.id,
                "pr_number": pr_number,
                "delivery_id": x_github_delivery,
            }

        elif action == "closed":
            stmt_pr = select(PullRequest).join(Repository).where(
                Repository.full_name == full_name,
                PullRequest.number == pr_number,
            )
            res_pr = await db.execute(stmt_pr)
            pr = res_pr.scalars().first()
            if pr:
                pr.state = "closed"
                # Cancel queued runs
                cancel_stmt = (
                    update(ReviewRun)
                    .where(ReviewRun.pr_id == pr.id, ReviewRun.status.in_(["queued", "running"]))
                    .values(status="cancelled", error_code="PR_CLOSED")
                )
                await db.execute(cancel_stmt)
                await db.commit()
            return {"status": "pr_closed", "pr_number": pr_number}

    # Unknown or unhandled event: return 200 and acknowledge
    return {
        "status": "ignored",
        "event": x_github_event,
        "action": action,
        "delivery_id": x_github_delivery,
    }
