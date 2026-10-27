import ipaddress
import logging
import socket
from urllib.parse import urlparse
from app.core.errors import AppError

logger = logging.getLogger(__name__)

# Private and cloud metadata networks that must be blocked from outbound requests
FORBIDDEN_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback
    ipaddress.ip_network("10.0.0.0/8"),        # Private RFC1918
    ipaddress.ip_network("172.16.0.0/12"),     # Private RFC1918
    ipaddress.ip_network("192.168.0.0/16"),    # Private RFC1918
    ipaddress.ip_network("169.254.0.0/16"),    # Link-local / AWS & Cloud Metadata
    ipaddress.ip_network("100.64.0.0/10"),     # Carrier Grade NAT
    ipaddress.ip_network("0.0.0.0/8"),         # Broadcast / current network
    ipaddress.ip_network("::1/128"),           # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),          # IPv6 Unique Local Address
    ipaddress.ip_network("fe80::/10"),         # IPv6 Link-local
]


def is_ip_forbidden(ip_str: str) -> bool:
    """Checks whether an IP address belongs to any private/internal/metadata range."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in net for net in FORBIDDEN_NETWORKS)
    except ValueError:
        return True


def validate_safe_url(url: str) -> str:
    """
    Validates that a URL does not target loopback, private networks, or cloud metadata.
    Raises AppError(400) if an SSRF attempt is detected.
    Returns the validated URL if safe.
    """
    if not url:
        raise AppError(code="INVALID_URL", message="URL cannot be empty.", status_code=400)

    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise AppError(
            code="INVALID_URL_SCHEME",
            message=f"Unsupported URL scheme '{parsed.scheme}'. Only http and https are permitted.",
            status_code=400,
        )

    hostname = parsed.hostname
    if not hostname:
        raise AppError(code="INVALID_URL", message="URL must specify a valid hostname.", status_code=400)

    # Disallow localhost directly
    if hostname.lower() in ("localhost", "127.0.0.1", "::1", "metadata.google.internal"):
        raise AppError(
            code="SSRF_ATTEMPT_BLOCKED",
            message=f"Access to internal host '{hostname}' is forbidden.",
            status_code=400,
        )

    # Resolve hostname via DNS and check all returned IPs
    try:
        resolved_info = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
        for family, socktype, proto, canonname, sockaddr in resolved_info:
            ip_addr = sockaddr[0]
            if is_ip_forbidden(ip_addr):
                logger.warning(f"SSRF attempt intercepted: '{url}' resolved to forbidden address '{ip_addr}'")
                raise AppError(
                    code="SSRF_ATTEMPT_BLOCKED",
                    message="Destination IP address is in a reserved or private network range.",
                    status_code=400,
                    details={"hostname": hostname, "resolved_ip": ip_addr},
                )
    except socket.gaierror as e:
        logger.warning(f"Failed to resolve hostname '{hostname}': {e}")
        raise AppError(
            code="HOST_RESOLUTION_FAILED",
            message=f"Unable to resolve host '{hostname}'.",
            status_code=400,
        )

    return url
