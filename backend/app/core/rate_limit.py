import enum
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from redis.asyncio import Redis, from_url

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)


class RateLimitTier(str, enum.Enum):
    PUBLIC_READ = "public_read"      # 60 req / min, fail-open
    AUTH = "auth"                    # 10 req / min, fail-closed
    MUTATION = "mutation"            # 20 req / min, fail-closed
    WEBHOOK = "webhook"              # 120 req / min, fail-open


TIER_LIMITS: Dict[RateLimitTier, Tuple[int, int]] = {
    # Tier: (max_requests, window_seconds)
    RateLimitTier.PUBLIC_READ: (60, 60),
    RateLimitTier.AUTH: (10, 60),
    RateLimitTier.MUTATION: (20, 60),
    RateLimitTier.WEBHOOK: (120, 60),
}

# Explicit Route-to-Tier Mapping covering EVERY endpoint
ROUTE_TIER_MAPPING: List[Tuple[str, str, RateLimitTier]] = [
    # Health & System
    ("GET", "/health", RateLimitTier.PUBLIC_READ),
    ("GET", "/ready", RateLimitTier.PUBLIC_READ),
    ("GET", "/metrics", RateLimitTier.PUBLIC_READ),

    # GitHub Webhook
    ("POST", "/webhooks/github", RateLimitTier.WEBHOOK),

    # Auth
    ("GET", "/api/auth/github", RateLimitTier.AUTH),
    ("GET", "/api/auth/github/callback", RateLimitTier.AUTH),
    ("POST", "/api/auth/logout", RateLimitTier.AUTH),
    ("GET", "/api/auth/me", RateLimitTier.PUBLIC_READ),

    # Repositories
    ("GET", "/api/repos", RateLimitTier.PUBLIC_READ),
    ("POST", r"^/api/repos/[^/]+/index$", RateLimitTier.MUTATION),
    ("GET", r"^/api/repos/[^/]+/index/status$", RateLimitTier.PUBLIC_READ),

    # Pull Requests
    ("GET", "/api/prs", RateLimitTier.PUBLIC_READ),
    ("GET", r"^/api/prs/[^/]+$", RateLimitTier.PUBLIC_READ),

    # Runs
    ("POST", r"^/api/runs/[^/]+/rerun$", RateLimitTier.MUTATION),
    ("GET", r"^/api/runs/[^/]+/trace$", RateLimitTier.PUBLIC_READ),

    # Findings
    ("POST", r"^/api/findings/[^/]+/feedback$", RateLimitTier.MUTATION),
    ("POST", r"^/api/findings/[^/]+/dismiss$", RateLimitTier.MUTATION),
    ("POST", r"^/api/findings/[^/]+/mark-fixed$", RateLimitTier.MUTATION),

    # Memory
    ("GET", "/api/memory/search", RateLimitTier.PUBLIC_READ),
    ("POST", r"^/api/memory/[^/]+/exclude$", RateLimitTier.MUTATION),
    ("POST", "/api/memory/resync", RateLimitTier.MUTATION),

    # Developers & Analytics
    ("GET", r"^/api/developers/[^/]+/progress$", RateLimitTier.PUBLIC_READ),
    ("GET", "/api/analytics/team", RateLimitTier.PUBLIC_READ),
    ("GET", "/api/analytics/eval", RateLimitTier.PUBLIC_READ),

    # Settings
    ("GET", "/api/settings/rules", RateLimitTier.PUBLIC_READ),
    ("PUT", "/api/settings/rules", RateLimitTier.MUTATION),
    ("GET", "/api/settings/integrations", RateLimitTier.PUBLIC_READ),
    ("POST", "/api/settings/integrations/llm/test", RateLimitTier.MUTATION),
    ("POST", r"^/api/settings/integrations/webhooks/[^/]+/redeliver$", RateLimitTier.MUTATION),
    ("DELETE", "/api/settings/data", RateLimitTier.MUTATION),

    # Demo Mode
    ("POST", "/api/demo/reset", RateLimitTier.MUTATION),
    ("POST", "/api/demo/create-pr", RateLimitTier.MUTATION),
    ("GET", "/api/demo/replay", RateLimitTier.PUBLIC_READ),

    # Events (SSE)
    ("GET", "/api/events", RateLimitTier.PUBLIC_READ),
]

_compiled_routes: List[Tuple[str, re.Pattern, RateLimitTier]] = [
    (m, re.compile(p if p.startswith("^") else f"^{re.escape(p)}$"), tier)
    for m, p, tier in ROUTE_TIER_MAPPING
]


