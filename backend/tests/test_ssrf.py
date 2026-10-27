import pytest
from app.core.ssrf import validate_safe_url
from app.core.errors import AppError


def test_ssrf_blocks_localhost_and_loopback():
    """Validates that requests to localhost and 127.0.0.1 are blocked."""
    with pytest.raises(AppError) as exc_info:
        validate_safe_url("http://localhost:8000/internal")
    assert exc_info.value.code == "SSRF_ATTEMPT_BLOCKED"

    with pytest.raises(AppError) as exc_info:
        validate_safe_url("http://127.0.0.1/admin")
    assert exc_info.value.code == "SSRF_ATTEMPT_BLOCKED"


def test_ssrf_blocks_cloud_metadata():
    """Validates that AWS/GCP metadata service IPs are strictly blocked."""
    with pytest.raises(AppError) as exc_info:
        validate_safe_url("http://169.254.169.254/latest/meta-data/")
    assert exc_info.value.code == "SSRF_ATTEMPT_BLOCKED"

    with pytest.raises(AppError) as exc_info:
        validate_safe_url("http://metadata.google.internal/computeMetadata/v1/")
    assert exc_info.value.code == "SSRF_ATTEMPT_BLOCKED"


def test_ssrf_blocks_private_rfc1918_networks():
    """Validates that requests to internal RFC1918 addresses are blocked."""
    with pytest.raises(AppError) as exc_info:
        validate_safe_url("http://10.0.0.1/intranet")
    assert exc_info.value.code == "SSRF_ATTEMPT_BLOCKED"

    with pytest.raises(AppError) as exc_info:
        validate_safe_url("http://192.168.1.1/router")
    assert exc_info.value.code == "SSRF_ATTEMPT_BLOCKED"

    with pytest.raises(AppError) as exc_info:
        validate_safe_url("http://172.16.0.50/api")
    assert exc_info.value.code == "SSRF_ATTEMPT_BLOCKED"


def test_ssrf_rejects_unsupported_schemes():
    """Validates that non-HTTP/HTTPS schemes (ftp, file, gopher) are rejected."""
    with pytest.raises(AppError) as exc_info:
        validate_safe_url("file:///etc/passwd")
    assert exc_info.value.code == "INVALID_URL_SCHEME"

    with pytest.raises(AppError) as exc_info:
        validate_safe_url("gopher://127.0.0.1:70")
    assert exc_info.value.code == "INVALID_URL_SCHEME"


def test_ssrf_allows_valid_public_urls():
    """Validates that legitimate public endpoints pass validation."""
    valid_url = validate_safe_url("https://api.github.com/repos/org/repo")
    assert valid_url == "https://api.github.com/repos/org/repo"
