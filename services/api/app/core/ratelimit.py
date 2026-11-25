"""Per-client rate limiting (slowapi) and trustworthy client IP resolution.

Limits default to 10 requests per minute per IP on the scan and ingest routes.
Counters live in process memory unless ``RATE_LIMIT_STORAGE_URI`` points at a
shared store (for example ``redis://...``), which is needed for the limit to hold
across several API instances.
"""
from __future__ import annotations

import hashlib
import ipaddress
import logging
import os
import time
from typing import Optional

from limits import parse as parse_limit
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import env_flag

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = "10/minute"
SCAN_SCOPE = "scan"
INGEST_SCOPE = "ingest"


def trusted_proxy_hops() -> int:
    """Number of reverse proxies in front of the API (``TRUSTED_PROXY_HOPS``, default 0)."""
    try:
        return max(0, int(os.getenv("TRUSTED_PROXY_HOPS", "0")))
    except ValueError:
        return 0


def _normalise_ip(value: str) -> Optional[str]:
    """Canonical client identity for an address, or ``None`` if it is not an IP.

    An IPv6 client controls its whole /64, so the prefix is the identity: otherwise
    rotating addresses would reset its rate limit and its free preview.
    """
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return None
    if isinstance(address, ipaddress.IPv6Address):
        if address.ipv4_mapped is not None:
            return str(address.ipv4_mapped)
        return str(ipaddress.IPv6Network((int(address) >> 64 << 64, 64)))
    return str(address)


def client_ip(request: Request) -> str:
    """Return the caller's IP address in a way a client cannot forge.

    With no trusted proxy the TCP peer is used and ``X-Forwarded-For`` is ignored.
    With N trusted proxies the Nth address from the *right* of ``X-Forwarded-For``
    is used: each trusted proxy appends the address it saw, so entries further
    left are client-supplied and never trusted. ``GET /health`` reports how many
    entries arrive, which is the hop count to configure.
    """
    raw_peer = request.client.host if request.client and request.client.host else "unknown"
    peer = _normalise_ip(raw_peer) or raw_peer
    hops = trusted_proxy_hops()
    if hops <= 0:
        return peer
    forwarded = ",".join(request.headers.getlist("x-forwarded-for"))
    entries = [entry.strip() for entry in forwarded.split(",") if entry.strip()]
    if len(entries) < hops:
        return peer
    return _normalise_ip(entries[-hops]) or peer


def anonymous_id(request: Request) -> str:
    """Stable pseudonymous id for a signed-out visitor, derived from the client IP.

    The raw address is never stored; set ``ANON_ID_SALT`` so the hash cannot be
    reversed by enumerating addresses.
    """
    salt = os.getenv("ANON_ID_SALT", "")
    digest = hashlib.sha256(f"{salt}|{client_ip(request)}".encode("utf-8")).hexdigest()
    return f"anon:{digest[:40]}"


def scan_limit() -> str:
    """Limit for ``/api/v1/run/*`` (``RATE_LIMIT_SCAN``)."""
    return os.getenv("RATE_LIMIT_SCAN") or DEFAULT_LIMIT


def ingest_limit() -> str:
    """Limit for ``/api/v1/ingest/*`` (``RATE_LIMIT_INGEST``)."""
    return os.getenv("RATE_LIMIT_INGEST") or DEFAULT_LIMIT


def validate_rate_limit_config() -> None:
    """Fail fast at startup on an unparseable limit string.

    Raises:
        RuntimeError: if ``RATE_LIMIT_SCAN`` or ``RATE_LIMIT_INGEST`` is malformed, or
            ``TRUSTED_PROXY_HOPS`` is not a non-negative integer. A wrong hop count
            either merges every visitor into one identity or lets clients forge theirs,
            so a typo must not silently become 0.
    """
    raw_hops = os.getenv("TRUSTED_PROXY_HOPS", "0").strip()
    if not raw_hops.isdigit():
        raise RuntimeError(
            "TRUSTED_PROXY_HOPS must be a non-negative integer (0 = no proxy; otherwise the "
            "forwarded_for_entries value that GET /health reports for a normal client)."
        )
    logger.info("Client IPs are resolved with TRUSTED_PROXY_HOPS=%s", raw_hops)
    for name, value in (("RATE_LIMIT_SCAN", scan_limit()), ("RATE_LIMIT_INGEST", ingest_limit())):
        try:
            parse_limit(value)
        except ValueError as exc:
            raise RuntimeError(f"{name} is not a valid rate limit (expected e.g. '10/minute').") from exc


limiter = Limiter(
    key_func=client_ip,
    enabled=env_flag("RATE_LIMIT_ENABLED", default=True),
    storage_uri=os.getenv("RATE_LIMIT_STORAGE_URI") or "memory://",
)


def _retry_after_seconds(request: Request, exc: RateLimitExceeded) -> int:
    """Seconds until the caller's window resets (falls back to the window length)."""
    window = int(exc.limit.limit.get_expiry()) if exc.limit is not None else 60
    try:
        limit_item, identifiers = request.state.view_rate_limit
        reset_at = limiter.limiter.get_window_stats(limit_item, *identifiers)[0]
        return max(1, min(window, int(reset_at - time.time()) + 1))
    except (AttributeError, TypeError, ValueError, IndexError):
        return max(1, window)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Render 429 with a ``Retry-After`` header and a client-readable message."""
    retry_after = _retry_after_seconds(request, exc)
    return JSONResponse(
        status_code=429,
        content={"detail": f"Too many requests ({exc.detail}). Try again in {retry_after} seconds."},
        headers={"Retry-After": str(retry_after)},
    )
