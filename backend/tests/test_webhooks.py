import hashlib
import hmac
import json
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.db.init_db import init_db
from app.db.models import Installation, PullRequest, Repository, ReviewRun, WebhookDelivery
from app.db.session import AsyncSessionLocal
from app.main import app


def compute_signature(payload_bytes: bytes, secret: str) -> str:
    mac = hmac.new(secret.encode("utf-8"), msg=payload_bytes, digestmod=hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


@pytest.mark.asyncio
async def test_webhook_invalid_signature():
    await init_db()
    payload = json.dumps({"action": "opened"}).encode("utf-8")
    headers = {
        "X-GitHub-Delivery": str(uuid.uuid4()),
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": "sha256=invalidhexsignature00000000000000000000000000000000000000000000",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/webhooks/github", content=payload, headers=headers)
        assert res.status_code == 401
        data = res.json()
        assert "Invalid or missing webhook signature" in str(data)


@pytest.mark.asyncio
async def test_webhook_missing_signature():
    await init_db()
    payload = json.dumps({"action": "opened"}).encode("utf-8")
    headers = {
        "X-GitHub-Delivery": str(uuid.uuid4()),
        "X-GitHub-Event": "pull_request",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/webhooks/github", content=payload, headers=headers)
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_webhook_valid_delivery_and_idempotency():
    await init_db()
    delivery_id = str(uuid.uuid4())
    payload_dict = {
        "action": "opened",
        "repository": {
            "full_name": "acme/mentorlens-test-repo",
            "default_branch": "main",
            "owner": {"login": "acme"},
        },
        "pull_request": {
            "number": 42,
            "title": "Fix SQL vulnerability",
            "user": {"login": "meera", "type": "User"},
            "head": {"sha": "a1b2c3d4e5f6", "repo": {"fork": False}},
            "base": {"ref": "main"},
            "draft": False,
        },
        "installation": {"id": 1001},
    }
    payload_bytes = json.dumps(payload_dict).encode("utf-8")
    sig = compute_signature(payload_bytes, settings.GITHUB_WEBHOOK_SECRET)
    headers = {
        "X-GitHub-Delivery": delivery_id,
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": sig,
        "Content-Type": "application/json",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # First delivery
        res1 = await client.post("/webhooks/github", content=payload_bytes, headers=headers)
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["status"] == "enqueued"
        assert data1["delivery_id"] == delivery_id
        run_id_1 = data1["run_id"]

        # Duplicate delivery with same X-GitHub-Delivery ID
        res2 = await client.post("/webhooks/github", content=payload_bytes, headers=headers)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "duplicate_acknowledged"

    # Verify in DB that only 1 ReviewRun was created with this delivery_id
    async with AsyncSessionLocal() as session:
        stmt = select(ReviewRun).where(ReviewRun.delivery_id == delivery_id)
        runs = (await session.execute(stmt)).scalars().all()
        assert len(runs) == 1
        assert runs[0].id == run_id_1


@pytest.mark.asyncio
async def test_webhook_installation_revoked():
    await init_db()
    inst_id = int(uuid.uuid4().int % 100000000)
    # First, simulate creating an installation and queued run
    async with AsyncSessionLocal() as session:
        inst = Installation(
            github_installation_id=inst_id,
            account_login="org-under-test",
            status="active",
        )
        session.add(inst)
        await session.flush()

        repo = Repository(
            installation_id=inst.id,
            full_name=f"org-under-test/repo-{inst_id}",
            default_branch="main",
        )
        session.add(repo)
        await session.flush()

        pr = PullRequest(
            repo_id=repo.id,
            number=1,
            title="PR 1",
            author_id="dev1",
            head_sha="head123",
        )
        session.add(pr)
        await session.flush()

        run = ReviewRun(
            pr_id=pr.id,
            head_sha="head123",
            status="queued",
            delivery_id=str(uuid.uuid4()),
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    # Now send installation.deleted webhook
    payload_dict = {
        "action": "deleted",
        "installation": {
            "id": inst_id,
            "account": {"login": "org-under-test"},
        },
    }
    payload_bytes = json.dumps(payload_dict).encode("utf-8")
    sig = compute_signature(payload_bytes, settings.GITHUB_WEBHOOK_SECRET)
    headers = {
        "X-GitHub-Delivery": str(uuid.uuid4()),
        "X-GitHub-Event": "installation",
        "X-Hub-Signature-256": sig,
        "Content-Type": "application/json",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/webhooks/github", content=payload_bytes, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "installation_revoked"

    # Verify installation status is revoked and the queued run was cancelled
    async with AsyncSessionLocal() as session:
        inst_db = (
            await session.execute(
                select(Installation).where(Installation.github_installation_id == inst_id)
            )
        ).scalars().first()
        assert inst_db is not None
        assert inst_db.status == "revoked"

        run_db = (
            await session.execute(select(ReviewRun).where(ReviewRun.id == run_id))
        ).scalars().first()
        assert run_db is not None
        assert run_db.status == "cancelled"
        assert run_db.error_code == "INSTALLATION_REVOKED"


@pytest.mark.asyncio
async def test_webhook_synchronize_cancels_previous_run():
    await init_db()
    repo_name = "test-org/sync-repo"
    pr_num = 10

    # 1. First event: opened
    payload_1 = {
        "action": "opened",
        "repository": {"full_name": repo_name, "default_branch": "main", "owner": {"login": "test-org"}},
        "pull_request": {
            "number": pr_num,
            "title": "Feature Branch",
            "user": {"login": "dev", "type": "User"},
            "head": {"sha": "sha_v1", "repo": {"fork": False}},
            "base": {"ref": "main"},
            "draft": False,
        },
        "installation": {"id": 2002},
    }
    bytes_1 = json.dumps(payload_1).encode("utf-8")
    sig_1 = compute_signature(bytes_1, settings.GITHUB_WEBHOOK_SECRET)
    delivery_1 = str(uuid.uuid4())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_1 = await client.post(
            "/webhooks/github",
            content=bytes_1,
            headers={
                "X-GitHub-Delivery": delivery_1,
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": sig_1,
            },
        )
        assert res_1.status_code == 200
        run_1_id = res_1.json()["run_id"]

        # 2. Second event: synchronize (new commit pushed to PR)
        payload_2 = {
            "action": "synchronize",
            "repository": {"full_name": repo_name, "default_branch": "main", "owner": {"login": "test-org"}},
            "pull_request": {
                "number": pr_num,
                "title": "Feature Branch",
                "user": {"login": "dev", "type": "User"},
                "head": {"sha": "sha_v2", "repo": {"fork": False}},
                "base": {"ref": "main"},
                "draft": False,
            },
            "installation": {"id": 2002},
        }
        bytes_2 = json.dumps(payload_2).encode("utf-8")
        sig_2 = compute_signature(bytes_2, settings.GITHUB_WEBHOOK_SECRET)
        delivery_2 = str(uuid.uuid4())

        res_2 = await client.post(
            "/webhooks/github",
            content=bytes_2,
            headers={
                "X-GitHub-Delivery": delivery_2,
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": sig_2,
            },
        )
        assert res_2.status_code == 200
        run_2_id = res_2.json()["run_id"]

    # Verify run 1 was cancelled and run 2 is queued
    async with AsyncSessionLocal() as session:
        r1 = (await session.execute(select(ReviewRun).where(ReviewRun.id == run_1_id))).scalars().first()
        r2 = (await session.execute(select(ReviewRun).where(ReviewRun.id == run_2_id))).scalars().first()

        assert r1.status == "cancelled"
        assert r1.error_code == "SUPERSEDED_BY_SYNCHRONIZE"
        assert r2.status == "queued"
        assert r2.head_sha == "sha_v2"
