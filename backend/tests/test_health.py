import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_liveness():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data
        assert "version" in data
        assert "X-Request-ID" in response.headers


@pytest.mark.asyncio
async def test_request_id_propagation():
    custom_request_id = "test-req-id-12345"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health", headers={"X-Request-ID": custom_request_id})
        assert response.status_code == 200
        assert response.headers["X-Request-ID"] == custom_request_id


@pytest.mark.asyncio
async def test_ready_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/ready")
        # In test environment, status can be 200 (ready) or 503 (if redis/chroma down),
        # but the JSON response structure must be valid
        assert response.status_code in (200, 503)
        data = response.json()
        assert "status" in data
        assert "checks" in data
        assert "database" in data["checks"]
        assert "redis" in data["checks"]
        assert "chroma" in data["checks"]
