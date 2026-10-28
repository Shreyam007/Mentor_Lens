import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.demo import router as demo_router
from app.api.developers import router as developers_router
from app.api.events import router as events_router
from app.api.findings import router as findings_router
from app.api.health import router as health_router
from app.api.memory import router as memory_router
from app.api.prs import router as prs_router
from app.api.repos import router as repos_router
from app.api.runs import router as runs_router
from app.api.settings import router as settings_router
from app.github.webhook import router as webhook_router
from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import setup_logging

# Initialize structured logging
setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger("mentorlens")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Assigns or propagates X-Request-ID and attaches it to request.state."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        # Attach request_id to logger context
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces standard web security headers, CSP, and HSTS."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://*.onrender.com https://*.vercel.app ws: wss:;"
        )
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]")
    try:
        settings.validate_production_environment()
    except RuntimeError as e:
        logger.error(str(e))
        raise SystemExit(1)

    # In local/development environments with SQLite, ensure tables are created
    if not settings.is_production:
        try:
            await init_db()
        except Exception as e:
            logger.warning(f"Database initial setup notice: {e}")
    else:
        logger.info("Production mode: Database schema managed via Alembic migrations.")

    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.core.csrf import CSRFMiddleware
from app.core.rate_limit import TieredRateLimitMiddleware

# Request ID, Security Headers, CSRF & Tiered Rate Limiting
app.add_middleware(CSRFMiddleware)
app.add_middleware(TieredRateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)





# Global Exception Handlers
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error(
        f"AppError: {exc.code} - {exc.message}",
        extra={"request_id": request_id},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "request_id": request_id,
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.exception(
        f"Unhandled exception: {str(exc)}",
        extra={"request_id": request_id},
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please contact support with the request ID.",
                "request_id": request_id,
            }
        },
    )


# Include Routers
app.include_router(health_router)
app.include_router(webhook_router)
app.include_router(auth_router)
app.include_router(repos_router)
app.include_router(prs_router)
app.include_router(runs_router)
app.include_router(findings_router)
app.include_router(memory_router)
app.include_router(developers_router)
app.include_router(analytics_router)
app.include_router(settings_router)
app.include_router(demo_router)
app.include_router(events_router)
