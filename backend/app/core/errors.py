from typing import Any, Optional
from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", details: Optional[Any] = None):
        super().__init__(code="NOT_FOUND", message=message, status_code=404, details=details)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized", details: Optional[Any] = None):
        super().__init__(code="UNAUTHORIZED", message=message, status_code=401, details=details)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden", details: Optional[Any] = None):
        super().__init__(code="FORBIDDEN", message=message, status_code=403, details=details)


class RateLimitExceededError(AppError):
    def __init__(self, message: str = "Rate limit exceeded", details: Optional[Any] = None):
        super().__init__(code="RATE_LIMIT_EXCEEDED", message=message, status_code=429, details=details)


def format_error_response(code: str, message: str, request_id: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "request_id": request_id,
            }
        },
    )
