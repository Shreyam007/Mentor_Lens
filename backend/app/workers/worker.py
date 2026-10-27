import asyncio
import logging
from app.core.config import settings
from app.core.logging import setup_logging
from app.db.init_db import init_db

setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger("mentorlens.worker")


async def main() -> None:
    logger.info(f"Starting MentorLens background worker [{settings.ENVIRONMENT}]...")
    await init_db()
    logger.info("Database initialized. Background worker ready to process review jobs.")
    try:
        while True:
            await asyncio.sleep(10)
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Worker received shutdown signal. Exiting.")


if __name__ == "__main__":
    asyncio.run(main())
