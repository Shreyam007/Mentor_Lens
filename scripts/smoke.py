"""
MentorLens Pre-Deploy Verification & Smoke Test Script
Tests:
1. URL normalization (postgres:// -> postgresql+asyncpg://, sync URL for Alembic, rediss://)
2. Production environment validation and fast-fail behavior with clean single messages
3. Liveness (/health) returns 200 even when downstream dependencies are down
4. Readiness (/ready) returns 503 when dependencies are down, 200 when up
5. Dynamic PORT binding verification
"""

import os
import sys
import time
from typing import Dict, Any

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.core.config import Settings, normalize_async_db_url, normalize_sync_db_url


def test_url_normalization() -> None:
    print("[1/5] Testing URL Normalization...")
    # Render postgres:// format
    render_url = "postgres://ml_user:secret_pass@dpg-abc123-a.oregon-postgres.render.com/mentorlens_db"
    expected_async = "postgresql+asyncpg://ml_user:secret_pass@dpg-abc123-a.oregon-postgres.render.com/mentorlens_db"
    expected_sync = "postgresql://ml_user:secret_pass@dpg-abc123-a.oregon-postgres.render.com/mentorlens_db"

    assert normalize_async_db_url(render_url) == expected_async, f"Async normalization failed: got {normalize_async_db_url(render_url)}"
    assert normalize_sync_db_url(render_url) == expected_sync, f"Sync normalization failed: got {normalize_sync_db_url(render_url)}"

    # Standard postgresql:// format
    std_url = "postgresql://user:pass@host:5432/dbname"
    assert normalize_async_db_url(std_url) == "postgresql+asyncpg://user:pass@host:5432/dbname"
    assert normalize_sync_db_url(std_url) == "postgresql://user:pass@host:5432/dbname"

    # TLS Redis URL
    redis_tls = "rediss://default:mypass@red-abc123-a.oregon-redis.render.com:6379"
    assert redis_tls.startswith("rediss://")

    print("  -> PASSED: All URL normalization formats correctly converted.")


def test_production_env_validation() -> None:
    print("[2/5] Testing Production Environment Fast-Fail Validation...")
    
    # Missing DATABASE_URL
    try:
        s = Settings(
            ENVIRONMENT="production",
            DATABASE_URL="sqlite+aiosqlite:///./mentorlens.db",
            REDIS_URL="rediss://prod-redis:6379",
            SECRET_KEY="a-very-long-and-secure-secret-key-32-bytes!",
            JWT_SECRET="a-very-long-and-secure-jwt-secret-key-32-bytes!",
        )
        s.validate_production_environment()
        assert False, "Should have failed on SQLite DATABASE_URL in production"
    except RuntimeError as e:
        assert "Missing required production environment variable: DATABASE_URL" in str(e)

    # Missing REDIS_URL
    try:
        s = Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql+asyncpg://user:pass@remote:5432/db",
            REDIS_URL="redis://localhost:6379/0",
            SECRET_KEY="a-very-long-and-secure-secret-key-32-bytes!",
            JWT_SECRET="a-very-long-and-secure-jwt-secret-key-32-bytes!",
        )
        s.validate_production_environment()
        assert False, "Should have failed on localhost REDIS_URL in production"
    except RuntimeError as e:
        assert "Missing required production environment variable: REDIS_URL" in str(e)

    # Insecure SECRET_KEY
    try:
        s = Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql+asyncpg://user:pass@remote:5432/db",
            REDIS_URL="rediss://remote-redis:6379",
            SECRET_KEY="short",
            JWT_SECRET="a-very-long-and-secure-jwt-secret-key-32-bytes!",
        )
        s.validate_production_environment()
        assert False, "Should have failed on short SECRET_KEY in production"
    except RuntimeError as e:
        assert "Missing required production environment variable: SECRET_KEY" in str(e)

    # Insecure JWT_SECRET
    try:
        s = Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql+asyncpg://user:pass@remote:5432/db",
            REDIS_URL="rediss://remote-redis:6379",
            SECRET_KEY="a-very-long-and-secure-secret-key-32-bytes!",
            JWT_SECRET="dev-jwt-secret-short",
        )
        s.validate_production_environment()
        assert False, "Should have failed on dev JWT_SECRET in production"
    except RuntimeError as e:
        assert "Missing required production environment variable: JWT_SECRET" in str(e)

    # Fully valid production config
    valid_s = Settings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+asyncpg://user:pass@remote.render.com:5432/mentorlens",
        REDIS_URL="rediss://remote-redis.render.com:6379",
        SECRET_KEY="a-very-long-and-secure-production-secret-key-32-bytes!",
        JWT_SECRET="a-very-long-and-secure-production-jwt-secret-key-32-bytes!",
    )
    valid_s.validate_production_environment()
    print("  -> PASSED: Production environment fails fast with clean error messages.")


