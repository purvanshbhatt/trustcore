"""Secret redaction: no live credential may reach a response, the database, or logs."""
import json
import logging
import time

import pytest
from fastapi.testclient import TestClient

from app.core.redaction import MASK, mask_secret, redact_secrets, safe_snippet
from app.core.schemas import ScanInputFile
from app.rules.agentscope import AgentScopeRulePack
from app.rules.launchgate import LaunchGateRulePack

OPENAI_KEY = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d"
ANTHROPIC_KEY = "sk-ant-live-secret-prod-token-9988223344"
STRIPE_KEY = "sk_test_51M0CKSTRIPEKEY99283746152433"
SERVICE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiYWRtaW4ifQ.signature"
# Key-shaped fixtures are assembled at runtime so no credential-shaped literal is committed.
AWS_KEY = "AKIA" + "IOSFODNN7EXAMPLE"  # the id AWS uses in its documentation
AWS_KEY_2 = "AKIA" + "ABCDEFGHIJKLMNOP"
GITHUB_TOKEN = "ghp_" + "0123456789abcdefghijABCDEFGHIJ012345"


def test_mask_secret_keeps_first_and_last_four() -> None:
    assert mask_secret(OPENAI_KEY) == "sk-p****2c1d"


def test_mask_secret_hides_short_values_entirely() -> None:
    assert mask_secret("hunter2") == MASK
    assert mask_secret("abcdefghij") == "ab****ij"


@pytest.mark.parametrize(
    "line,secret",
    [
        (f'const OPENAI_API_KEY = "{OPENAI_KEY}";', OPENAI_KEY),
        (f'"ANTHROPIC_API_KEY": "{ANTHROPIC_KEY}"', ANTHROPIC_KEY),
        (f"STRIPE_SECRET_KEY={STRIPE_KEY}", STRIPE_KEY),
        (f"NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY={SERVICE_JWT}", SERVICE_JWT),
        (f"aws_access_key_id = {AWS_KEY}", AWS_KEY),
        (f"git remote set-url origin https://{GITHUB_TOKEN}@github.com/acme/app.git", GITHUB_TOKEN),
        ("Authorization: Bearer abcdef0123456789abcdef0123456789", "abcdef0123456789abcdef0123456789"),
        ("DATABASE_URL=postgresql://postgres:Sup3rS3cretPw@db.acme.co:5432/app", "Sup3rS3cretPw"),
        ('db_password: "correct horse battery staple"', "correct horse battery staple"),
        ("password: correcthorsebattery", "correcthorsebattery"),
        ("CLIENT_SECRET='a1b2c3d4e5f6g7h8'", "a1b2c3d4e5f6g7h8"),
    ],
)
def test_redact_secrets_masks_values(line: str, secret: str) -> None:
    redacted = redact_secrets(line)
    assert secret not in redacted
    assert MASK in redacted


@pytest.mark.parametrize(
    "line",
    [
        '"args": ["-y", "@modelcontextprotocol/server-filesystem", "/"],',
        "NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co",
        "const apiKey = process.env.OPENAI_API_KEY;",
        '"ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"',
        "headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }",
        "token: str = Depends(get_token)",
        "password: string;",
        'CREATE POLICY "Public read and write access" ON public.user_profiles',
        '"confirmation_required": false',
        "secret_key = settings.secret_key",
        "max_tokens: 4096",
    ],
)
def test_redact_secrets_leaves_non_secrets_alone(line: str) -> None:
    assert redact_secrets(line) == line


def test_redact_secrets_is_idempotent() -> None:
    line = f'const OPENAI_API_KEY = "{OPENAI_KEY}"; // {STRIPE_KEY}'
    once = redact_secrets(line)
    assert redact_secrets(once) == once


@pytest.mark.parametrize(
    "line",
    [
        "a" * 300_000,
        "secret" * 50_000,
        "eyJ" * 100_000,
        "x://" * 75_000,
        "token=" * 50_000,
        'password = "' + "a" * 300_000,
        AWS_KEY_2 + " " + "a" * 1_000_000,
        ("Bearer " + " " * 50) * 5_000,
        "x token=abc12345 " * 50_000,
        'k_secret: "v" ' * 50_000,
        "a.b-c_d." * 100_000 + "=",
    ],
    ids=[
        "long-run", "secret-run", "jwt-prefix-run", "url-run", "key-run", "open-quote",
        "rule-hit-then-run", "bearer-run", "many-bare-assignments", "many-quoted-assignments", "dotted-run",
    ],
)
def test_redaction_runs_in_linear_time_on_hostile_lines(line: str) -> None:
    """One long attacker-controlled line must not stall the scanner (ReDoS)."""
    start = time.perf_counter()
    redact_secrets(line)
    redact_secrets(line, include_assignments=False)
    safe_snippet(line)
    assert time.perf_counter() - start < 2.0


def test_safe_snippet_is_bounded() -> None:
    snippet = safe_snippet("x = 1; " * 10_000)
    assert len(snippet) <= 503
    assert snippet.endswith("...")


def test_safe_snippet_never_shows_a_secret_split_by_its_window() -> None:
    # A single unbroken value far longer than the redaction window: no part of it may appear.
    snippet = safe_snippet('const blob = "' + "a1B2" * 5_000 + '";')
    assert "a1B2" not in snippet
    snippet = safe_snippet("CONFIG=" + "Zz9" * 5_000)
    assert "Zz9" not in snippet


