import pytest
from fastapi import APIRouter
from httpx import ASGITransport, AsyncClient
from app.core.errors import AppError, NotFoundError, UnauthorizedError
from app.main import app

error_router = APIRouter(prefix="/test-errors")


@error_router.get("/not-found")
async def trigger_not_found():
    raise NotFoundError("Entity was not located")


@error_router.get("/unauthorized")
async def trigger_unauthorized():
    raise UnauthorizedError("Missing token")


@error_router.get("/unhandled")
async def trigger_unhandled():
    raise ValueError("Unexpected crash")


app.include_router(error_router)


@pytest.mark.asyncio
async def test_not_found_envelope():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/test-errors/not-found")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "NOT_FOUND"
        assert data["error"]["message"] == "Entity was not located"
        assert "request_id" in data["error"]


@pytest.mark.asyncio
async def test_unauthorized_envelope():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/test-errors/unauthorized")
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "UNAUTHORIZED"
        assert data["error"]["message"] == "Missing token"
        assert "request_id" in data["error"]


@pytest.mark.asyncio
async def test_unhandled_exception_envelope():
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as client:
        response = await client.get("/test-errors/unhandled")
        assert response.status_code == 500
        data = response.json()
        assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
        assert "request_id" in data["error"]
