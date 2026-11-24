"""Authentication: verify Supabase Auth access tokens and resolve the calling user.

The web app signs users in with Supabase Auth (email magic link or GitHub OAuth)
and sends the session's access token as ``Authorization: Bearer <jwt>``. This
module verifies that token and yields the user id every report is scoped to.

Verification supports both Supabase signing modes:

* asymmetric signing keys (ES256/RS256) via the project's public JWKS endpoint,
  enabled by ``SUPABASE_URL``;
* the legacy shared secret (HS256), enabled by ``SUPABASE_JWT_SECRET``.

Authentication is mandatory unless ``AUTH_REQUIRED=false`` or the service runs in
a development environment, where unauthenticated calls map to a fixed local user.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, FrozenSet, Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import LOCAL_DEV_HINT, env_flag, is_development
from app.core.ratelimit import anonymous_id

logger = logging.getLogger(__name__)

DEV_USER_ID = "local-dev-user"
_ASYMMETRIC_ALGORITHMS: FrozenSet[str] = frozenset({"ES256", "RS256"})
_CLOCK_SKEW_SECONDS = 30
_MAX_SUBJECT_LENGTH = 255

_bearer_scheme = HTTPBearer(auto_error=False, description="Supabase Auth access token")


class TokenError(Exception):
    """Raised when an access token cannot be verified."""


@dataclass(frozen=True)
class AuthSettings:
    """Authentication configuration resolved from the environment."""

    required: bool
    jwt_secret: Optional[str]
    supabase_url: Optional[str]
    audience: str

    @property
    def issuer(self) -> Optional[str]:
        """Expected ``iss`` claim, when the Supabase project URL is known."""
        return f"{self.supabase_url}/auth/v1" if self.supabase_url else None

    @property
    def jwks_url(self) -> Optional[str]:
        """Public signing-key endpoint for asymmetric tokens."""
        return f"{self.issuer}/.well-known/jwks.json" if self.issuer else None

    @property
    def has_verifier(self) -> bool:
        """True when at least one way to verify tokens is configured."""
        return bool(self.jwt_secret or self.supabase_url)


@dataclass(frozen=True)
class AuthenticatedUser:
    """The caller on whose behalf a request runs."""

    id: str
    email: Optional[str] = None
    is_local_dev: bool = False
    is_anonymous: bool = False


def load_auth_settings() -> AuthSettings:
    """Read auth configuration from the environment (evaluated per call)."""
    return AuthSettings(
        required=env_flag("AUTH_REQUIRED", default=not is_development()),
        jwt_secret=(os.getenv("SUPABASE_JWT_SECRET") or "").strip() or None,
        supabase_url=(os.getenv("SUPABASE_URL") or "").strip().rstrip("/") or None,
        audience=(os.getenv("SUPABASE_JWT_AUDIENCE") or "authenticated").strip(),
    )


def validate_auth_config() -> None:
    """Fail fast at startup if authentication is mandatory but cannot work.

    Raises:
        RuntimeError: when auth is required and no token verifier is configured.
    """
    settings = load_auth_settings()
    if settings.required and not settings.has_verifier:
        raise RuntimeError(
            "Authentication is required but no verifier is configured. Set SUPABASE_URL "
            f"(asymmetric signing keys) or SUPABASE_JWT_SECRET (legacy HS256 secret). {LOCAL_DEV_HINT}"
        )
    if not settings.required and not is_development():
        # With auth off every caller is the same user, sharing reports and paid entitlements.
        raise RuntimeError("AUTH_REQUIRED=false is for local development only; remove it outside development.")
    if not settings.required:
        logger.warning(
            "Authentication is DISABLED: unauthenticated requests run as '%s'. "
            "Never use this configuration for a public deployment.",
            DEV_USER_ID,
        )


@lru_cache(maxsize=4)
def _get_jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    """Cached JWKS client; signing keys are cached and refreshed on rotation."""
    return jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600, timeout=5)


def verify_access_token(token: str, settings: AuthSettings) -> Dict[str, Any]:
    """Verify a Supabase access token and return its claims.

    The verification key is chosen from server configuration; the token's ``alg``
    header only selects between configured verifiers and is then pinned for
    decoding, which rules out algorithm-confusion and ``alg: none`` tokens.

    Raises:
        TokenError: if the token is malformed, unsigned, expired, or not issued
            for this project and audience.
    """
    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
    except jwt.PyJWTError as exc:
        raise TokenError("malformed token") from exc

    key: Any
    if algorithm == "HS256" and settings.jwt_secret:
        key = settings.jwt_secret
    elif algorithm in _ASYMMETRIC_ALGORITHMS and settings.jwks_url:
        try:
            key = _get_jwks_client(settings.jwks_url).get_signing_key_from_jwt(token).key
        except jwt.PyJWTError as exc:
            raise TokenError("signing key lookup failed") from exc
    else:
        raise TokenError("token algorithm is not accepted by this deployment")

    try:
        claims: Dict[str, Any] = jwt.decode(
            token,
            key,
            algorithms=[algorithm],
            audience=settings.audience,
            issuer=settings.issuer,
            leeway=_CLOCK_SKEW_SECONDS,
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(type(exc).__name__) from exc

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject or len(subject) > _MAX_SUBJECT_LENGTH:
        raise TokenError("invalid subject claim")
    return claims


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _user_from_credentials(credentials: HTTPAuthorizationCredentials, settings: AuthSettings) -> AuthenticatedUser:
    """Verify a presented bearer token; an unverifiable token is rejected, never ignored."""
    try:
        claims = verify_access_token(credentials.credentials, settings)
    except TokenError as exc:
        # Log the failure class only; never the token or its claims.
        logger.info("Rejected access token: %s", exc)
        raise _unauthorized("Invalid or expired access token.") from exc

    email = claims.get("email")
    return AuthenticatedUser(id=claims["sub"], email=email if isinstance(email, str) else None)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> AuthenticatedUser:
    """FastAPI dependency for routes that need an account (stored reports).

    A presented token is always verified, even where authentication is optional.
    """
    settings = load_auth_settings()
    if credentials is None:
        if settings.required:
            raise _unauthorized("Authentication required.")
        return AuthenticatedUser(id=DEV_USER_ID, is_local_dev=True)
    return _user_from_credentials(credentials, settings)


def get_caller(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> AuthenticatedUser:
    """FastAPI dependency for routes open to signed-out visitors (preview scans, ingestion, billing).

    Without a token the caller is an anonymous visitor identified by a hash of
    their IP address (or the local development user when auth is off). A token,
    when presented, must still be valid.
    """
    settings = load_auth_settings()
    if credentials is None:
        if settings.required:
            return AuthenticatedUser(id=anonymous_id(request), is_anonymous=True)
        return AuthenticatedUser(id=DEV_USER_ID, is_local_dev=True)
    return _user_from_credentials(credentials, settings)