def test_unterminated_quoted_secret_is_masked() -> None:
    redacted = redact_secrets('private_key = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIB')
    assert "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIB" not in redacted
    assert MASK in redacted


def test_secret_in_url_query_is_masked() -> None:
    redacted = redact_secrets("callback=https://api.example.test/hook?token=abcdef1234567890&x=1")
    assert "abcdef1234567890" not in redacted


def test_launchgate_scan_of_hostile_line_is_fast() -> None:
    hostile = AWS_KEY_2 + " " + "secret" * 100_000
    start = time.perf_counter()
    result = LaunchGateRulePack().run(files=[ScanInputFile(filename="a.txt", content=hostile)])
    assert time.perf_counter() - start < 3.0
    assert result.findings and AWS_KEY_2 not in result.model_dump_json()


@pytest.mark.parametrize(
    "filename,unit",
    [
        ("schema.sql", "create policy "),
        ("schema.sql", "create policy x using ( "),
        ("schema.sql", "with check ( "),
        (".env", "NEXT_PUBLIC_"),
        ("firestore.rules", "allow read, "),
        ("app.ts", "sk-"),
    ],
)
def test_launchgate_rules_run_in_linear_time_on_hostile_lines(filename: str, unit: str) -> None:
    content = unit * (600_000 // len(unit))
    start = time.perf_counter()
    LaunchGateRulePack().run(files=[ScanInputFile(filename=filename, content=content)])
    assert time.perf_counter() - start < 3.0


@pytest.mark.parametrize(
    "line,expected",
    [
        ('CREATE POLICY "p" ON t FOR ALL USING (true);', True),
        ("create   policy p on t using( true )", True),
        ("  WITH CHECK (true);", True),
        ("USING (true) -- then CREATE POLICY p ON t", False),
        ('CREATE POLICY "p" ON t USING (auth.uid() = user_id);', False),
        ("-- using (true) is dangerous", False),
    ],
)
def test_launchgate_open_rls_policy_detection(line: str, expected: bool) -> None:
    result = LaunchGateRulePack().run(files=[ScanInputFile(filename="schema.sql", content=line)])
    assert any(f.rule_id == "LG-RLS-001" for f in result.findings) is expected


def test_launchgate_masks_a_rule_match_that_has_no_token_boundary() -> None:
    # The AWS rule matches inside a longer word, where the generic patterns see no token.
    content = f'const blob = "X{AWS_KEY}ZZ";\n'
    result = LaunchGateRulePack().run(files=[ScanInputFile(filename="a.ts", content=content)])
    assert [f.rule_id for f in result.findings] == ["LG-SEC-004"]
    assert AWS_KEY not in result.model_dump_json()


def test_launchgate_citations_never_contain_raw_secrets() -> None:
    files = [
        ScanInputFile(filename="src/api.ts", content=f'const OPENAI_API_KEY = "{OPENAI_KEY}";\n'),
        ScanInputFile(
            filename=".env.production",
            content=f"NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY={SERVICE_JWT}\nSTRIPE_SECRET_KEY={STRIPE_KEY}\n",
        ),
    ]
    result = LaunchGateRulePack().run(files=files)
    assert result.findings, "secret rules must still fire on redacted output"
    blob = result.model_dump_json()
    for secret in (OPENAI_KEY, SERVICE_JWT, STRIPE_KEY):
        assert secret not in blob
    assert any("sk-p****2c1d" in f.citation.snippet for f in result.findings)
    # Descriptions must use the same first-4/last-4 mask, not a longer prefix.
    assert OPENAI_KEY[:8] not in blob


def test_agentscope_citations_never_contain_raw_secrets() -> None:
    config = json.dumps(
        {"mcpServers": {"fs": {"env": {"ANTHROPIC_API_KEY": ANTHROPIC_KEY, "GH": GITHUB_TOKEN}}}},
        indent=2,
    )
    result = AgentScopeRulePack().run(files=[ScanInputFile(filename="mcp.json", content=config)])
    assert any(f.rule_id == "AS-KEY-001" for f in result.findings)
    blob = result.model_dump_json()
    assert ANTHROPIC_KEY not in blob
    assert GITHUB_TOKEN not in blob


def test_scan_response_storage_and_logs_are_redacted(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    sample = client.get("/api/v1/samples/launchgate").json()
    with caplog.at_level(logging.DEBUG):
        scan = client.post(
            "/api/v1/run/launchgate",
            json={"product": "launchgate", "project_name": "Redaction", "files": sample["files"]},
        )
    assert scan.status_code == 200
    stored = client.get(f"/api/v1/reports/{scan.json()['id']}")
    assert stored.status_code == 200

    raw_secrets = (
        OPENAI_KEY,
        STRIPE_KEY,
        SERVICE_JWT,
        "MOCK_SUPABASE_SERVICE_KEY_SIGNATURE_DATA_HERE",
    )
    for secret in raw_secrets:
        assert secret not in scan.text
        assert secret not in stored.text
        assert secret not in caplog.text
    assert MASK in scan.text


def test_raw_content_snippet_is_redacted(client: TestClient) -> None:
    scan = client.post(
        "/api/v1/run/agentscope",
        json={
            "product": "agentscope",
            "project_name": "Inline",
            "raw_content": json.dumps({"env": {"ANTHROPIC_API_KEY": ANTHROPIC_KEY}}, indent=2),
        },
    )
    assert scan.status_code == 200
    assert ANTHROPIC_KEY not in scan.text
