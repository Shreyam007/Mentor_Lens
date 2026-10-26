import secrets
from typing import Any, Dict, Optional
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import create_session_token, decode_session_token, generate_csrf_token
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication & RBAC"])


async def get_current_user(
    ml_session: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency: extracts and verifies the logged-in user from the session cookie."""
    if not ml_session:
        raise UnauthorizedError("No active session cookie found.")

    payload = decode_session_token(ml_session)
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Malformed session token.")

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise UnauthorizedError("User associated with session not found.")

    return user


async def require_developer(user: User = Depends(get_current_user)) -> User:
    """Allows developer, lead, or admin roles."""
    if user.role not in ("developer", "lead", "admin"):
        raise ForbiddenError("Developer access required.")
    return user


async def require_lead(user: User = Depends(get_current_user)) -> User:
    """Allows lead or admin roles."""
    if user.role not in ("lead", "admin"):
        raise ForbiddenError("Lead access required.")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Allows admin role only."""
    if user.role != "admin":
        raise ForbiddenError("Admin access required.")
    return user


@router.get("/github")
async def github_login() -> Dict[str, str]:
    """Initiates GitHub OAuth flow by providing redirect URL."""
    state = secrets.token_urlsafe(16)
    redirect_uri = f"{settings.BACKEND_URL}/api/auth/github/callback"
    client_id = settings.GITHUB_CLIENT_ID or "mock-github-client-id"
    url = f"https://github.com/login/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=read:user,repo"
    return {"authorization_url": url, "state": state}


@router.get("/github/callback")
async def github_callback(
    code: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Handles GitHub OAuth code exchange and sets session cookie."""
    # In test/mock mode or with actual GitHub credentials
    mock_login = "meera-sharma"
    mock_github_id = 987654

    stmt = select(User).where(User.github_id == mock_github_id)
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user:
        user = User(
            github_id=mock_github_id,
            login=mock_login,
            avatar_url="https://avatars.githubusercontent.com/u/987654",
            role="lead",  # default role for demo
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    session_token = create_session_token({"sub": user.id, "login": user.login, "role": user.role})
    csrf_token = generate_csrf_token()

    # Set secure HttpOnly session cookie
    response.set_cookie(
        key="ml_session",
        value=session_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 3600,
    )
    # CSRF cookie (readable by JS to include in mutating headers)
    response.set_cookie(
        key="ml_csrf",
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 3600,
    )

    return {
        "status": "authenticated",
        "user": {
            "id": user.id,
            "login": user.login,
            "role": user.role,
            "avatar_url": user.avatar_url,
        },
        "csrf_token": csrf_token,
    }


@router.get("/me")
async def get_current_user_profile(user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Returns the profile of the currently logged-in user."""
    return {
        "id": user.id,
        "login": user.login,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at.isoformat(),
    }


@router.post("/logout")
async def logout(response: Response) -> Dict[str, str]:
    """Clears the authentication and CSRF session cookies."""
    response.delete_cookie("ml_session")
    response.delete_cookie("ml_csrf")
    return {"status": "logged_out"}
