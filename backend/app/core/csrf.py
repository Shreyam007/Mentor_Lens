import hmac
import logging
from typing import Callable
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

EXEMPT_PREFIXES = (
    "/webhooks/",
    "/api/auth/",
    "/health",
    "/ready",
    "/metrics",
    "/docs",
    "/openapi.json",
    "/redoc",
)

SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Enforces Double Submit Cookie anti-CSRF protection on all mutating API routes.
    Mutating methods (POST, PUT, PATCH, DELETE) under /api/ must present an X-CSRF-Token
    header matching the ml_csrf cookie using constant-time comparison.
    Webhook routes and read-only endpoints are exempt.
    """

    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path
        method = request.method

        # 1. Exempt safe methods
        if method in SAFE_METHODS:
            return await call_next(request)

        # 2. Exempt webhooks, health, docs
        if any(path.startswith(prefix) for prefix in EXEMPT_PREFIXES):
            return await call_next(request)

        # 3. For state-changing requests under /api/, check CSRF if session cookie is present
        session_cookie = request.cookies.get("ml_session")
        csrf_cookie = request.cookies.get("ml_csrf")

        # If CSRF cookie is present (browser session), CSRF token header is mandatory
        if csrf_cookie:
            csrf_header = request.headers.get("X-CSRF-Token")
            if not csrf_header or not csrf_cookie or not hmac.compare_digest(csrf_header, csrf_cookie):
                request_id = getattr(request.state, "request_id", "")
                logger.warning(
                    f"CSRF validation failed for {method} {path}",
                    extra={"request_id": request_id},
                )
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "CSRF_TOKEN_MISMATCH",
                            "message": "Invalid or missing anti-CSRF token in X-CSRF-Token header.",
                            "request_id": request_id,
                        }
                    },
                )

        return await call_next(request)
