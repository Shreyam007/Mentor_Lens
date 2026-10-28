import os
import re
from typing import List, Optional, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_async_db_url(url: str) -> str:
    """Normalizes PostgreSQL connection URLs for SQLAlchemy Async Engine (asyncpg)."""
    if not url:
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def normalize_sync_db_url(url: str) -> str:
    """Normalizes PostgreSQL / SQLite connection URLs for Alembic sync migrations."""
    if not url:
        return url
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    if url.startswith("sqlite+aiosqlite:///"):
        return url.replace("sqlite+aiosqlite:///", "sqlite:///", 1)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # App
    PROJECT_NAME: str = "MentorLens"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    ENV: Optional[str] = None
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = "development-secret-key-at-least-32-chars-long!"
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "https://mentorlens-nine.vercel.app",
        "https://mentorlens.vercel.app",
    ]

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./mentorlens.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Chroma Vector Store
    CHROMA_HOST: Optional[str] = None
    CHROMA_PORT: int = 8000
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_data"

    # GitHub
    GITHUB_APP_ID: Optional[str] = None
    GITHUB_APP_PRIVATE_KEY_PATH: Optional[str] = None
    GITHUB_APP_PRIVATE_KEY: Optional[str] = None
    GITHUB_WEBHOOK_SECRET: str = "development_webhook_secret_12345"
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Auth & JWT Configuration
    JWT_SECRET: str = "dev-jwt-secret-min-32-bytes-long-for-testing!!"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    JWT_ISSUER: str = "mentorlens"
    JWT_AUDIENCE: str = "mentorlens-web"
    ALLOWED_REDIRECT_HOSTS: List[str] = [
        "localhost",
        "127.0.0.1",
        "mentorlens-nine.vercel.app",
        "mentorlens.vercel.app",
    ]

    # LLM & Budgets
    DEFAULT_LLM_PROVIDER: str = "claude"
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    MONTHLY_COST_CAP_USD: float = 50.0

    # Cookie & Security
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: Optional[str] = None
    ENFORCE_REDIS_RATE_LIMIT: bool = False

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            import json
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def is_production(self) -> bool:
        env_val = (self.ENV or self.ENVIRONMENT).lower()
        return env_val in ("production", "prod")

    @property
    def async_database_url(self) -> str:
        return normalize_async_db_url(self.DATABASE_URL)

    @property
    def sync_database_url(self) -> str:
        return normalize_sync_db_url(self.DATABASE_URL)

    def validate_production_environment(self) -> None:
        """
        Validates environment variables for production deployments.
        Fails fast with ONE clear message naming the variable (no stack-trace maze).
        """
        if not self.is_production:
            return

        # 1. DATABASE_URL
        if not self.DATABASE_URL or "sqlite" in self.DATABASE_URL.lower() or "localhost" in self.DATABASE_URL.lower():
            raise RuntimeError("Configuration error: Missing required production environment variable: DATABASE_URL")

        # 2. REDIS_URL
        if not self.REDIS_URL or "localhost" in self.REDIS_URL.lower() or "127.0.0.1" in self.REDIS_URL.lower():
            raise RuntimeError("Configuration error: Missing required production environment variable: REDIS_URL")

        # 3. SECRET_KEY
        if (
            not self.SECRET_KEY
            or len(self.SECRET_KEY) < 32
            or "development" in self.SECRET_KEY.lower()
        ):
            raise RuntimeError("Configuration error: Missing required production environment variable: SECRET_KEY (must be at least 32 characters)")

        # 4. JWT_SECRET
        if (
            not self.JWT_SECRET
            or len(self.JWT_SECRET) < 32
            or "dev-" in self.JWT_SECRET.lower()
        ):
            raise RuntimeError("Configuration error: Missing required production environment variable: JWT_SECRET (must be at least 32 characters)")


settings = Settings()
