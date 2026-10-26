import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import create_session_token
from app.db.init_db import init_db
from app.db.models import User
from app.db.session import AsyncSessionLocal
from app.main import app


@pytest.fixture
async def auth_cookies():
    await init_db()
    async with AsyncSessionLocal() as session:
        # Create users with unique github_ids
        uid_base = int(uuid.uuid4().int % 100000000)
        dev = User(
            id=str(uuid.uuid4()),
            github_id=uid_base + 1,
            login=f"dev-{uid_base}",
            role="developer",
        )
        lead = User(
            id=str(uuid.uuid4()),
            github_id=uid_base + 2,
            login=f"lead-{uid_base}",
            role="lead",
        )
        admin = User(
            id=str(uuid.uuid4()),
            github_id=uid_base + 3,
            login=f"admin-{uid_base}",
            role="admin",
        )
        session.add_all([dev, lead, admin])
        await session.commit()

        dev_token = create_session_token({"sub": dev.id, "login": dev.login, "role": dev.role})
        lead_token = create_session_token({"sub": lead.id, "login": lead.login, "role": lead.role})
        admin_token = create_session_token({"sub": admin.id, "login": admin.login, "role": admin.role})

        return {
            "developer": {"ml_session": dev_token},
            "lead": {"ml_session": lead_token},
            "admin": {"ml_session": admin_token},
        }


@pytest.mark.asyncio
async def test_rbac_authorization_boundaries(auth_cookies):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Developer tries to access admin-only endpoint -> 403 Forbidden
        res_dev = await client.put(
            "/api/settings/rules",
            cookies=auth_cookies["developer"],
            json={"review_drafts": True},
        )
        assert res_dev.status_code == 403

        # Lead tries to access admin-only endpoint -> 403 Forbidden
        res_lead = await client.put(
            "/api/settings/rules",
            cookies=auth_cookies["lead"],
            json={"review_drafts": True},
        )
        assert res_lead.status_code == 403

        # Admin accesses admin-only endpoint -> 200 OK
        res_admin = await client.put(
            "/api/settings/rules",
            cookies=auth_cookies["admin"],
            json={"review_drafts": True},
        )
        assert res_admin.status_code == 200


@pytest.mark.asyncio
async def test_pagination_bounds_and_validation(auth_cookies):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid page (page=0 fails ge=1)
        res_invalid_page = await client.get(
            "/api/repos?page=0",
            cookies=auth_cookies["developer"],
        )
        assert res_invalid_page.status_code == 422

        # Invalid limit (limit=500 fails le=100)
        res_invalid_limit = await client.get(
            "/api/repos?limit=500",
            cookies=auth_cookies["developer"],
        )
        assert res_invalid_limit.status_code == 422

        # Valid pagination
        res_valid = await client.get(
            "/api/repos?page=1&limit=10",
            cookies=auth_cookies["developer"],
        )
        assert res_valid.status_code == 200
        data = res_valid.json()
        assert "items" in data
        assert data["limit"] == 10


@pytest.mark.asyncio
async def test_dashboard_apis_flow(auth_cookies):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Reset Demo state
        demo_reset = await client.post("/api/demo/reset")
        assert demo_reset.status_code == 200
        assert demo_reset.json()["status"] == "demo_reset_complete"

        # 2. Create Demo PR
        demo_pr = await client.post("/api/demo/create-pr")
        assert demo_pr.status_code == 200
        pr_id = demo_pr.json()["pr_id"]

        # 3. Fetch PR list & detail
        prs_res = await client.get("/api/prs", cookies=auth_cookies["developer"])
        assert prs_res.status_code == 200

        pr_detail = await client.get(f"/api/prs/{pr_id}", cookies=auth_cookies["developer"])
        assert pr_detail.status_code == 200

        # 4. Search memory
        mem_res = await client.get("/api/memory/search?q=sql+injection", cookies=auth_cookies["developer"])
        assert mem_res.status_code == 200

        # 5. Developer progress
        dev_res = await client.get("/api/developers/meera/progress", cookies=auth_cookies["developer"])
        assert dev_res.status_code == 200
        assert dev_res.json()["login"] == "meera"

        # 6. Team analytics & eval
        analytics_res = await client.get("/api/analytics/team", cookies=auth_cookies["lead"])
        assert analytics_res.status_code == 200

        eval_res = await client.get("/api/analytics/eval", cookies=auth_cookies["lead"])
        assert eval_res.status_code == 200
        assert "metrics" in eval_res.json()

        # 7. Integrations health
        int_res = await client.get("/api/settings/integrations", cookies=auth_cookies["lead"])
        assert int_res.status_code == 200
