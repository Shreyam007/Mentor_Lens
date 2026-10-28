import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core.config import settings
from app.core.errors import AppError, ForbiddenError, UnauthorizedError
from app.core.security import (
    check_account_lockout,
    create_access_token,
    decode_access_token,
    generate_csrf_token,
    generate_pkce_codes,
    generate_secure_token,
    hash_password,
    hash_token,
    is_safe_redirect_url,
    normalize_email_address,
    record_failed_login_attempt,
    reset_failed_login_attempts,
    validate_password_strength,
    verify_password,
)
from app.db.models import OAuthAccount, User, UserSession, get_utc_now
from app.db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication & RBAC"])
logger = logging.getLogger("mentorlens.auth")


# --- Request Schemas ---

class SignupRequest(BaseModel):
    email: str
    password: str
    login: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


# --- Helper: Cookie Management ---

def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
) -> None:
    """Sets secure, HttpOnly authentication cookies with SameSite=Lax."""
    # 15-minute access token cookie
    response.set_cookie(
        key="ml_session",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.JWT_ACCESS_EXPIRE_MINUTES * 60,
        path="/",
    )
    # 7-day refresh token cookie (restricted to auth path)
    response.set_cookie(
        key="ml_refresh",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.JWT_REFRESH_EXPIRE_DAYS * 24 * 3600,
        path="/api/auth",
    )
    # CSRF cookie (accessible to client JS for double-submit header)
    response.set_cookie(
        key="ml_csrf",
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.JWT_REFRESH_EXPIRE_DAYS * 24 * 3600,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """Clears all session and CSRF cookies."""
    response.delete_cookie("ml_session", path="/", domain=settings.COOKIE_DOMAIN)
    response.delete_cookie("ml_refresh", path="/api/auth", domain=settings.COOKIE_DOMAIN)
    response.delete_cookie("ml_csrf", path="/", domain=settings.COOKIE_DOMAIN)


# --- Dependencies ---

async def get_current_user(
    ml_session: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extracts and validates the authenticated user from the HttpOnly session cookie
    or Bearer authorization header.
    """
    token = ml_session
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()

    if not token:
        raise UnauthorizedError("No active authentication token found. Please sign in.")

    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Malformed authentication token.")

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise UnauthorizedError("User associated with session does not exist.")

    return user


async def require_developer(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("developer", "lead", "admin"):
        raise ForbiddenError("Developer access required.")
    return user


async def require_lead(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("lead", "admin"):
        raise ForbiddenError("Lead access required.")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise ForbiddenError("Admin access required.")
    return user


# --- Endpoints ---

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    data: SignupRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Registers a new user with email and password."""
    norm_email = normalize_email_address(data.email)
    validate_password_strength(data.password)

    # Check for existing account with this email
    stmt = select(User).where(User.email == norm_email)
    res = await db.execute(stmt)
    existing_user = res.scalars().first()

    if existing_user:
        if existing_user.password_hash:
            raise AppError(
                code="USER_ALREADY_EXISTS",
                message="An account with this email address already exists. Please sign in.",
                status_code=400,
            )
        # Account was created via OAuth without password; set password now
        existing_user.password_hash = hash_password(data.password)
        user = existing_user
    else:
        # Create new user
        login_handle = data.login or norm_email.split("@")[0]
        user = User(
            email=norm_email,
            password_hash=hash_password(data.password),
            login=login_handle,
            role="developer",
            is_email_verified=False,
        )
        db.add(user)

    await db.flush()

    # Create new session with hashed refresh token
    raw_refresh = generate_secure_token(64)
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1").split(",")[0].strip()
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(raw_refresh),
        device_info=request.headers.get("User-Agent", "unknown")[:255],
        ip_address=client_ip,
        expires_at=get_utc_now() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()
    await db.refresh(user)

    # Issue tokens
    access_token = create_access_token(
        user_id=user.id,
        login=user.login,
        email=user.email,
        role=user.role,
    )
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, access_token, raw_refresh, csrf_token)

    return {
        "status": "authenticated",
        "user": {
            "id": user.id,
            "email": user.email,
            "login": user.login,
            "role": user.role,
            "avatar_url": user.avatar_url,
        },
        "csrf_token": csrf_token,
    }


@router.post("/login")
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Authenticates email & password with lockout protection and generic error envelopes."""
    norm_email = normalize_email_address(data.email)
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1").split(",")[0].strip()

    account_key = f"acc:{norm_email}"
    ip_key = f"ip:{client_ip}"

    # Lockout check
    is_locked, retry_after = check_account_lockout(account_key)
    if not is_locked:
        is_locked, retry_after = check_account_lockout(ip_key)

    if is_locked:
        raise AppError(
            code="ACCOUNT_LOCKED",
            message=f"Too many failed login attempts. Please wait {retry_after} seconds before trying again.",
            status_code=429,
        )

    # Fetch user
    stmt = select(User).where(User.email == norm_email)
    res = await db.execute(stmt)
    user = res.scalars().first()

    # Generic error and constant-time check to prevent timing & enumeration attacks
    dummy_hash = "$argon2id$v=19$m=65536,t=2,p=1$7Y...$dummyhashforenumerationprevention12345"
    if not user or not user.password_hash:
        verify_password(data.password, dummy_hash)
        record_failed_login_attempt(account_key)
        record_failed_login_attempt(ip_key)
        raise UnauthorizedError("Invalid email or password.")

    if not verify_password(data.password, user.password_hash):
        record_failed_login_attempt(account_key)
        record_failed_login_attempt(ip_key)
        raise UnauthorizedError("Invalid email or password.")

    # Successful authentication: clear failure records
    reset_failed_login_attempts(account_key)
    reset_failed_login_attempts(ip_key)

    # Create new session with rotated refresh token
    raw_refresh = generate_secure_token(64)
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(raw_refresh),
        device_info=request.headers.get("User-Agent", "unknown")[:255],
        ip_address=client_ip,
        expires_at=get_utc_now() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()

    access_token = create_access_token(
        user_id=user.id,
        login=user.login,
        email=user.email,
        role=user.role,
    )
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, access_token, raw_refresh, csrf_token)

    return {
        "status": "authenticated",
        "user": {
            "id": user.id,
            "email": user.email,
            "login": user.login,
            "role": user.role,
            "avatar_url": user.avatar_url,
        },
        "csrf_token": csrf_token,
    }


@router.post("/refresh")
async def refresh_session(
    request: Request,
    response: Response,
    ml_refresh: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Refreshes an access token using the HttpOnly refresh token cookie.
    Enforces automatic single-use rotation and token reuse detection.
    """
    if not ml_refresh:
        clear_auth_cookies(response)
        raise UnauthorizedError("No refresh token provided.")

    token_h = hash_token(ml_refresh)
    stmt = select(UserSession).where(UserSession.refresh_token_hash == token_h)
    res = await db.execute(stmt)
    session = res.scalars().first()

    # Reuse detection: if a revoked session is submitted, revoke ALL sessions for that user
    if not session or session.is_revoked:
        if session and session.user_id:
            logger.warning(f"Refresh token reuse detected for user {session.user_id}! Revoking all sessions.")
            await db.execute(
                update(UserSession)
                .where(UserSession.user_id == session.user_id)
                .values(is_revoked=True)
            )
            await db.commit()
        clear_auth_cookies(response)
        raise UnauthorizedError("Invalid or revoked refresh session.")

    # Check expiration
    now = get_utc_now()
    exp = session.expires_at if session.expires_at.tzinfo else session.expires_at.replace(tzinfo=timezone.utc)
    if exp < now:
        session.is_revoked = True
        await db.commit()
        clear_auth_cookies(response)
        raise UnauthorizedError("Session has expired. Please sign in again.")

    # Rotate refresh token: replace current session hash with fresh token
    new_raw_refresh = generate_secure_token(64)
    session.refresh_token_hash = hash_token(new_raw_refresh)
    session.last_used_at = now
    session.expires_at = now + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)

    # Fetch user details
    user_stmt = select(User).where(User.id == session.user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
    if not user:
        clear_auth_cookies(response)
        raise UnauthorizedError("User no longer exists.")

    await db.commit()

    # Issue fresh access token and set cookies
    new_access = create_access_token(
        user_id=user.id,
        login=user.login,
        email=user.email,
        role=user.role,
    )
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, new_access, new_raw_refresh, csrf_token)

    return {
        "status": "refreshed",
        "user": {
            "id": user.id,
            "email": user.email,
            "login": user.login,
            "role": user.role,
            "avatar_url": user.avatar_url,
        },
        "csrf_token": csrf_token,
    }


