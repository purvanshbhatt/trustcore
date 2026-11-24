"""Environment helpers shared by auth, storage, and application startup."""
import os
from typing import FrozenSet, List
from urllib.parse import urlsplit

_DEVELOPMENT_ENVIRONMENTS: FrozenSet[str] = frozenset({"development", "dev", "local", "test"})
_FALSE_VALUES: FrozenSet[str] = frozenset({"0", "false", "no", "off"})
_DEVELOPMENT_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
_LOOPBACK_HOSTS: FrozenSet[str] = frozenset({"localhost", "127.0.0.1"})


def resolve_cors_origins() -> List[str]:
    """Return the exact browser origins allowed to call the API, from ``CORS_ORIGINS`` only.

    There is no wildcard and nothing is added implicitly. Development falls back to
    the local web app when the variable is unset; every other environment must set it.

    Raises:
        RuntimeError: if ``CORS_ORIGINS`` is missing outside development, contains
            ``*``, or has an entry that is not a bare ``scheme://host[:port]`` origin
            (plain ``http`` is accepted for loopback hosts only outside development).
    """
    raw = os.getenv("CORS_ORIGINS")
    if raw is None or not raw.strip():
        if is_development():
            return list(_DEVELOPMENT_CORS_ORIGINS)
        raise RuntimeError(
            f"CORS_ORIGINS must list the web app origin(s), e.g. https://app.example.com. {LOCAL_DEV_HINT}"
        )

    origins: List[str] = []
    for entry in raw.split(","):
        candidate = entry.strip().rstrip("/")
        if not candidate:
            continue
        parts = urlsplit(candidate)
        is_origin = (
            parts.scheme in ("http", "https")
            and bool(parts.hostname)
            and not parts.path
            and not parts.query
            and not parts.fragment
            and parts.username is None
        )
        insecure = parts.scheme == "http" and parts.hostname not in _LOOPBACK_HOSTS and not is_development()
        if not is_origin or insecure:
            raise RuntimeError(
                f"CORS_ORIGINS entry '{candidate}' is not allowed: use exact https origins "
                "(scheme://host[:port]); wildcards are not supported."
            )
        origins.append(candidate)
    if not origins:
        raise RuntimeError("CORS_ORIGINS must list at least one origin.")
    return origins


LOCAL_DEV_HINT = "For local development set ENVIRONMENT=development."


def environment_name() -> str:
    """Return the normalised ``ENVIRONMENT`` value.

    Unset or blank means ``production``: the service fails closed, and every
    development convenience (optional auth, mock billing, SQLite, localhost CORS)
    has to be asked for by naming a development environment.
    """
    return os.getenv("ENVIRONMENT", "").strip().lower() or "production"


def is_development() -> bool:
    """True for local/test environments, where insecure conveniences are tolerated."""
    return environment_name() in _DEVELOPMENT_ENVIRONMENTS


def env_flag(name: str, default: bool) -> bool:
    """Read a boolean environment variable.

    Unset or blank falls back to ``default``. Any value other than an explicit
    false (``0``/``false``/``no``/``off``) counts as true, so a typo in a security
    switch fails closed rather than open.
    """
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() not in _FALSE_VALUES
