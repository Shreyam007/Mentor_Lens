import base64
import hashlib
import hmac
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from email_validator import EmailNotValidError, validate_email

from app.core.config import settings
from app.core.errors import AppError, UnauthorizedError

# Argon2id password hasher (RFC 9106 recommended parameters)
_password_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=1,
    hash_len=32,
)

COMMON_PASSWORDS = {
    "password", "password123", "password1234", "1234567890", "12345678901",
    "qwerty1234", "admin12345", "letmein123", "welcome123", "mentorlens123",
    "iloveyou123", "supersecret", "changeme123", "correcthorse",
}

# In-memory fallback lockout store when Redis is unavailable: key -> [(timestamp)]
_local_lockout_store: Dict[str, List[float]] = {}
LOCKOUT_THRESHOLD = 5
LOCKOUT_WINDOW_SECONDS = 15 * 60  # 15 minutes


def normalize_email_address(email: str) -> str:
    """Validates and normalizes email address format."""
    try:
        valid = validate_email(email, check_deliverability=False)
        return valid.normalized.lower()
    except EmailNotValidError as e:
        raise AppError(
            code="INVALID_EMAIL",
            message=f"Invalid email address: {str(e)}",
            status_code=400,
        )


def validate_password_strength(password: str) -> None:
    """Enforces minimum length of 10 and rejects common passwords."""
    if not password or len(password) < 10:
        raise AppError(
            code="PASSWORD_TOO_SHORT",
            message="Password must be at least 10 characters long.",
            status_code=400,
        )
    if password.lower() in COMMON_PASSWORDS:
        raise AppError(
            code="PASSWORD_TOO_COMMON",
            message="Password is too common or easily guessable. Please choose a stronger password.",
            status_code=400,
        )


def hash_password(password: str) -> str:
    """Hashes a password using Argon2id with random salt."""
    return _password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against an Argon2id hash in constant time."""
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False
    except Exception:
        return False


def hash_token(raw_token: str) -> str:
    """Hashes a refresh or session token with SHA-256 for secure database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_secure_token(nbytes: int = 32) -> str:
    """Generates cryptographically random url-safe token."""
    return secrets.token_urlsafe(nbytes)


def create_access_token(
    user_id: str,
    login: str,
    email: Optional[str] = None,
    role: str = "developer",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Creates a signed JWT access token (15 min default) with full claims validation."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES))
    jti = secrets.token_hex(16)

    payload = {
        "sub": user_id,
        "login": login,
        "email": email,
        "role": role,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": now,
        "exp": expire,
        "jti": jti,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates JWT claims: iss, aud, exp, and signature."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Access token has expired.")
    except jwt.InvalidAudienceError:
        raise UnauthorizedError("Invalid token audience.")
    except jwt.InvalidIssuerError:
        raise UnauthorizedError("Invalid token issuer.")
    except jwt.PyJWTError as e:
        raise UnauthorizedError(f"Invalid access token: {str(e)}")


def decode_session_token(token: str) -> Dict[str, Any]:
    """Fallback decoder maintaining backwards compatibility with legacy session tokens."""
    return decode_access_token(token)


def create_session_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates an access token from dictionary payload."""
    return create_access_token(
        user_id=data.get("sub", ""),
        login=data.get("login", ""),
        email=data.get("email"),
        role=data.get("role", "developer"),
        expires_delta=expires_delta,
    )


def generate_csrf_token() -> str:
    """Generates a secure cryptographically random CSRF token."""
    return secrets.token_hex(32)


def verify_webhook_signature(payload_bytes: bytes, signature_header: Optional[str], secret: str) -> bool:
    """Verifies GitHub X-Hub-Signature-256 header using constant-time comparison."""
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected_signature = signature_header[7:]
    mac = hmac.new(secret.encode("utf-8"), msg=payload_bytes, digestmod=hashlib.sha256)
    computed_signature = mac.hexdigest()
    return hmac.compare_digest(computed_signature, expected_signature)


def sanitize_xss(text: str) -> str:
    """Sanitizes untrusted input to neutralize malicious scripts and HTML injection."""
    if not text:
        return ""
    import html
    cleaned = re.sub(r"(?i)<script[^>]*>.*?</script>", "", text, flags=re.DOTALL)
    cleaned = re.sub(r"(?i)javascript:", "blocked:", cleaned)
    return html.escape(cleaned, quote=True)


# --- Lockout Management (Per-account and per-IP) ---

def check_account_lockout(key: str) -> Tuple[bool, int]:
    """
    Checks if account/IP is locked out.
    Returns (is_locked, retry_after_seconds).
    """
    now = time.time()
    attempts = _local_lockout_store.get(key, [])
    # Filter attempts within lockout window
    valid_attempts = [t for t in attempts if now - t < LOCKOUT_WINDOW_SECONDS]
    _local_lockout_store[key] = valid_attempts

    if len(valid_attempts) >= LOCKOUT_THRESHOLD:
        oldest_active = min(valid_attempts)
        retry_after = int(LOCKOUT_WINDOW_SECONDS - (now - oldest_active))
        return True, max(1, retry_after)
    return False, 0


def record_failed_login_attempt(key: str) -> Tuple[bool, int]:
    """
    Records a failed login attempt and returns updated lockout status:
    (is_now_locked, retry_after_seconds).
    """
    now = time.time()
    attempts = _local_lockout_store.setdefault(key, [])
    attempts.append(now)
    return check_account_lockout(key)


def reset_failed_login_attempts(key: str) -> None:
    """Resets failed login attempts upon successful authentication."""
    _local_lockout_store.pop(key, None)


# --- PKCE (RFC 7636) & OAuth State Helpers ---

def generate_pkce_codes() -> Tuple[str, str]:
    """
    Generates (code_verifier, code_challenge) using SHA-256 for PKCE OAuth flow.
    """
    code_verifier = secrets.token_urlsafe(64)
    hashed = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(hashed).decode("ascii").rstrip("=")
    return code_verifier, code_challenge


def is_safe_redirect_url(url: Optional[str], allowed_hosts: Optional[List[str]] = None) -> bool:
    """
    Validates post-login redirect URL to prevent open redirect vulnerabilities.
    Only allows relative paths (starting with '/') or pre-approved domain names.
    """
    if not url:
        return False
    # Reject protocol-relative URLs (e.g. //attacker.com)
    if url.startswith("//") or url.startswith("\\\\"):
        return False
    if url.startswith("/") and not url.startswith("/\\"):
        return True

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False

    allowed = allowed_hosts or settings.ALLOWED_REDIRECT_HOSTS
    host = parsed.netloc.split(":")[0].lower()
    return host in [h.lower() for h in allowed]