def resolve_route_tier(method: str, path: str) -> Optional[RateLimitTier]:
    """Matches an HTTP method and path against the route tier table."""
    for m, pattern, tier in _compiled_routes:
        if m == method and pattern.match(path):
            return tier
    return None


# Storage
_memory_rate_limit_store: Dict[str, list] = {}
_redis_client: Optional[Redis] = None


async def get_redis_client() -> Optional[Redis]:
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        except Exception as e:
            logger.warning(f"Unable to initialize Redis connection: {e}")
            _redis_client = None
    return _redis_client


def get_client_identifier(request: Request) -> str:
    """Derives unique rate-limit key from user session or client IP."""
    session_cookie = request.cookies.get("ml_session")
    if session_cookie:
        return f"user:{session_cookie[:16]}"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
        return f"ip:{client_ip}"
    if request.client and request.client.host:
        return f"ip:{request.client.host}"
    return "ip:127.0.0.1"


async def check_rate_limit(
    request: Request,
    tier: RateLimitTier,
    force_redis_fail: bool = False,
) -> Tuple[bool, int, int, int, int]:
    """
    Evaluates rate limit. Returns (allowed, limit, remaining, reset_time, retry_after).
    Raises AppError(503) if fail-closed auth/mutation tier cannot reach Redis.
    """
    max_requests, window_seconds = TIER_LIMITS[tier]
    client_id = get_client_identifier(request)
    key = f"ratelimit:{tier.value}:{client_id}"
    now = time.time()
    reset_time = int(now + window_seconds)

    redis_ok = False
    count = 0

    if not force_redis_fail:
        try:
            r = await get_redis_client()
            if r is not None:
                await r.ping()
                pipe = r.pipeline()
                pipe.incr(key)
                pipe.ttl(key)
                results = await pipe.execute()
                count = results[0]
                ttl = results[1]
                if ttl == -1:
                    await r.expire(key, window_seconds)
                    ttl = window_seconds
                reset_time = int(now + max(1, ttl))
                redis_ok = True
        except Exception as e:
            logger.warning(f"Redis rate limiter unavailable ({e}) for {tier.value}")
            redis_ok = False

    if not redis_ok:
        # Fail-closed for AUTH and MUTATION when Redis fails in production/strict mode
        if tier in (RateLimitTier.AUTH, RateLimitTier.MUTATION) and getattr(settings, "ENFORCE_REDIS_RATE_LIMIT", False):
            raise AppError(
                code="RATE_LIMIT_UNAVAILABLE",
                message="Rate limiting service is unavailable. Request rejected fail-closed for security.",
                status_code=503,
            )

        # In-memory sliding window
        timestamps = _memory_rate_limit_store.setdefault(key, [])
        cutoff = now - window_seconds
        timestamps = [t for t in timestamps if t > cutoff]
        timestamps.append(now)
        _memory_rate_limit_store[key] = timestamps
        count = len(timestamps)

    remaining = max(0, max_requests - count)
    allowed = count <= max_requests
    retry_after = max(1, reset_time - int(now)) if not allowed else 0

    return allowed, max_requests, remaining, reset_time, retry_after


class TieredRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware applying tiered Redis rate limiting across every API route.
    Sets standard 429 status code and headers:
      - Retry-After
      - X-RateLimit-Limit
      - X-RateLimit-Remaining
      - X-RateLimit-Reset
    """

    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path

        # Ignore documentation and schema paths
        if path in ("/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"):
            return await call_next(request)

        method = request.method
        tier = resolve_route_tier(method, path)

        # If an application route lacks a tier, default to MUTATION if unsafe else PUBLIC_READ
        if tier is None:
            tier = RateLimitTier.MUTATION if method in ("POST", "PUT", "DELETE", "PATCH") else RateLimitTier.PUBLIC_READ

        try:
            allowed, limit, remaining, reset_time, retry_after = await check_rate_limit(request, tier)
        except AppError as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": {
                        "code": exc.code,
                        "message": exc.message,
                        "request_id": getattr(request.state, "request_id", ""),
                    }
                },
            )

        if not allowed:
            headers = {
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_time),
            }
            return JSONResponse(
                status_code=429,
                headers=headers,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded for tier '{tier.value}'. Limit is {limit} requests per 60s.",
                        "retry_after": retry_after,
                        "tier": tier.value,
                        "request_id": getattr(request.state, "request_id", ""),
                    }
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)
        return response
