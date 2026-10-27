import logging
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, Response, status
from sqlalchemy import text
import httpx
import redis.asyncio as aioredis

from app.core.config import settings
from app.db.session import engine

router = APIRouter(tags=["Health & Readiness"])
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Liveness probe: returns 200 if the process is alive."""
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready")
async def readiness_check(response: Response) -> Dict[str, Any]:
    """Readiness probe: validates DB, Redis, and Chroma dependencies."""
    checks = {
        "database": False,
        "redis": False,
        "chroma": False,
    }
    details: Dict[str, str] = {}

    # 1. Database check
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as e:
        details["database"] = str(e)
        logger.warning(f"Database readiness check failed: {e}")

    # 2. Redis check
    try:
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=1)
        pong = await r.ping()
        await r.aclose()
        if pong:
            checks["redis"] = True
    except Exception as e:
        details["redis"] = str(e)
        logger.warning(f"Redis readiness check failed: {e}")

    # 3. Chroma check
    if settings.CHROMA_HOST:
        try:
            chroma_url = f"http://{settings.CHROMA_HOST}:{settings.CHROMA_PORT}/api/v1/heartbeat"
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(chroma_url)
                if res.status_code == 200:
                    checks["chroma"] = True
                else:
                    details["chroma"] = f"HTTP {res.status_code}"
        except Exception as e:
            details["chroma"] = str(e)
            logger.warning(f"Chroma readiness check failed: {e}")
    else:
        # Local / embedded fallback
        checks["chroma"] = True

    all_ready = all(checks.values())
    if not all_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if all_ready else "not_ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "details": details if details else None,
    }


@router.get("/metrics")
async def prometheus_metrics() -> Response:
    """Prometheus metrics endpoint for observability."""
    from app.core.metrics import metrics
    return Response(content=metrics.to_prometheus_format(), media_type="text/plain")

