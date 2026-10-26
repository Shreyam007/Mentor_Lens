import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict


class JSONFormatter(logging.Formatter):
    """Formats log records as structured JSON."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }

        # Include request_id and other extra fields if present
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id

        if hasattr(record, "run_id"):
            log_obj["run_id"] = record.run_id

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)


def setup_logging(log_level: str = "INFO") -> None:
    """Configures structured JSON logging globally."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level.upper())
    # Remove existing handlers to avoid duplicate output
    root_logger.handlers = [handler]

    # Adjust third-party loggers if needed
    logging.getLogger("uvicorn.access").handlers = [handler]
