"""Authentication, per-user report isolation, zero-retention mode, and deletion."""
import time
from typing import Any, Dict

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.core import auth
from conftest import TEST_JWT_SECRET, USER_A, USER_B, bearer, make_token

SCAN_BODY: Dict[str, Any] = {
    "product": "launchgate",
    "project_name": "Isolation",
    "files": [{"filename": "schema.sql", "content": 'CREATE POLICY "p" ON t FOR ALL USING (true);'}],
}


def _create_report(client: TestClient, user: str, **extra: Any) -> Dict[str, Any]:
    response = client.post("/api/v1/run/launchgate", json={**SCAN_BODY, **extra}, headers=bearer(user))
    assert response.status_code == 200, response.text
    return response.json()


# --- Authentication ---------------------------------------------------------

@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/reports"),
        ("get", "/api/v1/reports/rpt_lau_missing"),
        ("delete", "/api/v1/reports/rpt_lau_missing"),
    ],
)
def test_account_routes_reject_anonymous_callers(
    client: TestClient, auth_env: None, method: str, path: str
) -> None:
    response = client.request(method, path)
    assert response.status_code == 401
    assert response.headers["www-authenticate"].lower().startswith("bearer")


@pytest.mark.parametrize("path", ["/api/v1/run/launchgate", "/api/v1/ingest/upload", "/api/v1/ingest/github"])
def test_preview_routes_still_reject_an_invalid_token(client: TestClient, auth_env: None, path: str) -> None:
    # Phase 2B opens these routes to signed-out visitors (one free preview), but a
    # token that is presented must be valid: a bad one is never treated as "anonymous".
    response = client.post(path, json=SCAN_BODY, headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        make_token(USER_A, secret="a-different-secret-that-is-long-enough-000000"),
        make_token(USER_A, exp=int(time.time()) - 600),
        make_token(USER_A, aud="some-other-audience"),
        make_token(None),
        jwt.encode({"sub": USER_A, "aud": "authenticated", "exp": int(time.time()) + 600}, None, algorithm="none"),
    ],
    ids=["garbage", "wrong-secret", "expired", "wrong-audience", "no-subject", "alg-none"],
)
def test_invalid_tokens_are_rejected(client: TestClient, auth_env: None, token: str) -> None:
    response = client.get("/api/v1/reports", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_non_bearer_scheme_is_rejected(client: TestClient, auth_env: None) -> None:
    response = client.get("/api/v1/reports", headers={"Authorization": f"Basic {make_token()}"})
    assert response.status_code == 401


def test_public_routes_stay_open_when_auth_is_required(client: TestClient, auth_env: None) -> None:
    assert client.get("/health").status_code == 200
    assert client.get("/api/v1/samples/launchgate").status_code == 200


def test_presented_token_is_never_trusted_without_a_verifier(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("AUTH_REQUIRED", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    response = client.get("/api/v1/reports", headers=bearer(USER_A))
    assert response.status_code == 401


def test_auth_defaults_to_required_outside_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AUTH_REQUIRED", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    assert auth.load_auth_settings().required is True
    monkeypatch.setenv("ENVIRONMENT", "development")
    assert auth.load_auth_settings().required is False
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    assert auth.load_auth_settings().required is True


def test_startup_fails_closed_when_auth_required_but_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    with pytest.raises(RuntimeError):
        auth.validate_auth_config()


def test_asymmetric_tokens_verify_against_jwks(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    supabase_url = "https://unit-test-project.supabase.co"

    class FakeSigningKey:
        key = private_key.public_key()

    class FakeJwksClient:
        def get_signing_key_from_jwt(self, token: str) -> FakeSigningKey:
            return FakeSigningKey()

    monkeypatch.setenv("AUTH_REQUIRED", "true")
    monkeypatch.setenv("SUPABASE_URL", supabase_url)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.setattr(auth, "_get_jwks_client", lambda url: FakeJwksClient())

    def es256(issuer: str) -> str:
        now = int(time.time())
        claims = {"sub": USER_A, "aud": "authenticated", "iss": issuer, "iat": now, "exp": now + 600}
        return jwt.encode(claims, private_key, algorithm="ES256", headers={"kid": "unit-test-key"})

    good = client.get("/api/v1/reports", headers={"Authorization": f"Bearer {es256(supabase_url + '/auth/v1')}"})
    assert good.status_code == 200
    forged_issuer = client.get(
        "/api/v1/reports", headers={"Authorization": f"Bearer {es256('https://attacker.example/auth/v1')}"}
    )
    assert forged_issuer.status_code == 401
    # An HS256 token must not be accepted when only asymmetric keys are configured.
    downgraded = client.get("/api/v1/reports", headers={"Authorization": f"Bearer {make_token(USER_A, secret=TEST_JWT_SECRET)}"})
    assert downgraded.status_code == 401


# --- Per-user isolation -----------------------------------------------------

def test_reports_are_only_visible_to_their_owner(client: TestClient, auth_env: None) -> None:
    report = _create_report(client, USER_A)
    report_id = report["id"]

    assert client.get(f"/api/v1/reports/{report_id}", headers=bearer(USER_A)).status_code == 200
    assert client.get(f"/api/v1/reports/{report_id}", headers=bearer(USER_B)).status_code == 404

    owner_ids = [r["id"] for r in client.get("/api/v1/reports", headers=bearer(USER_A)).json()]
    other_ids = [r["id"] for r in client.get("/api/v1/reports", headers=bearer(USER_B)).json()]
    assert report_id in owner_ids
    assert report_id not in other_ids


def test_list_only_returns_callers_reports(client: TestClient, auth_env: None) -> None:
    mine = {_create_report(client, USER_B)["id"] for _ in range(2)}
    _create_report(client, USER_A)
    listed = client.get("/api/v1/reports?limit=100", headers=bearer(USER_B)).json()
    assert mine <= {r["id"] for r in listed}
    for report in listed:
        assert client.get(f"/api/v1/reports/{report['id']}", headers=bearer(USER_B)).status_code == 200


def test_list_limit_is_bounded(client: TestClient, auth_env: None) -> None:
    assert client.get("/api/v1/reports?limit=0", headers=bearer(USER_A)).status_code == 422
    assert client.get("/api/v1/reports?limit=100000", headers=bearer(USER_A)).status_code == 422


# --- Deletion ---------------------------------------------------------------

def test_delete_requires_ownership(client: TestClient, auth_env: None) -> None:
    report_id = _create_report(client, USER_A)["id"]

    assert client.delete(f"/api/v1/reports/{report_id}", headers=bearer(USER_B)).status_code == 404
    assert client.get(f"/api/v1/reports/{report_id}", headers=bearer(USER_A)).status_code == 200

    deleted = client.delete(f"/api/v1/reports/{report_id}", headers=bearer(USER_A))
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(f"/api/v1/reports/{report_id}", headers=bearer(USER_A)).status_code == 404
    assert client.delete(f"/api/v1/reports/{report_id}", headers=bearer(USER_A)).status_code == 404


# --- Zero-retention mode ----------------------------------------------------

def test_ephemeral_scan_returns_report_but_persists_nothing(client: TestClient, auth_env: None) -> None:
    report = _create_report(client, USER_A, ephemeral=True)
    assert report["summary"]["total_findings"] > 0
    assert report["metadata"]["ephemeral"] is True

    assert client.get(f"/api/v1/reports/{report['id']}", headers=bearer(USER_A)).status_code == 404
    listed = client.get("/api/v1/reports?limit=100", headers=bearer(USER_A)).json()
    assert report["id"] not in [r["id"] for r in listed]


def test_default_scan_is_persisted_and_flagged_not_ephemeral(client: TestClient, auth_env: None) -> None:
    report = _create_report(client, USER_A)
    assert report["metadata"]["ephemeral"] is False
    assert client.get(f"/api/v1/reports/{report['id']}", headers=bearer(USER_A)).status_code == 200


def test_development_mode_allows_anonymous_scans(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AUTH_REQUIRED", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")
    response = client.post("/api/v1/run/launchgate", json=SCAN_BODY)
    assert response.status_code == 200
    assert client.get(f"/api/v1/reports/{response.json()['id']}").status_code == 200
