"""Rate limiting on scan and ingest routes, client IP resolution, and CORS lock-down."""
from typing import Any, Dict, Iterator, Optional

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core import config
from app.core.ratelimit import client_ip, ingest_limit, limiter, scan_limit

SCAN_BODY: Dict[str, Any] = {"product": "launchgate", "files": [{"filename": "a.ts", "content": "const a = 1;"}]}


@pytest.fixture
def rate_limited(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("RATE_LIMIT_SCAN", "3/minute")
    monkeypatch.setenv("RATE_LIMIT_INGEST", "2/minute")
    limiter.reset()
    limiter.enabled = True
    yield
    limiter.enabled = False
    limiter.reset()


def _scan(client: TestClient, product: str = "launchgate", headers: Optional[Dict[str, str]] = None) -> Any:
    return client.post(f"/api/v1/run/{product}", json={**SCAN_BODY, "product": product}, headers=headers or {})


def _upload(client: TestClient) -> Any:
    return client.post("/api/v1/ingest/upload", files=[("files", ("a.ts", b"const a = 1;", "text/plain"))])


def _request(peer: str, forwarded: Optional[str] = None) -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "client": (peer, 1234), "headers": headers})


# --- Limits -----------------------------------------------------------------

def test_default_limits_are_ten_per_minute(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RATE_LIMIT_SCAN", raising=False)
    monkeypatch.delenv("RATE_LIMIT_INGEST", raising=False)
    assert scan_limit() == "10/minute"
    assert ingest_limit() == "10/minute"


def test_scan_route_is_limited_per_client(client: TestClient, rate_limited: None) -> None:
    for _ in range(3):
        assert _scan(client).status_code == 200
    blocked = _scan(client)
    assert blocked.status_code == 429
    assert isinstance(blocked.json()["detail"], str)
    assert 1 <= int(blocked.headers["retry-after"]) <= 60


def test_all_products_share_the_scan_budget(client: TestClient, rate_limited: None) -> None:
    assert _scan(client, "launchgate").status_code == 200
    assert _scan(client, "agentscope").status_code == 200
    assert _scan(client, "evalkit").status_code == 200
    assert _scan(client, "evidence").status_code == 429


def test_ingest_routes_share_their_own_budget(client: TestClient, rate_limited: None) -> None:
    assert _upload(client).status_code == 200
    # A rejected request still counts against the budget.
    assert client.post("/api/v1/ingest/github", json={"repo_url": "https://evil.example/a/b"}).status_code == 400
    assert _upload(client).status_code == 429
    # The scan budget is separate.
    assert _scan(client).status_code == 200


def test_unlimited_routes_are_not_throttled(client: TestClient, rate_limited: None) -> None:
    for _ in range(15):
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/samples/launchgate").status_code == 200


def test_limits_are_per_ip_and_forged_forwarding_headers_do_not_reset_them(
    client: TestClient, rate_limited: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    for forged in ("10.0.0.1", "10.0.0.2", "10.0.0.3"):
        assert _scan(client, headers={"X-Forwarded-For": f"{forged}, 203.0.113.7"}).status_code == 200
    assert _scan(client, headers={"X-Forwarded-For": "10.0.0.4, 203.0.113.7"}).status_code == 429
    assert _scan(client, headers={"X-Forwarded-For": "203.0.113.8"}).status_code == 200


def test_forwarding_headers_are_ignored_without_a_trusted_proxy(
    client: TestClient, rate_limited: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("TRUSTED_PROXY_HOPS", raising=False)
    for index in range(3):
        assert _scan(client, headers={"X-Forwarded-For": f"203.0.113.{index}"}).status_code == 200
    assert _scan(client, headers={"X-Forwarded-For": "203.0.113.99"}).status_code == 429


def test_limiter_can_be_disabled(client: TestClient, rate_limited: None) -> None:
    limiter.enabled = False
    for _ in range(6):
        assert _scan(client).status_code == 200


# --- Client IP --------------------------------------------------------------

@pytest.mark.parametrize(
    "hops,peer,forwarded,expected",
    [
        (None, "198.51.100.1", "203.0.113.5", "198.51.100.1"),
        ("0", "198.51.100.1", "203.0.113.5", "198.51.100.1"),
        ("1", "10.0.0.1", "203.0.113.5", "203.0.113.5"),
        ("1", "10.0.0.1", "1.1.1.1, 203.0.113.5", "203.0.113.5"),
        ("2", "10.0.0.1", "1.1.1.1, 203.0.113.5, 10.0.0.9", "203.0.113.5"),
        ("2", "10.0.0.1", "203.0.113.5", "10.0.0.1"),
        ("1", "10.0.0.1", None, "10.0.0.1"),
        ("1", "10.0.0.1", "not-an-ip", "10.0.0.1"),
        ("bogus", "198.51.100.1", "203.0.113.5", "198.51.100.1"),
    ],
)
def test_client_ip_resolution(
    monkeypatch: pytest.MonkeyPatch, hops: Optional[str], peer: str, forwarded: Optional[str], expected: str
) -> None:
    if hops is None:
        monkeypatch.delenv("TRUSTED_PROXY_HOPS", raising=False)
    else:
        monkeypatch.setenv("TRUSTED_PROXY_HOPS", hops)
    assert client_ip(_request(peer, forwarded)) == expected


# --- CORS -------------------------------------------------------------------

def test_cors_defaults_to_localhost_only_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert config.resolve_cors_origins() == ["http://localhost:3000", "http://127.0.0.1:3000"]


def test_cors_origins_come_only_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.trustcore.test, https://www.trustcore.test/")
    # Exactly what was configured: no wildcard, no implicit localhost.
    assert config.resolve_cors_origins() == ["https://app.trustcore.test", "https://www.trustcore.test"]


@pytest.mark.parametrize(
    "value",
    [None, "", "*", "https://app.trustcore.test,*", "app.trustcore.test", "https://app.trustcore.test/path", "ftp://x.test"],
)
def test_production_refuses_missing_wildcard_or_malformed_origins(
    monkeypatch: pytest.MonkeyPatch, value: Optional[str]
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    if value is None:
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("CORS_ORIGINS", value)
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        config.resolve_cors_origins()


def test_wildcard_is_refused_even_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        config.resolve_cors_origins()


def test_cors_headers_are_only_sent_to_allowed_origins(client: TestClient) -> None:
    preflight = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"}
    allowed = client.options("/api/v1/run/launchgate", headers={"Origin": "http://localhost:3000", **preflight})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "access-control-allow-credentials" not in allowed.headers
    assert "DELETE" in allowed.headers["access-control-allow-methods"]

    foreign = client.options("/api/v1/run/launchgate", headers={"Origin": "https://evil.example", **preflight})
    assert "access-control-allow-origin" not in foreign.headers

    simple = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in simple.headers


# --- Review hardening -------------------------------------------------------

def test_ipv6_clients_are_identified_by_their_64_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TRUSTED_PROXY_HOPS", raising=False)
    first = client_ip(_request("2001:db8:1:2:aaaa::1"))
    assert first == client_ip(_request("2001:db8:1:2:bbbb:cccc:dddd:2")) == "2001:db8:1:2::/64"
    assert client_ip(_request("2001:db8:1:3::1")) != first
    assert client_ip(_request("::ffff:203.0.113.5")) == "203.0.113.5"
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    assert client_ip(_request("10.0.0.1", "2001:db8:1:2:ffff::9")) == "2001:db8:1:2::/64"


@pytest.mark.parametrize("value", ["bogus", "-1", "1.5"])
def test_startup_rejects_an_invalid_proxy_hop_count(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    from app.core.ratelimit import validate_rate_limit_config

    monkeypatch.setenv("TRUSTED_PROXY_HOPS", value)
    with pytest.raises(RuntimeError, match="TRUSTED_PROXY_HOPS"):
        validate_rate_limit_config()
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    validate_rate_limit_config()


def test_startup_rejects_a_malformed_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.ratelimit import validate_rate_limit_config

    monkeypatch.setenv("RATE_LIMIT_SCAN", "lots")
    with pytest.raises(RuntimeError, match="RATE_LIMIT_SCAN"):
        validate_rate_limit_config()


def test_auth_cannot_be_switched_off_outside_development(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import auth

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("AUTH_REQUIRED", "false")
    monkeypatch.setenv("SUPABASE_URL", "https://unit-test-project.supabase.co")
    with pytest.raises(RuntimeError, match="AUTH_REQUIRED"):
        auth.validate_auth_config()
    monkeypatch.setenv("ENVIRONMENT", "development")
    auth.validate_auth_config()


# --- Fail closed when ENVIRONMENT is not set --------------------------------

def test_unset_environment_is_treated_as_production(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import auth, billing, db

    for name in ("ENVIRONMENT", "AUTH_REQUIRED", "MOCK_BILLING", "CORS_ORIGINS", "DATABASE_URL"):
        monkeypatch.delenv(name, raising=False)

    assert config.environment_name() == "production"
    assert config.is_development() is False
    assert auth.load_auth_settings().required is True
    assert billing.load_billing_settings().mock is False
    with pytest.raises(RuntimeError, match="ENVIRONMENT=development"):
        config.resolve_cors_origins()
    with pytest.raises(RuntimeError, match="ENVIRONMENT=development"):
        db.resolve_database_url()

    monkeypatch.setenv("ENVIRONMENT", "  ")
    assert config.is_development() is False


@pytest.mark.parametrize("value", ["development", "dev", "local", "test", "Development"])
def test_development_must_be_named_explicitly(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    monkeypatch.setenv("ENVIRONMENT", value)
    assert config.is_development() is True