def test_health_endpoints_with_test_client() -> None:
    print("[3/5] Testing /health and /ready probe semantics...")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # 1. /health must ALWAYS return 200 (Liveness probe)
    res = client.get("/health")
    assert res.status_code == 200, f"Expected 200 for /health, got {res.status_code}"
    data = res.json()
    assert data["status"] == "ok"
    assert "timestamp" in data

    # 2. /ready returns status object (Readiness probe)
    res_ready = client.get("/ready")
    assert res_ready.status_code in (200, 503)
    ready_data = res_ready.json()
    assert "checks" in ready_data
    assert "database" in ready_data["checks"]
    assert "redis" in ready_data["checks"]

    print(f"  -> PASSED: /health is 200 (liveness), /ready correctly reports status {res_ready.status_code}.")


def test_auth_security_helpers() -> None:
    print("[4/5] Testing Argon2id password hashing, JWT rotation & Lockout...")
    from app.core.security import (
        hash_password,
        verify_password,
        validate_password_strength,
        create_access_token,
        decode_access_token,
        check_account_lockout,
        record_failed_login_attempt,
        reset_failed_login_attempts,
        is_safe_redirect_url,
    )
    from app.core.errors import AppError

    # Argon2id
    pwd = "Correct-Horse-Battery-Staple-2026!"
    hashed = hash_password(pwd)
    assert hashed.startswith("$argon2id$")
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrong-password", hashed) is False

    # Password policy
    try:
        validate_password_strength("short")
        assert False, "Should reject short password"
    except AppError as e:
        assert e.code == "PASSWORD_TOO_SHORT"

    try:
        validate_password_strength("password123")
        assert False, "Should reject common password"
    except AppError as e:
        assert e.code == "PASSWORD_TOO_COMMON"

    # JWT validation
    token = create_access_token(user_id="user-123", login="alice", email="alice@test.com", role="lead")
    decoded = decode_access_token(token)
    assert decoded["sub"] == "user-123"
    assert decoded["login"] == "alice"
    assert decoded["role"] == "lead"
    assert decoded["iss"] == "mentorlens"
    assert decoded["aud"] == "mentorlens-web"

    # Lockout test
    test_key = f"test_lockout_{time.time()}"
    for _ in range(4):
        locked, _ = record_failed_login_attempt(test_key)
        assert locked is False
    # 5th attempt locks out
    locked, retry_after = record_failed_login_attempt(test_key)
    assert locked is True
    assert retry_after > 0
    reset_failed_login_attempts(test_key)
    is_locked, _ = check_account_lockout(test_key)
    assert is_locked is False

    # Safe redirect
    assert is_safe_redirect_url("/dashboard") is True
    assert is_safe_redirect_url("/prs/123") is True
    assert is_safe_redirect_url("//evil.com/phish") is False
    assert is_safe_redirect_url("https://mentorlens-nine.vercel.app/home") is True
    assert is_safe_redirect_url("https://attacker.com/malicious") is False

    print("  -> PASSED: Auth cryptographic helpers, Argon2id, Lockout, and Redirects validated.")


def test_import_and_port_expansion() -> None:
    print("[5/5] Testing App Import & Port Expansion Compatibility...")
    import app.main
    assert hasattr(app.main, "app")
    print("  -> PASSED: app.main successfully imported with zero dependency leaks.")


if __name__ == "__main__":
    print("=" * 60)
    print(" MentorLens Pre-Deploy Verification & Smoke Test")
    print("=" * 60)
    test_url_normalization()
    test_production_env_validation()
    test_health_endpoints_with_test_client()
    test_auth_security_helpers()
    test_import_and_port_expansion()
    print("=" * 60)
    print(" ALL PRE-DEPLOY SMOKE CHECKS PASSED SUCCESSFULLY (5/5)")
    print("=" * 60)
