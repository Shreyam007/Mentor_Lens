import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # App
    PROJECT_NAME: str = "MentorLens"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = "development-secret-key-at-least-32-chars-long!"
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
    ]

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./mentorlens.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Chroma
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

    # LLM
    DEFAULT_LLM_PROVIDER: str = "claude"
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    MONTHLY_COST_CAP_USD: float = 50.0

    # Cookie
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"


settings = Settings()
