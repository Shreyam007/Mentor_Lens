import time
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.core.security import create_access_token, generate_csrf_token
from app.db.init_db import init_db


@pytest.fixture(autouse=True)
async def setup_test_db():
    await init_db()


@pytest.mark.asyncio
async def test_auth_signup_login_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email = f"test_{int(time.time())}@mentorlens.dev"
        password = "SecurePassword1234!"

        # 1. Signup
        signup_res = await ac.post(
            "/api/auth/signup",
            json={"email": email, "password": password, "login": "testuser"},
        )
        assert signup_res.status_code == 201
        data = signup_res.json()
        assert data["status"] == "authenticated"
        assert data["user"]["email"] == email
        assert "csrf_token" in data
        assert "ml_session" in signup_res.cookies
        assert "ml_refresh" in signup_res.cookies

        # 2. Call /api/auth/me with cookies
        me_res = await ac.get("/api/auth/me", cookies=signup_res.cookies)
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["email"] == email
        assert me_data["role"] == "developer"

        # 3. Login with correct credentials
        login_res = await ac.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        assert login_res.status_code == 200
        assert "ml_session" in login_res.cookies
        assert "ml_refresh" in login_res.cookies

        # 4. Refresh token rotation
        refresh_res = await ac.post(
            "/api/auth/refresh",
            cookies={"ml_refresh": login_res.cookies["ml_refresh"]},
        )
        assert refresh_res.status_code == 200
        assert "ml_session" in refresh_res.cookies
        assert "ml_refresh" in refresh_res.cookies
        new_refresh = refresh_res.cookies["ml_refresh"]
        assert new_refresh != login_res.cookies["ml_refresh"], "Refresh token should rotate"

        # 5. Reuse Detection: reusing the old refresh token must fail and invalidate sessions
        reuse_res = await ac.post(
            "/api/auth/refresh",
            cookies={"ml_refresh": login_res.cookies["ml_refresh"]},
        )
        assert reuse_res.status_code == 401
        assert "revoked" in reuse_res.json()["error"]["message"]

        # 6. Logout
        logout_res = await ac.post(
            "/api/auth/logout",
            cookies={"ml_refresh": new_refresh},
        )
        assert logout_res.status_code == 200
        assert logout_res.json()["status"] == "logged_out"


@pytest.mark.asyncio
async def test_auth_enumeration_prevention():
    """Confirms identical 401 error message for unregistered email vs wrong password."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Wrong password for existing or non-existing
        res1 = await ac.post(
            "/api/auth/login",
            json={"email": "nonexistent@mentorlens.dev", "password": "WrongPassword123!"},
        )
        assert res1.status_code == 401
        msg1 = res1.json()["error"]["message"]

        # Create known user
        known_email = f"known_{int(time.time())}@mentorlens.dev"
        await ac.post(
            "/api/auth/signup",
            json={"email": known_email, "password": "PasswordForKnown123!"},
        )

        res2 = await ac.post(
            "/api/auth/login",
            json={"email": known_email, "password": "IncorrectPassword123!"},
        )
        assert res2.status_code == 401
        msg2 = res2.json()["error"]["message"]

        # Exactly identical response to prevent user enumeration
        assert msg1 == msg2 == "Invalid email or password."


@pytest.mark.asyncio
async def test_auth_token_tampering_and_audience():
    """Validates that tampered or wrong-audience JWTs are rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Tampered token
        tampered_res = await ac.get(
            "/api/auth/me",
            cookies={"ml_session": "eyJhbGciOiJIUzI1NiJ9.tampered.token"},
        )
        assert tampered_res.status_code == 401

        # Token with invalid audience
        import jwt
        invalid_aud_token = jwt.encode(
            {"sub": "123", "iss": settings.JWT_ISSUER, "aud": "wrong-client", "exp": int(time.time()) + 900},
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        )
        aud_res = await ac.get(
            "/api/auth/me",
            cookies={"ml_session": invalid_aud_token},
        )
        assert aud_res.status_code == 401
        assert "audience" in aud_res.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_oauth_state_mismatch_and_unverified():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # GitHub callback with bad state
        gh_bad_state = await ac.get(
            "/api/auth/github/callback?code=mock_code&state=forged_state",
            cookies={"ml_gh_oauth": '{"state": "legitimate_state", "next": "/"}'},
        )
        assert gh_bad_state.status_code == 400
        assert "mismatch" in gh_bad_state.json()["error"]["message"].lower()

        # Google callback with bad state
        google_bad_state = await ac.get(
            "/api/auth/google/callback?code=mock_code&state=forged_state",
            cookies={"ml_google_oauth": '{"state": "legitimate_state", "code_verifier": "test"}'},
        )
        assert google_bad_state.status_code == 400
        assert "mismatch" in google_bad_state.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_csrf_double_submit_protection():
    """Mutating routes require matching X-CSRF-Token header."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Sign up to get cookies
        email = f"csrf_{int(time.time())}@mentorlens.dev"
        res = await ac.post("/api/auth/signup", json={"email": email, "password": "StrongPassword123!"})
        cookies = res.cookies
        csrf_token = res.json()["csrf_token"]

        # Call mutating endpoint with mismatched CSRF
        bad_csrf = await ac.post(
            "/api/demo/reset",
            cookies=cookies,
            headers={"X-CSRF-Token": "invalid_csrf_token"},
        )
        assert bad_csrf.status_code == 403

        # Call with valid CSRF token header
        good_csrf = await ac.post(
            "/api/demo/reset",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf_token},
        )
        assert good_csrf.status_code == 200
