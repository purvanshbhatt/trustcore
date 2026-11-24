"""File ingestion: size caps, archive safety, format parsing, and safe GitHub fetch."""
import io
import json
import tarfile
import time
import zipfile
from typing import Callable, Dict, List, Optional, Tuple

import httpx
import openpyxl
import pytest
from fastapi.testclient import TestClient

from app.core import ingestion
from app.main import app
from app.routers.ingest import get_github_client

UPLOAD_URL = "/api/v1/ingest/upload"
GITHUB_URL = "/api/v1/ingest/github"
MB = 1024 * 1024


# --- Builders ---------------------------------------------------------------

def _zip(entries: Dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
    return buffer.getvalue()


def _tar_gz(entries: List[Tuple[str, Optional[bytes]]], root: str = "app-0a1b2c3/") -> bytes:
    """Build a GitHub-style tarball; a ``None`` payload creates a symlink member."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for name, data in entries:
            info = tarfile.TarInfo(name=root + name)
            if data is None:
                info.type = tarfile.SYMTYPE
                info.linkname = "/etc/passwd"
                archive.addfile(info)
            else:
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


def _minimal_pdf(text: str) -> bytes:
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        out += b"%010d 00000 n \n" % offset
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def _xlsx(rows: List[List[object]]) -> bytes:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Questionnaire"
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _upload(client: TestClient, name: str, data: bytes, product: Optional[str] = None) -> httpx.Response:
    form = {"product": product} if product else None
    return client.post(UPLOAD_URL, files=[("files", (name, data, "application/octet-stream"))], data=form)


def _names(response: httpx.Response) -> List[str]:
    return [f["filename"] for f in response.json()["files"]]


# --- Plain uploads ----------------------------------------------------------

def test_upload_text_file_returns_its_content(client: TestClient) -> None:
    response = _upload(client, "schema.sql", b"CREATE POLICY p ON t USING (true);\n", "launchgate")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["files"] == [
        {"filename": "schema.sql", "content": "CREATE POLICY p ON t USING (true);\n", "file_type": "sql"}
    ]
    assert body["truncated"] is False


def test_upload_accepts_multiple_files(client: TestClient) -> None:
    response = client.post(
        UPLOAD_URL,
        files=[("files", ("a.ts", b"const a = 1;", "text/plain")), ("files", ("b.ts", b"const b = 2;", "text/plain"))],
        data={"product": "launchgate"},
    )
    assert response.status_code == 200
    assert _names(response) == ["a.ts", "b.ts"]


def test_upload_strips_client_supplied_directories_from_filename(client: TestClient) -> None:
    response = _upload(client, "../../etc/cron.d/evil.sh", b"echo hi\n", "launchgate")
    assert response.status_code == 200
    assert _names(response) == ["evil.sh"]


def test_upload_without_files_is_rejected(client: TestClient) -> None:
    assert client.post(UPLOAD_URL, data={"product": "launchgate"}).status_code == 422


@pytest.mark.parametrize("name,data", [("logo.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"), ("tool.exe", b"MZ\x90\x00\x03")])
def test_upload_rejects_binary_files(client: TestClient, name: str, data: bytes) -> None:
    assert _upload(client, name, data, "launchgate").status_code == 415


def test_upload_rejects_binary_content_with_text_extension(client: TestClient) -> None:
    assert _upload(client, "notes.txt", b"abc\x00\x01\x02def", "launchgate").status_code == 415


@pytest.mark.parametrize(
    "product,name",
    [("agentscope", "repo.zip"), ("agentscope", "main.py"), ("evidence", "config.json"), ("evalkit", "repo.zip")],
)
def test_upload_enforces_per_product_file_types(client: TestClient, product: str, name: str) -> None:
    assert _upload(client, name, b"{}", product).status_code == 415


# --- Size limits ------------------------------------------------------------

def test_upload_over_15mb_is_rejected(client: TestClient) -> None:
    response = _upload(client, "big.txt", b"a" * (15 * MB + 1), "launchgate")
    assert response.status_code == 413


def test_upload_exactly_at_limit_is_accepted(client: TestClient) -> None:
    response = _upload(client, "edge.txt", b"a" * (15 * MB), "launchgate")
    assert response.status_code == 200
    assert response.json()["total_bytes"] == 15 * MB


def test_oversized_body_without_content_length_is_cut_off(client: TestClient) -> None:
    boundary = "trustcoretestboundary"
    head = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="big.txt"\r\n'
        "Content-Type: text/plain\r\n\r\n"
    ).encode()
    tail = f"\r\n--{boundary}--\r\n".encode()

    def body():
        yield head
        for _ in range(18):
            yield b"a" * MB
        yield tail

    response = client.post(
        UPLOAD_URL, content=body(), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    assert response.status_code == 413


def test_declared_content_length_over_limit_is_rejected_early(client: TestClient) -> None:
    response = _upload(client, "huge.txt", b"a" * (17 * MB), "launchgate")
    assert response.status_code == 413


# --- ZIP archives -----------------------------------------------------------

def test_zip_extracts_text_and_skips_dependencies_vcs_and_binaries(client: TestClient) -> None:
    archive = _zip(
        {
            "src/api.ts": b'const KEY = "x";\n',
            ".env.production": b"A=1\n",
            "node_modules/left-pad/index.js": b"module.exports = 1;",
            "packages/web/node_modules/x/y.js": b"1",
            ".git/config": b"[core]",
            "assets/logo.png": b"\x89PNG\r\n\x1a\n\x00\x00",
            "bin/blob.dat": b"\x00\x01\x02\x03binary",
            "docs/": b"",
        }
    )
    response = _upload(client, "export.zip", archive, "launchgate")
    assert response.status_code == 200, response.text
    body = response.json()
    assert sorted(_names(response)) == [".env.production", "src/api.ts"]
    reasons = {item["path"]: item["reason"] for item in body["skipped"]}
    assert reasons["node_modules/left-pad/index.js"] == "excluded_directory"
    assert reasons["packages/web/node_modules/x/y.js"] == "excluded_directory"
    assert reasons[".git/config"] == "excluded_directory"
    assert reasons["assets/logo.png"] == "binary"
    assert reasons["bin/blob.dat"] == "binary"
    assert body["skipped_count"] == 5


@pytest.mark.parametrize(
    "member",
    ["../../etc/passwd", "/etc/passwd", "src/../../escape.txt", "..\\..\\windows\\evil.txt", "C:\\Windows\\evil.txt"],
)
def test_zip_slip_paths_reject_the_whole_archive(client: TestClient, member: str) -> None:
    archive = _zip({"ok.txt": b"fine", member: b"pwned"})
    response = _upload(client, "evil.zip", archive, "launchgate")
    assert response.status_code == 400
    assert "path" in response.json()["detail"].lower()


def test_corrupt_zip_is_rejected(client: TestClient) -> None:
    assert _upload(client, "broken.zip", b"PK\x03\x04 this is not a zip", "launchgate").status_code == 400


def test_zip_bomb_is_rejected(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ingestion, "MAX_DECOMPRESSED_BYTES", 1 * MB)
    archive = _zip({f"bomb_{index}.txt": b"0" * (512 * 1024) for index in range(6)})
    assert len(archive) < 64 * 1024
    assert _upload(client, "bomb.zip", archive, "launchgate").status_code == 413


def test_zip_file_count_limit_truncates(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ingestion, "MAX_FILE_COUNT", 3)
    archive = _zip({f"src/file_{index}.ts": b"export {};" for index in range(6)})
    body = _upload(client, "many.zip", archive, "launchgate").json()
    assert len(body["files"]) == 3
    assert body["truncated"] is True
    assert body["skipped_count"] == 3


def test_zip_oversized_member_is_skipped(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ingestion, "MAX_FILE_BYTES", 1024)
    archive = _zip({"small.ts": b"ok", "bundle.js": b"x" * 5000})
    body = _upload(client, "mixed.zip", archive, "launchgate").json()
    assert [f["filename"] for f in body["files"]] == ["small.ts"]
    assert body["skipped"] == [{"path": "bundle.js", "reason": "too_large"}]


def test_ingested_zip_feeds_a_real_scan(client: TestClient) -> None:
    secret = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d"
    archive = _zip({"src/api.ts": f'const OPENAI_API_KEY = "{secret}";\n'.encode()})
    files = _upload(client, "export.zip", archive, "launchgate").json()["files"]
    scan = client.post("/api/v1/run/launchgate", json={"product": "launchgate", "files": files, "ephemeral": True})
    assert scan.status_code == 200
    assert scan.json()["summary"]["critical_count"] >= 1
    assert secret not in scan.text


# --- MCP / agent configs ----------------------------------------------------

def test_json_config_is_passed_through(client: TestClient) -> None:
    payload = b'{\n  "mcpServers": {}\n}'
    response = _upload(client, "mcp.json", payload, "agentscope")
    assert response.status_code == 200
    assert response.json()["files"][0] == {"filename": "mcp.json", "content": payload.decode(), "file_type": "json"}


def test_yaml_config_is_normalised_to_json_for_agentscope(client: TestClient) -> None:
    payload = b"mcpServers:\n  filesystem:\n    args: [-y, server, /]\n    scopes: ['*']\n"
    response = _upload(client, "agent.yaml", payload, "agentscope")
    assert response.status_code == 200, response.text
    ingested = response.json()["files"][0]
    assert ingested["file_type"] == "yaml"
    assert json.loads(ingested["content"]) == {
        "mcpServers": {"filesystem": {"args": ["-y", "server", "/"], "scopes": ["*"]}}
    }
    scan = client.post(
        "/api/v1/run/agentscope", json={"product": "agentscope", "files": [ingested], "ephemeral": True}
    )
    assert {f["rule_id"] for f in scan.json()["findings"]} >= {"AS-SCP-001", "AS-FS-001"}


def test_yaml_alias_bomb_is_rejected(client: TestClient) -> None:
    payload = b"a: &a [x, x, x]\nb: &b [*a, *a, *a]\nc: [*b, *b, *b]\n"
    assert _upload(client, "bomb.yaml", payload, "agentscope").status_code == 400


def test_oversized_yaml_config_is_rejected(client: TestClient) -> None:
    payload = ("key_%d: value\n" * 30_000 % tuple(range(30_000))).encode()
    assert len(payload) > 256 * 1024
    start = time.perf_counter()
    response = _upload(client, "huge.yaml", payload, "agentscope")
    assert response.status_code == 413
    assert time.perf_counter() - start < 2.0


def test_deeply_nested_yaml_is_rejected_quickly(client: TestClient) -> None:
    start = time.perf_counter()
    response = _upload(client, "deep.yaml", b"a: " + b"[" * 5_000, "agentscope")
    assert response.status_code == 400
    assert time.perf_counter() - start < 2.0


def test_yaml_at_size_cap_parses_in_bounded_time(client: TestClient) -> None:
    lines = []
    size = 0
    while size < 250 * 1024:
        line = f"server_{len(lines)}: {{command: npx, scope: read_only}}\n"
        lines.append(line)
        size += len(line)
    start = time.perf_counter()
    response = _upload(client, "large.yaml", "".join(lines).encode(), "agentscope")
    assert response.status_code == 200
    assert time.perf_counter() - start < 10.0


def test_invalid_yaml_is_rejected(client: TestClient) -> None:
    assert _upload(client, "bad.yml", b"key: [unclosed\n  other: : :", "agentscope").status_code == 400


# --- Questionnaires and policy documents ------------------------------------

def test_csv_questionnaire(client: TestClient) -> None:
    payload = b"id,question\nCC6.1,How is access restricted?\n"
    ingested = _upload(client, "questions.csv", payload, "evidence").json()["files"][0]
    assert ingested["file_type"] == "questionnaire"
    assert "How is access restricted?" in ingested["content"]


def test_xlsx_questionnaire_is_converted_to_text(client: TestClient) -> None:
    payload = _xlsx([["id", "question"], ["CC6.6", "Is data encrypted at rest?"], [None, None], ["A1.2", 42]])
    response = _upload(client, "questions.xlsx", payload, "evidence")
    assert response.status_code == 200, response.text
    ingested = response.json()["files"][0]
    assert ingested["file_type"] == "questionnaire"
    assert "CC6.6,Is data encrypted at rest?" in ingested["content"]
    assert "A1.2,42" in ingested["content"]


def test_corrupt_xlsx_is_rejected(client: TestClient) -> None:
    assert _upload(client, "broken.xlsx", b"not a workbook", "evidence").status_code == 400


def test_pdf_policy_text_is_extracted(client: TestClient) -> None:
    response = _upload(client, "policy.pdf", _minimal_pdf("Customer data is encrypted with AES-256"), "evidence")
    assert response.status_code == 200, response.text
    ingested = response.json()["files"][0]
    assert ingested["file_type"] == "policy_doc"
    assert "Customer data is encrypted with AES-256" in ingested["content"]


def test_corrupt_pdf_is_rejected(client: TestClient) -> None:
    assert _upload(client, "broken.pdf", b"%PDF-1.4 garbage", "evidence").status_code == 400


@pytest.mark.parametrize("name", ["policy.md", "policy.txt"])
def test_markdown_and_text_policies(client: TestClient, name: str) -> None:
    ingested = _upload(client, name, "# Policy\nTLS 1.3 everywhere — always.\n".encode(), "evidence").json()["files"][0]
    assert ingested["file_type"] == "policy_doc"
    assert "TLS 1.3 everywhere — always." in ingested["content"]


def test_questionnaire_text_is_not_counted_as_policy_evidence(client: TestClient) -> None:
    question = "How are customer data encrypted at rest and in transit with AES-256 encryption and TLS 1.3?"
    scan = client.post(
        "/api/v1/run/evidence",
        json={
            "product": "evidence",
            "ephemeral": True,
            "files": [{"filename": "questions.csv", "content": question, "file_type": "questionnaire"}],
        },
    )
    assert scan.status_code == 200
    assert {item["status"] for item in scan.json()["evidence_matrix"]} == {"UNSUPPORTED_GAP"}


# --- GitHub -----------------------------------------------------------------

Handler = Callable[[httpx.Request], httpx.Response]


def _use_github(handler: Handler) -> List[str]:
    """Route the GitHub fetcher through a mock transport; returns the request log."""
    calls: List[str] = []

    def recording(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        return handler(request)

    app.dependency_overrides[get_github_client] = lambda: httpx.Client(
        transport=httpx.MockTransport(recording), follow_redirects=False
    )
    return calls


def _github_serving(archive: bytes) -> Handler:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "github.com":
            return httpx.Response(302, headers={"location": "https://codeload.github.com/acme/app/tar.gz/main"})
        return httpx.Response(200, content=archive, headers={"content-type": "application/x-gzip"})

    return handler


def test_github_ingest_downloads_and_filters_archive(client: TestClient) -> None:
    archive = _tar_gz(
        [
            ("src/app.ts", b"export const a = 1;\n"),
            ("node_modules/dep/index.js", b"1"),
            (".git/HEAD", b"ref: refs/heads/main"),
            ("link-to-passwd", None),
            ("public/logo.png", b"\x89PNG\x00\x00"),
        ]
    )
    calls = _use_github(_github_serving(archive))
    response = client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/app", "ref": "main"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert _names(response) == ["src/app.ts"]
    assert body["source"] == "github:acme/app@main"
    assert calls == [
        "https://github.com/acme/app/archive/main.tar.gz",
        "https://codeload.github.com/acme/app/tar.gz/main",
    ]
    reasons = {item["path"]: item["reason"] for item in body["skipped"]}
    assert reasons["link-to-passwd"] == "not_a_regular_file"
    assert reasons["node_modules/dep/index.js"] == "excluded_directory"


def test_github_ingest_defaults_to_head_and_accepts_tree_urls(client: TestClient) -> None:
    archive = _tar_gz([("README.md", b"# hi\n")])
    calls = _use_github(_github_serving(archive))
    assert client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/app.git"}).status_code == 200
    assert client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/app/tree/release/v2"}).status_code == 200
    assert calls[0] == "https://github.com/acme/app/archive/HEAD.tar.gz"
    assert calls[2] == "https://github.com/acme/app/archive/release/v2.tar.gz"


@pytest.mark.parametrize(
    "repo_url",
    [
        "http://github.com/acme/app",
        "https://evil.example/acme/app",
        "https://github.com.evil.example/acme/app",
        "https://github.com@evil.example/acme/app",
        "https://user:pass@github.com/acme/app",
        "https://github.com:8443/acme/app",
        "https://169.254.169.254/latest/meta-data",
        "https://github.com/acme",
        "https://github.com/acme/..",
        "https://github.com/ac me/app",
        "file:///etc/passwd",
        "github.com/acme/app",
    ],
)
def test_github_ingest_rejects_untrusted_urls_without_fetching(client: TestClient, repo_url: str) -> None:
    calls = _use_github(lambda request: httpx.Response(200, content=b""))
    assert client.post(GITHUB_URL, json={"repo_url": repo_url}).status_code == 400
    assert calls == []


@pytest.mark.parametrize("ref", ["../../secrets", "main/../x", "/abs", "a b", "x" * 300, "ref?x=1"])
def test_github_ingest_rejects_unsafe_refs(client: TestClient, ref: str) -> None:
    calls = _use_github(lambda request: httpx.Response(200, content=b""))
    assert client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/app", "ref": ref}).status_code == 400
    assert calls == []


def test_github_ingest_refuses_redirects_to_other_hosts(client: TestClient) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "https://169.254.169.254/latest/meta-data/"})

    calls = _use_github(handler)
    response = client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/app"})
    assert response.status_code == 502
    assert calls == ["https://github.com/acme/app/archive/HEAD.tar.gz"]


def test_github_ingest_enforces_download_cap(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ingestion, "MAX_UPLOAD_BYTES", 2048)
    _use_github(_github_serving(b"\x1f\x8b" + b"\x00" * 10_000))
    assert client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/app"}).status_code == 413


def test_github_ingest_maps_missing_repo_to_404(client: TestClient) -> None:
    _use_github(lambda request: httpx.Response(404))
    assert client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/private"}).status_code == 404


def test_github_ingest_rejects_traversal_members(client: TestClient) -> None:
    _use_github(_github_serving(_tar_gz([("ok.txt", b"ok"), ("../../../etc/cron.d/evil", b"pwned")])))
    assert client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/app"}).status_code == 400


def test_github_ingest_enforces_file_count_limit(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ingestion, "MAX_FILE_COUNT", 2)
    _use_github(_github_serving(_tar_gz([(f"src/f{index}.ts", b"export {};") for index in range(5)])))
    body = client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/app"}).json()
    assert len(body["files"]) == 2
    assert body["truncated"] is True


def test_github_ingest_handles_corrupt_archives(client: TestClient) -> None:
    _use_github(_github_serving(b"definitely not gzip data"))
    assert client.post(GITHUB_URL, json={"repo_url": "https://github.com/acme/app"}).status_code == 502