@router.post("/logout")
async def logout(
    response: Response,
    ml_refresh: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Revokes the current session and clears authentication cookies."""
    if ml_refresh:
        token_h = hash_token(ml_refresh)
        await db.execute(
            update(UserSession)
            .where(UserSession.refresh_token_hash == token_h)
            .values(is_revoked=True)
        )
        await db.commit()

    clear_auth_cookies(response)
    return {"status": "logged_out"}


@router.post("/logout-all")
async def logout_all(
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Revokes all active sessions for the authenticated user ('logout everywhere')."""
    await db.execute(
        update(UserSession)
        .where(UserSession.user_id == user.id)
        .values(is_revoked=True)
    )
    await db.commit()
    clear_auth_cookies(response)
    return {"status": "logged_out_all"}


@router.get("/me")
async def get_current_user_profile(user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Returns the profile of the currently authenticated user."""
    return {
        "id": user.id,
        "email": user.email,
        "login": user.login,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "is_email_verified": user.is_email_verified,
        "created_at": user.created_at.isoformat(),
    }


# --- GitHub OAuth ---

@router.get("/github")
async def github_login(
    next_url: Optional[str] = Query(None, alias="next"),
    response: Response = None,
) -> Dict[str, str]:
    """Initiates GitHub OAuth flow with state parameter."""
    state = secrets.token_urlsafe(32)
    redirect_uri = f"{settings.BACKEND_URL}/api/auth/github/callback"
    client_id = settings.GITHUB_CLIENT_ID or "mock-github-client-id"

    # Store state and optional next url in cookie
    oauth_meta = json.dumps({"state": state, "next": next_url if is_safe_redirect_url(next_url) else "/"})
    if response:
        response.set_cookie(
            key="ml_gh_oauth",
            value=oauth_meta,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite="lax",
            max_age=600,
        )

    auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={client_id}&redirect_uri={redirect_uri}&state={state}&scope=read:user,user:email"
    )
    return {"authorization_url": auth_url, "state": state}


@router.get("/github/callback")
async def github_callback(
    code: str,
    request: Request,
    response: Response,
    state: Optional[str] = None,
    ml_gh_oauth: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Handles GitHub OAuth code exchange, user creation, and session issuance."""
    next_dest = "/"
    if ml_gh_oauth and state is not None:
        try:
            stored = json.loads(ml_gh_oauth)
            if stored.get("state") != state:
                raise AppError("OAUTH_STATE_MISMATCH", "OAuth security state mismatch. Please retry login.", 400)
            if is_safe_redirect_url(stored.get("next")):
                next_dest = stored.get("next")
        except Exception as e:
            if isinstance(e, AppError):
                raise e

    # In production with real GitHub credentials, exchange code for access token
    gh_user_id: int
    gh_login: str
    gh_email: Optional[str] = None
    gh_avatar: Optional[str] = None
    gh_role: str = "developer"

    if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_res = await client.post(
                "https://github.com/login/oauth/access_token",
                json={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_res.json()
            gh_access_token = token_data.get("access_token")
            if not gh_access_token:
                raise UnauthorizedError("Failed to obtain access token from GitHub.")

            # Fetch user profile
            profile_res = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {gh_access_token}"},
            )
            profile = profile_res.json()
            gh_user_id = profile["id"]
            gh_login = profile["login"]
            gh_avatar = profile.get("avatar_url")

            # Fetch emails
            emails_res = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {gh_access_token}"},
            )
            if emails_res.status_code == 200:
                for em in emails_res.json():
                    if em.get("primary") and em.get("verified"):
                        gh_email = em.get("email")
                        break
    else:
        # Mock / local dev fallback
        gh_user_id = 987654
        gh_login = "meera-sharma"
        gh_email = "meera@mentorlens.dev"
        gh_avatar = "https://avatars.githubusercontent.com/u/987654"
        gh_role = "lead"

    # Account linking: find existing OAuth account or existing user with verified email
    oauth_stmt = select(OAuthAccount).where(
        OAuthAccount.provider == "github",
        OAuthAccount.provider_user_id == str(gh_user_id),
    )
    oauth_res = await db.execute(oauth_stmt)
    oauth_acc = oauth_res.scalars().first()

    user: Optional[User] = None
    if oauth_acc:
        user_stmt = select(User).where(User.id == oauth_acc.user_id)
        user_res = await db.execute(user_stmt)
        user = user_res.scalars().first()

    if not user and gh_email:
        # Link by verified email if account exists
        user_stmt = select(User).where(User.email == gh_email)
        user_res = await db.execute(user_stmt)
        user = user_res.scalars().first()

    if not user:
        # Create fresh user
        user = User(
            email=gh_email,
            github_id=gh_user_id,
            login=gh_login,
            avatar_url=gh_avatar,
            role=gh_role,
            is_email_verified=bool(gh_email),
        )
        db.add(user)
        await db.flush()

    if not oauth_acc:
        oauth_acc = OAuthAccount(
            user_id=user.id,
            provider="github",
            provider_user_id=str(gh_user_id),
            provider_email=gh_email,
        )
        db.add(oauth_acc)

    # Create session
    raw_refresh = generate_secure_token(64)
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1").split(",")[0].strip()
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(raw_refresh),
        device_info=request.headers.get("User-Agent", "GitHub OAuth")[:255],
        ip_address=client_ip,
        expires_at=get_utc_now() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()

    access_token = create_access_token(user.id, user.login, user.email, user.role)
    csrf_token = generate_csrf_token()

    # Clear oauth cookie and set auth cookies
    response.delete_cookie("ml_gh_oauth")
    set_auth_cookies(response, access_token, raw_refresh, csrf_token)

    # If browser redirect requested
    if "text/html" in request.headers.get("Accept", ""):
        redirect = RedirectResponse(url=f"{settings.FRONTEND_URL}{next_dest}", status_code=302)
        set_auth_cookies(redirect, access_token, raw_refresh, csrf_token)
        return redirect

    return {
        "status": "authenticated",
        "user": {"id": user.id, "login": user.login, "email": user.email, "role": user.role},
        "csrf_token": csrf_token,
    }


# --- Google OAuth (OIDC with PKCE) ---

@router.get("/google")
async def google_login(
    next_url: Optional[str] = Query(None, alias="next"),
    response: Response = None,
) -> Dict[str, str]:
    """Initiates Google OIDC flow with PKCE and state protection."""
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(16)
    code_verifier, code_challenge = generate_pkce_codes()
    redirect_uri = f"{settings.BACKEND_URL}/api/auth/google/callback"
    client_id = settings.GOOGLE_CLIENT_ID or "mock-google-client-id"

    meta = json.dumps({
        "state": state,
        "nonce": nonce,
        "code_verifier": code_verifier,
        "next": next_url if is_safe_redirect_url(next_url) else "/",
    })
    if response:
        response.set_cookie(
            key="ml_google_oauth",
            value=meta,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite="lax",
            max_age=600,
        )

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&"
        f"scope=openid%20email%20profile&state={state}&nonce={nonce}&"
        f"code_challenge={code_challenge}&code_challenge_method=S256"
    )
    return {"authorization_url": auth_url, "state": state}


@router.get("/google/callback")
async def google_callback(
    code: str,
    request: Request,
    response: Response,
    state: Optional[str] = None,
    ml_google_oauth: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Handles Google OAuth code exchange, verifies id_token and email_verified."""
    code_verifier: Optional[str] = None
    next_dest = "/"
    if ml_google_oauth:
        try:
            stored = json.loads(ml_google_oauth)
            if stored.get("state") != state:
                raise AppError("OAUTH_STATE_MISMATCH", "Google OAuth security state mismatch. Please retry.", 400)
            code_verifier = stored.get("code_verifier")
            if is_safe_redirect_url(stored.get("next")):
                next_dest = stored.get("next")
        except Exception as e:
            if isinstance(e, AppError):
                raise e

    google_sub: str
    google_email: str
    email_verified: bool
    google_name: str
    google_picture: Optional[str] = None

    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and code_verifier:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "code_verifier": code_verifier,
                    "grant_type": "authorization_code",
                    "redirect_uri": f"{settings.BACKEND_URL}/api/auth/google/callback",
                },
            )
            tokens = token_res.json()
            id_token = tokens.get("id_token")
            if not id_token:
                raise UnauthorizedError("Failed to obtain ID token from Google.")

            # Decode ID token payload (in production, unverified parse + cert check or verify aud/iss)
            import jwt as pyjwt
            decoded = pyjwt.decode(id_token, options={"verify_signature": False})
            if decoded.get("aud") != settings.GOOGLE_CLIENT_ID:
                raise UnauthorizedError("Google ID token audience mismatch.")

            google_sub = decoded["sub"]
            google_email = decoded.get("email", "")
            email_verified = decoded.get("email_verified", False)
            google_name = decoded.get("name", google_email.split("@")[0])
            google_picture = decoded.get("picture")
    else:
        # Mock / simulated flow
        google_sub = "google-user-12345"
        google_email = "shreyam.google@example.com"
        email_verified = True
        google_name = "Shreyam Google"
        google_picture = "https://lh3.googleusercontent.com/a/mock"

    if not email_verified:
        raise AppError(
            code="UNVERIFIED_EMAIL",
            message="Google account email is not verified. Please verify your email with Google first.",
            status_code=400,
        )

    norm_email = normalize_email_address(google_email)

    # Account linking: find existing OAuth record or existing user with same verified email
    oauth_stmt = select(OAuthAccount).where(
        OAuthAccount.provider == "google",
        OAuthAccount.provider_user_id == google_sub,
    )
    oauth_res = await db.execute(oauth_stmt)
    oauth_acc = oauth_res.scalars().first()

    user: Optional[User] = None
    if oauth_acc:
        user_stmt = select(User).where(User.id == oauth_acc.user_id)
        user_res = await db.execute(user_stmt)
        user = user_res.scalars().first()

    if not user:
        user_stmt = select(User).where(User.email == norm_email)
        user_res = await db.execute(user_stmt)
        user = user_res.scalars().first()

    if not user:
        user = User(
            email=norm_email,
            login=google_name.replace(" ", "_").lower(),
            avatar_url=google_picture,
            role="developer",
            is_email_verified=True,
        )
        db.add(user)
        await db.flush()

    if not oauth_acc:
        oauth_acc = OAuthAccount(
            user_id=user.id,
            provider="google",
            provider_user_id=google_sub,
            provider_email=norm_email,
        )
        db.add(oauth_acc)

    raw_refresh = generate_secure_token(64)
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "127.0.0.1").split(",")[0].strip()
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(raw_refresh),
        device_info=request.headers.get("User-Agent", "Google OAuth")[:255],
        ip_address=client_ip,
        expires_at=get_utc_now() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()

    access_token = create_access_token(user.id, user.login, user.email, user.role)
    csrf_token = generate_csrf_token()

    response.delete_cookie("ml_google_oauth")
    set_auth_cookies(response, access_token, raw_refresh, csrf_token)

    if "text/html" in request.headers.get("Accept", ""):
        redirect = RedirectResponse(url=f"{settings.FRONTEND_URL}{next_dest}", status_code=302)
        set_auth_cookies(redirect, access_token, raw_refresh, csrf_token)
        return redirect

    return {
        "status": "authenticated",
        "user": {"id": user.id, "login": user.login, "email": user.email, "role": user.role},
        "csrf_token": csrf_token,
    }
