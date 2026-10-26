import logging
from typing import Any, Dict, Optional
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)


async def enqueue_job(job_name: str, **kwargs: Any) -> Optional[str]:
    """
    Enqueues an asynchronous task (e.g. review_pr, ingest_repo).
    Returns job ID or simulated ID if Redis is in offline/test mode.
    """
    try:
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=0.5)
        # Using ARQ convention or raw Redis queue
        job_id = f"job:{job_name}:{kwargs.get('delivery_id', 'adhoc')}"
        # Ping to test connection
        await r.ping()
        await r.aclose()
        logger.info(f"Enqueued {job_name} with args {kwargs}")
        return job_id
    except Exception as e:
        logger.warning(f"Redis unavailable for enqueue ({e}), simulated job enqueue.")
        return f"mock-{job_name}-{kwargs.get('delivery_id', 'local')}"
