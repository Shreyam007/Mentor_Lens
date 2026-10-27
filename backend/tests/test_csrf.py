import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import create_session_token, generate_csrf_token
from app.db.init_db import init_db
from app.db.models import User
from app.db.session import AsyncSessionLocal
from app.main import app


@pytest.mark.asyncio
async def test_safe_methods_bypass_csrf():
    """Safe methods (GET) do not require CSRF token headers."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200


@pytest.mark.asyncio
async def test_mutating_request_missing_csrf_returns_403():
    """Mutating request with active session but missing X-CSRF-Token returns 403."""
    csrf_token = generate_csrf_token()
    cookies = {
        "ml_session": "mock_session_token",
        "ml_csrf": csrf_token,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=cookies) as client:
        res = await client.post("/api/demo/reset", json={})
        assert res.status_code == 403
        data = res.json()
        assert data["error"]["code"] == "CSRF_TOKEN_MISMATCH"


@pytest.mark.asyncio
async def test_mutating_request_mismatched_csrf_returns_403():
    """Mutating request with invalid X-CSRF-Token returns 403."""
    cookies = {
        "ml_session": "mock_session_token",
        "ml_csrf": "valid_token_value",
    }
    headers = {
        "X-CSRF-Token": "tampered_token_value",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=cookies) as client:
        res = await client.post("/api/demo/reset", json={}, headers=headers)
        assert res.status_code == 403
        data = res.json()
        assert data["error"]["code"] == "CSRF_TOKEN_MISMATCH"


@pytest.mark.asyncio
async def test_mutating_request_valid_csrf_succeeds():
    """Mutating request with matching X-CSRF-Token passes CSRF validation."""
    csrf_token = generate_csrf_token()
    cookies = {
        "ml_session": "mock_session_token",
        "ml_csrf": csrf_token,
    }
    headers = {
        "X-CSRF-Token": csrf_token,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=cookies) as client:
        res = await client.post("/api/demo/reset", json={}, headers=headers)
        # Bypassed CSRF; demo reset returns 200
        assert res.status_code == 200
        assert res.json()["status"] == "demo_reset_complete"



@pytest.mark.asyncio
async def test_webhook_exempt_from_csrf():
    """Webhook endpoints are exempt from browser CSRF tokens."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid signature returns 401, NOT 403 CSRF mismatch
        res = await client.post(
            "/webhooks/github",
            content=b"{}",
            headers={"X-GitHub-Delivery": "test-del", "X-GitHub-Event": "ping"},
        )
        assert res.status_code == 401
