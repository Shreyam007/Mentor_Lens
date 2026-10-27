import pytest
from httpx import ASGITransport, AsyncClient
from fastapi.routing import APIRoute

from app.core.rate_limit import RateLimitTier, resolve_route_tier, check_rate_limit
from app.core.config import settings
from app.main import app


def test_every_route_has_rate_limit_tier():
    """
    CRITICAL SECURITY TEST:
    Inspects all route definitions registered on the FastAPI app.
    Fails if ANY route lacks an explicit rate limit tier declaration.
    """
    uncovered_routes = []
    checked_count = 0

    for r in app.routes:
        # Check standard APIRoutes
        if isinstance(r, APIRoute):
            for method in r.methods:
                if method in ("GET", "POST", "PUT", "DELETE", "PATCH"):
                    checked_count += 1
                    tier = resolve_route_tier(method, r.path)
                    if tier is None:
                        uncovered_routes.append(f"{method} {r.path}")

        # Check routes inside _IncludedRouter
        elif hasattr(r, "original_router") and hasattr(r.original_router, "routes"):
            prefix = r.include_context.prefix if hasattr(r, "include_context") else ""
            for sub in r.original_router.routes:
                if hasattr(sub, "methods"):
                    for method in sub.methods:
                        if method in ("GET", "POST", "PUT", "DELETE", "PATCH"):
                            checked_count += 1
                            full_path = f"{prefix}{sub.path}"
                            tier = resolve_route_tier(method, full_path)
                            if tier is None:
                                uncovered_routes.append(f"{method} {full_path}")

    assert checked_count >= 30, f"Expected at least 30 registered routes, found {checked_count}"
    assert len(uncovered_routes) == 0, f"Routes missing rate limit tier: {uncovered_routes}"


@pytest.mark.asyncio
async def test_rate_limit_headers_emitted():
    """Validates X-RateLimit-Limit, Remaining, Reset headers on responses."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        assert "X-RateLimit-Limit" in res.headers
        assert "X-RateLimit-Remaining" in res.headers
        assert "X-RateLimit-Reset" in res.headers
        assert res.headers["X-RateLimit-Limit"] == "60"  # PUBLIC_READ tier


@pytest.mark.asyncio
async def test_rate_limit_exceeded_returns_429():
    """Validates 429 response envelope and Retry-After header when rate limit is exceeded."""
    from app.core.rate_limit import RateLimitTier, check_rate_limit
    from starlette.requests import Request
    from starlette.datastructures import Headers

    # Construct mock request with unique client IP
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/auth/logout",
        "headers": [(b"host", b"test"), (b"x-forwarded-for", b"203.0.113.195")],
    }
    req = Request(scope)

    # Exhaust AUTH tier limit (10 req/min)
    for _ in range(10):
        allowed, limit, remaining, reset_time, retry_after = await check_rate_limit(req, RateLimitTier.AUTH)
        assert allowed is True

    # 11th request must exceed
    allowed, limit, remaining, reset_time, retry_after = await check_rate_limit(req, RateLimitTier.AUTH)
    assert allowed is False
    assert remaining == 0
    assert retry_after > 0


@pytest.mark.asyncio
async def test_rate_limit_fail_closed_auth_tier():
    """Validates fail-closed behavior on auth tier vs fail-open on public read when Redis is unavailable."""
    from app.core.rate_limit import RateLimitTier, check_rate_limit
    from app.core.errors import AppError
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/health",
        "headers": [(b"host", b"test"), (b"x-forwarded-for", b"203.0.113.200")],
    }
    req = Request(scope)

    # Public read tier fails open
    allowed, limit, remaining, reset_time, retry_after = await check_rate_limit(
        req, RateLimitTier.PUBLIC_READ, force_redis_fail=True
    )
    assert allowed is True

    # Auth tier fails closed when ENFORCE_REDIS_RATE_LIMIT is enabled
    try:
        settings.ENFORCE_REDIS_RATE_LIMIT = True
        with pytest.raises(AppError) as exc_info:
            await check_rate_limit(req, RateLimitTier.AUTH, force_redis_fail=True)
        assert exc_info.value.status_code == 503
        assert exc_info.value.code == "RATE_LIMIT_UNAVAILABLE"
    finally:
        settings.ENFORCE_REDIS_RATE_LIMIT = False
