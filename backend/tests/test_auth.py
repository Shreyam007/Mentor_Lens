import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.security import create_session_token
from app.db.init_db import init_db
from app.db.models import User
from app.db.session import AsyncSessionLocal
from app.main import app


@pytest.mark.asyncio
async def test_auth_flow_and_me():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Check /github initiates OAuth
        res = await client.get("/api/auth/github")
        assert res.status_code == 200
        assert "authorization_url" in res.json()

        # 2. Simulate callback
        callback_res = await client.get("/api/auth/github/callback?code=mock_code_123")
        assert callback_res.status_code == 200
        assert "ml_session" in callback_res.cookies

        # 3. Access /me with session cookie
        me_res = await client.get("/api/auth/me", cookies=callback_res.cookies)
        assert me_res.status_code == 200
        user_info = me_res.json()
        assert user_info["login"] == "meera-sharma"
        assert user_info["role"] == "lead"

        # 4. Logout clears cookie
        logout_res = await client.post("/api/auth/logout", cookies=callback_res.cookies)
        assert logout_res.status_code == 200


@pytest.mark.asyncio
async def test_unauthenticated_access():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/auth/me")
        assert res.status_code == 401
        data = res.json()
        assert data["error"]["code"] == "UNAUTHORIZED"
