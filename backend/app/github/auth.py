import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple
import httpx
import jwt
from app.core.config import settings

logger = logging.getLogger(__name__)

# Cache store: installation_id -> (token, expiry_timestamp)
_installation_token_cache: Dict[int, Tuple[str, float]] = {}


def create_app_jwt(app_id: str, private_key: str) -> str:
    """
    Generates a GitHub App JWT signed with RS256.
    Includes a 60-second clock skew buffer and 10-minute expiration.
    """
    now = int(time.time())
    payload = {
        "iat": now - 60,  # 60s clock skew buffer
        "exp": now + (10 * 60),  # 10 minutes
        "iss": app_id,
    }
    encoded_jwt = jwt.encode(payload, private_key, algorithm="RS256")
    return encoded_jwt


async def get_installation_token(
    installation_id: int,
    app_id: Optional[str] = None,
    private_key: Optional[str] = None,
    force_refresh: bool = False,
) -> str:
    """
    Returns a cached GitHub installation access token or generates a new one.
    Refreshes automatically 5 minutes before the 1-hour expiry.
    """
    now = time.time()
    if not force_refresh and installation_id in _installation_token_cache:
        token, expires_at = _installation_token_cache[installation_id]
        if expires_at - now > 300:  # More than 5 minutes remaining
            return token

    target_app_id = app_id or settings.GITHUB_APP_ID
    target_key = private_key or settings.GITHUB_APP_PRIVATE_KEY

    # If keys are not configured (e.g. mock test environment), return a deterministic test token
    if not target_app_id or not target_key:
        mock_token = f"ghs_mock_token_installation_{installation_id}"
        _installation_token_cache[installation_id] = (mock_token, now + 3600)
        return mock_token

    # Authenticate with GitHub App API
    app_jwt = create_app_jwt(target_app_id, target_key)
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {app_jwt}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        token = data["token"]
        # Parse expires_at ISO format (e.g. "2026-10-26T21:00:00Z")
        expires_at_iso = data.get("expires_at")
        if expires_at_iso:
            dt = datetime.fromisoformat(expires_at_iso.replace("Z", "+00:00"))
            expires_at_timestamp = dt.timestamp()
        else:
            expires_at_timestamp = now + 3600

        _installation_token_cache[installation_id] = (token, expires_at_timestamp)
        return token
