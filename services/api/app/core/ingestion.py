"""Multi-format file ingestion.

Turns untrusted uploads and public GitHub archives into in-memory text files
(``ScanInputFile``) for the rule packs.

Safety model:

* Nothing is written to disk. Archives are read member-by-member from memory, so
  a hostile member path can never land on the filesystem; archives containing
  absolute or ``..`` paths are still rejected outright.
* Every stage is bounded: request/download size, per-member size, file count,
  total extracted text, and total decompressed bytes (zip/gzip bombs).
* Dependency and VCS directories and binary files are skipped.
* GitHub fetches never follow a user-supplied URL: the archive URL is rebuilt from
  a validated owner/repo/ref, and redirects are only followed to GitHub hosts.
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import logging
import re
import stat
import tarfile
import time
import zipfile
import zlib
from pathlib import PurePosixPath
from typing import Any, BinaryIO, Dict, FrozenSet, List, Optional, Pattern, Tuple
from urllib.parse import quote, urljoin, urlsplit
from xml.etree.ElementTree import ParseError as XmlParseError

import httpx
import yaml
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from pypdf import PdfReader
from pypdf.errors import DependencyError, PyPdfError

from app.core.schemas import IngestResponse, IngestSkippedFile, ProductType, ScanInputFile

logger = logging.getLogger(__name__)

MB = 1024 * 1024

# Limits are module attributes read at call time so deployments and tests can tune them.
MAX_UPLOAD_BYTES = 15 * MB  # one upload request, or one GitHub archive download
MAX_FILE_BYTES = 1 * MB  # a single archive member
MAX_FILE_COUNT = 500  # extracted files per request
MAX_EXTRACTED_BYTES = 15 * MB  # total text returned per request
MAX_DECOMPRESSED_BYTES = 100 * MB  # total decompression work per archive
MAX_ARCHIVE_ENTRIES = 50_000
MAX_PDF_PAGES = 300
MAX_SHEET_ROWS = 20_000
MAX_YAML_BYTES = 256 * 1024  # YAML normalised for AgentScope (PyYAML parses in pure Python)
MAX_YAML_DEPTH = 64
MAX_SKIPPED_REPORTED = 50
MAX_REDIRECTS = 3
GITHUB_TIMEOUT_SECONDS = 30.0

EXCLUDED_DIRECTORIES: FrozenSet[str] = frozenset({
    "node_modules", ".git", ".svn", ".hg", ".next", ".turbo", ".cache",
    "__pycache__", ".venv", "venv", "bower_components",
})

BINARY_EXTENSIONS: FrozenSet[str] = frozenset({
    # images / media / fonts
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "avif", "tiff", "psd", "heic",
    "mp3", "mp4", "mov", "avi", "mkv", "webm", "wav", "ogg", "flac",
    "woff", "woff2", "ttf", "otf", "eot",
    # archives / packages
    "zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "jar", "war", "whl", "nupkg",
    # executables / compiled objects
    "exe", "dll", "so", "dylib", "bin", "o", "a", "class", "pyc", "pyo", "wasm", "node", "msi", "apk", "ipa",
    # documents / data stores
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "sqlite", "db", "parquet", "pkl",
})

YAML_EXTENSIONS: FrozenSet[str] = frozenset({"yaml", "yml"})

# LaunchGate (and uploads with no product) accept a .zip export or any text file.
_PRODUCT_EXTENSIONS: Dict[ProductType, FrozenSet[str]] = {
    ProductType.AGENTSCOPE: frozenset({"json", "yaml", "yml"}),
    ProductType.EVIDENCE: frozenset({"csv", "xlsx", "pdf", "md", "txt"}),
    ProductType.EVALKIT: frozenset({"txt", "md", "json", "yaml", "yml"}),
}

_GITHUB_WEB_HOSTS: FrozenSet[str] = frozenset({"github.com", "www.github.com"})
_GITHUB_DOWNLOAD_HOSTS: FrozenSet[str] = frozenset({"github.com", "codeload.github.com"})
_OWNER_RE: Pattern[str] = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{0,38}$")
_REPO_RE: Pattern[str] = re.compile(r"^[A-Za-z0-9._-]{1,100}$")
_REF_RE: Pattern[str] = re.compile(r"^[A-Za-z0-9._/-]{1,200}$")
_DRIVE_LETTER_RE: Pattern[str] = re.compile(r"^[A-Za-z]:")
_REDIRECT_STATUSES: FrozenSet[int] = frozenset({301, 302, 303, 307, 308})


class IngestError(Exception):
    """An ingestion failure that maps to an HTTP status and a client-safe message."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _format_bytes(limit: int) -> str:
    return f"{limit // MB} MB" if limit >= MB else f"{limit} bytes"


def _extension(path: str) -> str:
    return PurePosixPath(path).suffix.lower().lstrip(".")


def _in_excluded_directory(path: str) -> bool:
    return any(part in EXCLUDED_DIRECTORIES for part in path.split("/")[:-1])


def decode_text(data: bytes) -> Optional[str]:
    """Decode UTF-8 (or BOM-marked UTF-16) text; return ``None`` for binary content."""
    if data[:2] in (b"\xff\xfe", b"\xfe\xff"):
        try:
            return data.decode("utf-16")
        except UnicodeDecodeError:
            return None
    if b"\x00" in data:
        return None
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None


def sanitize_archive_path(name: str) -> str:
    """Normalise an archive member path.

    Raises:
        IngestError: if the path is absolute or traverses upward (zip-slip).
    """
    normalised = name.replace("\\", "/")
    if "\x00" in normalised or normalised.startswith("/") or _DRIVE_LETTER_RE.match(normalised):
        raise IngestError(400, "Archive rejected: it contains an unsafe absolute path.")
    parts = [part for part in normalised.split("/") if part not in ("", ".")]
    if ".." in parts:
        raise IngestError(400, "Archive rejected: it contains an unsafe path (directory traversal).")
    return "/".join(parts)


def safe_upload_name(filename: str) -> str:
    """Reduce a client-supplied filename to a bare, printable basename."""
    base = PurePosixPath(filename.replace("\\", "/")).name
    cleaned = "".join(char for char in base if char.isprintable()).strip()
    return cleaned[:255] if cleaned not in ("", ".", "..") else "upload"


class IngestCollector:
    """Accumulates extracted files while enforcing count and size limits."""

    def __init__(self) -> None:
        self.files: List[ScanInputFile] = []
        self.skipped: List[IngestSkippedFile] = []
        self.skipped_count = 0
        self.total_bytes = 0
        self.decompressed_bytes = 0
        self.truncated = False

    def skip(self, path: str, reason: str) -> None:
        """Record a skipped entry (only a bounded sample is kept for the response)."""
        self.skipped_count += 1
        if len(self.skipped) < MAX_SKIPPED_REPORTED:
            self.skipped.append(IngestSkippedFile(path=path, reason=reason))

    def accepts(self, path: str, declared_size: Optional[int]) -> bool:
        """Checks that need no file data. Returns ``False`` after recording the skip."""
        if _in_excluded_directory(path):
            self.skip(path, "excluded_directory")
        elif _extension(path) in BINARY_EXTENSIONS:
            self.skip(path, "binary")
        elif len(self.files) >= MAX_FILE_COUNT:
            self.truncated = True
            self.skip(path, "file_limit")
        elif declared_size is not None and declared_size > MAX_FILE_BYTES:
            self.skip(path, "too_large")
        else:
            return True
        return False

    def count_decompressed(self, size: int) -> None:
        """Track decompression work and abort archives that expand too far."""
        self.decompressed_bytes += size
        if self.decompressed_bytes > MAX_DECOMPRESSED_BYTES:
            raise IngestError(413, "Archive rejected: it expands beyond the decompression limit.")

    def add_member(self, path: str, payload: bytes) -> None:
        """Add an archive member read with a ``MAX_FILE_BYTES + 1`` bounded read."""
        if len(payload) > MAX_FILE_BYTES:
            self.skip(path, "too_large")
            return
        text = decode_text(payload)
        if text is None:
            self.skip(path, "binary")
            return
        self.add_text(path, text, _extension(path) or "text")

    def add_text(self, path: str, text: str, file_type: str) -> None:
        """Add decoded text, respecting the file-count and total-size limits."""
        if len(self.files) >= MAX_FILE_COUNT:
            self.truncated = True
            self.skip(path, "file_limit")
            return
        size = len(text.encode("utf-8"))
        if self.total_bytes + size > MAX_EXTRACTED_BYTES:
            self.truncated = True
            self.skip(path, "size_limit")
            return
        self.files.append(ScanInputFile(filename=path, content=text, file_type=file_type))
        self.total_bytes += size

    def to_response(self, source: str) -> IngestResponse:
        """Build the API response."""
        return IngestResponse(
            source=source,
            files=self.files,
            skipped=self.skipped,
            skipped_count=self.skipped_count,
            total_bytes=self.total_bytes,
            truncated=self.truncated,
        )


# --- Archives ---------------------------------------------------------------

def extract_zip(data: bytes, collector: IngestCollector) -> None:
    """Read text files out of a ZIP archive held in memory.

    Raises:
        IngestError: 400 for corrupt archives or unsafe member paths, 413 when the
            archive has too many entries or expands beyond the decompression limit.
    """
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise IngestError(400, "Invalid or corrupt ZIP archive.") from exc

    with archive:
        members = archive.infolist()
        if len(members) > MAX_ARCHIVE_ENTRIES:
            raise IngestError(413, "Archive rejected: it contains too many entries.")
        # Validate every path before reading any data: one unsafe entry rejects the archive.
        paths = [sanitize_archive_path(member.filename) for member in members]

        for member, path in zip(members, paths):
            if member.is_dir() or not path:
                continue
            if stat.S_ISLNK(member.external_attr >> 16):
                collector.skip(path, "not_a_regular_file")
                continue
            if member.flag_bits & 0x1:
                collector.skip(path, "encrypted")
                continue
            if not collector.accepts(path, member.file_size):
                continue
            try:
                with archive.open(member) as handle:
                    payload = handle.read(MAX_FILE_BYTES + 1)
            except (zipfile.BadZipFile, zlib.error, EOFError, OSError, RuntimeError, NotImplementedError) as exc:
                raise IngestError(400, "Invalid or corrupt ZIP archive.") from exc
            collector.count_decompressed(len(payload))
            collector.add_member(path, payload)


class _BoundedReader:
    """File-like wrapper that aborts once more than the allowed bytes are read."""

    def __init__(self, raw: BinaryIO) -> None:
        self._raw = raw
        self._count = 0

    def read(self, size: int = -1) -> bytes:
        chunk = self._raw.read(size)
        self._count += len(chunk)
        if self._count > MAX_DECOMPRESSED_BYTES:
            raise IngestError(413, "Archive rejected: it expands beyond the decompression limit.")
        return chunk


def extract_tar_gz(
    data: bytes, collector: IngestCollector, *, strip_root: bool, corrupt_status: int = 400
) -> None:
    """Read text files out of a gzip-compressed tarball held in memory.

    The tarball is streamed sequentially through a bounded reader, so a gzip bomb
    is cut off after ``MAX_DECOMPRESSED_BYTES``. Only regular files are read;
    symlinks, hardlinks, and device nodes are skipped.

    Args:
        strip_root: Drop the first path component (GitHub archives wrap the repo
            in a ``<repo>-<sha>/`` directory).
        corrupt_status: HTTP status to report when the archive itself is invalid.
    """
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as gz:
            with tarfile.open(fileobj=_BoundedReader(gz), mode="r|") as archive:  # type: ignore[call-overload]
                entries = 0
                for member in archive:
                    entries += 1
                    if entries > MAX_ARCHIVE_ENTRIES:
                        raise IngestError(413, "Archive rejected: it contains too many entries.")
                    path = sanitize_archive_path(member.name)
                    if strip_root:
                        path = path.partition("/")[2]
                    if member.isdir() or not path:
                        continue
                    if not member.isfile():
                        collector.skip(path, "not_a_regular_file")
                        continue
                    if not collector.accepts(path, member.size):
                        continue
                    handle = archive.extractfile(member)
                    if handle is None:
                        continue
                    collector.add_member(path, handle.read(MAX_FILE_BYTES + 1))
    except (tarfile.TarError, zlib.error, EOFError, OSError) as exc:
        raise IngestError(corrupt_status, "Invalid or corrupt archive.") from exc


# --- Documents --------------------------------------------------------------

class _BoundedSafeLoader(yaml.SafeLoader):
    """Safe YAML loader that rejects aliases and deep nesting while it composes.

    Aliases can expand exponentially once serialised, and deeply nested flow
    collections make the pure-Python parser very slow; both are refused as soon as
    they are seen, in the same single pass that loads the document.
    """

    def __init__(self, stream: str) -> None:
        super().__init__(stream)
        self._depth = 0

    def compose_node(self, parent: Any, index: Any) -> Any:
        if self.check_event(yaml.events.AliasEvent):
            raise IngestError(400, "YAML aliases are not supported.")
        self._depth += 1
        try:
            if self._depth > MAX_YAML_DEPTH:
                raise IngestError(400, "YAML document is nested too deeply.")
            return super().compose_node(parent, index)
        finally:
            self._depth -= 1


def normalise_yaml_to_json(text: str) -> str:
    """Parse YAML safely and render it as JSON for the AgentScope rule pack.

    Uses a safe loader (no object construction). Input size and nesting depth are
    capped because PyYAML parses in pure Python and a large document would
    otherwise hold a worker for many seconds.

    Raises:
        IngestError: 413 if the document exceeds ``MAX_YAML_BYTES``; 400 for invalid
            YAML, aliases, excessive nesting, or structures JSON cannot hold.
    """
    if len(text.encode("utf-8")) > MAX_YAML_BYTES:
        raise IngestError(413, f"YAML configs are limited to {MAX_YAML_BYTES // 1024} KB.")
    try:
        documents = list(yaml.load_all(text, Loader=_BoundedSafeLoader))
        parsed = documents[0] if len(documents) == 1 else documents
        return json.dumps(parsed, indent=2, default=str)
    except (yaml.YAMLError, TypeError, ValueError, RecursionError) as exc:
        raise IngestError(400, "Invalid YAML document.") from exc


def xlsx_to_text(data: bytes) -> str:
    """Convert a workbook to CSV-style text (one section per sheet).

    Raises:
        IngestError: 400 for corrupt workbooks, 413 if the workbook would expand
            beyond the decompression limit.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as container:
            declared = sum(info.file_size for info in container.infolist())
    except zipfile.BadZipFile as exc:
        raise IngestError(400, "Invalid or corrupt XLSX workbook.") from exc
    if declared > MAX_DECOMPRESSED_BYTES:
        raise IngestError(413, "Workbook rejected: it expands beyond the decompression limit.")

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    rows = 0
    try:
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        try:
            for sheet in workbook.worksheets:
                output.write(f"# Sheet: {sheet.title}\n")
                for row in sheet.iter_rows(values_only=True):
                    cells = ["" if cell is None else str(cell) for cell in row]
                    while cells and not cells[-1].strip():
                        cells.pop()
                    if not cells:
                        continue
                    writer.writerow(cells)
                    rows += 1
                    if rows >= MAX_SHEET_ROWS or output.tell() > MAX_EXTRACTED_BYTES:
                        return output.getvalue()
        finally:
            workbook.close()
    except (InvalidFileException, zipfile.BadZipFile, XmlParseError, KeyError, ValueError, TypeError, OSError) as exc:
        raise IngestError(400, "Invalid or corrupt XLSX workbook.") from exc
    return output.getvalue()


def pdf_to_text(data: bytes) -> str:
    """Extract text from a PDF, one ``[Page N]`` section per page.

    Raises:
        IngestError: 400 if the PDF is encrypted, corrupt, or cannot be parsed.
    """
    sections: List[str] = []
    size = 0
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise IngestError(400, "Encrypted PDFs are not supported.")
        for number, page in enumerate(reader.pages, start=1):
            if number > MAX_PDF_PAGES or size > MAX_EXTRACTED_BYTES:
                break
            section = f"[Page {number}]\n{(page.extract_text() or '').strip()}"
            sections.append(section)
            size += len(section)
    except (
        PyPdfError, DependencyError, zlib.error, ValueError, KeyError, TypeError,
        IndexError, AttributeError, RecursionError, OSError,
    ) as exc:
        raise IngestError(400, "Could not read PDF document.") from exc
    return "\n\n".join(sections) + "\n"


def _document_type(extension: str, product: Optional[ProductType]) -> str:
    """Classify an uploaded document for the rule packs."""
    if extension in ("csv", "xlsx") and product in (None, ProductType.EVIDENCE):
        return "questionnaire"
    if extension == "pdf" or (extension in ("md", "txt") and product == ProductType.EVIDENCE):
        return "policy_doc"
    if extension in YAML_EXTENSIONS:
        return "yaml"
    return extension or "text"


def ingest_file(
    filename: str, data: bytes, product: Optional[ProductType], collector: IngestCollector
) -> None:
    """Ingest one uploaded file into ``collector``.

    Raises:
        IngestError: 415 for unsupported or binary files, 400/413 for invalid or
            oversized content.
    """
    name = safe_upload_name(filename)
    extension = _extension(name)

    allowed = _PRODUCT_EXTENSIONS.get(product) if product is not None else None
    if allowed is not None and extension not in allowed:
        supported = ", ".join(f".{item}" for item in sorted(allowed))
        raise IngestError(415, f"Unsupported file type for {product.value}. Supported: {supported}.")

    if extension == "zip":
        extract_zip(data, collector)
        return
    if extension == "xlsx":
        collector.add_text(name, xlsx_to_text(data), _document_type(extension, product))
        return
    if extension == "pdf":
        collector.add_text(name, pdf_to_text(data), _document_type(extension, product))
        return
    if extension in BINARY_EXTENSIONS:
        raise IngestError(415, "Binary files are not supported.")

    text = decode_text(data)
    if text is None:
        raise IngestError(415, "Binary or non-UTF-8 files are not supported.")
    if extension in YAML_EXTENSIONS and product == ProductType.AGENTSCOPE:
        text = normalise_yaml_to_json(text)
    collector.add_text(name, text, _document_type(extension, product))


# --- GitHub -----------------------------------------------------------------

def parse_github_repo_url(repo_url: str) -> Tuple[str, str, Optional[str]]:
    """Validate a GitHub repository URL and return ``(owner, repo, ref_from_url)``.

    Only ``https://github.com/<owner>/<repo>`` (optionally ``/tree/<ref>``) is
    accepted. The URL itself is never fetched.

    Raises:
        IngestError: 400 for anything else.
    """
    invalid = IngestError(400, "Only public https://github.com/<owner>/<repo> URLs are supported.")
    if len(repo_url) > 500:
        raise invalid
    try:
        parts = urlsplit(repo_url.strip())
        port = parts.port
    except ValueError as exc:
        raise invalid from exc
    if (
        parts.scheme != "https"
        or parts.hostname not in _GITHUB_WEB_HOSTS
        or port not in (None, 443)
        or parts.username is not None
        or parts.password is not None
    ):
        raise invalid

    segments = [segment for segment in parts.path.split("/") if segment]
    if len(segments) < 2:
        raise invalid
    owner, repo = segments[0], segments[1]
    if repo.endswith(".git"):
        repo = repo[:-4]
    if not _OWNER_RE.match(owner) or not _REPO_RE.match(repo) or repo in (".", ".."):
        raise invalid

    ref = "/".join(segments[3:]) if len(segments) >= 4 and segments[2] == "tree" else None
    return owner, repo, ref


def validate_github_ref(ref: Optional[str]) -> str:
    """Return a safe git ref (branch, tag, or SHA); ``HEAD`` when none is given.

    Raises:
        IngestError: 400 if the ref contains characters or sequences git refs cannot have.
    """
    if ref is None or not ref.strip():
        return "HEAD"
    candidate = ref.strip()
    if (
        not _REF_RE.match(candidate)
        or ".." in candidate
        or "//" in candidate
        or candidate.startswith(("/", ".", "-"))
        or candidate.endswith(("/", "."))
    ):
        raise IngestError(400, "Invalid branch, tag, or commit reference.")
    return candidate


def _require_github_download_url(url: str) -> None:
    """Refuse to fetch anything but an HTTPS GitHub archive host (SSRF guard for redirects)."""
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as exc:
        raise IngestError(502, "GitHub redirected to an unexpected location.") from exc
    if (
        parts.scheme != "https"
        or parts.hostname not in _GITHUB_DOWNLOAD_HOSTS
        or port not in (None, 443)
        or parts.username is not None
        or parts.password is not None
    ):
        raise IngestError(502, "GitHub redirected to an unexpected location.")


def _read_capped(response: httpx.Response, deadline: float) -> bytes:
    """Stream a response body, aborting at the size cap or deadline."""
    too_large = IngestError(413, f"Repository archive exceeds the {_format_bytes(MAX_UPLOAD_BYTES)} limit.")
    declared = response.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > MAX_UPLOAD_BYTES:
        raise too_large
    buffer = bytearray()
    # iter_bytes() yields transfer-decoded data incrementally, so the cap also bounds
    # a body that a server compresses with Content-Encoding.
    for chunk in response.iter_bytes():
        buffer += chunk
        if len(buffer) > MAX_UPLOAD_BYTES:
            raise too_large
        if time.monotonic() > deadline:
            raise IngestError(504, "Timed out downloading the repository archive.")
    return bytes(buffer)


def fetch_github_archive(owner: str, repo: str, ref: str, client: httpx.Client) -> bytes:
    """Download a public repository tarball with a size cap and restricted redirects.

    Args:
        owner, repo, ref: Already validated by :func:`parse_github_repo_url` and
            :func:`validate_github_ref`.
        client: HTTP client configured with ``follow_redirects=False``.

    Raises:
        IngestError: 404 if the repo/ref is missing or private, 413 if the archive
            is too large, 429 on rate limiting, 502/504 on upstream failures.
    """
    url = f"https://github.com/{owner}/{repo}/archive/{quote(ref, safe='/')}.tar.gz"
    deadline = time.monotonic() + GITHUB_TIMEOUT_SECONDS
    try:
        for _ in range(MAX_REDIRECTS + 1):
            _require_github_download_url(url)
            with client.stream("GET", url) as response:
                if response.status_code in _REDIRECT_STATUSES:
                    location = response.headers.get("location")
                    if not location:
                        raise IngestError(502, "GitHub returned an invalid redirect.")
                    url = urljoin(url, location)
                    continue
                if response.status_code == 404:
                    raise IngestError(404, "Repository or ref not found. Private repositories are not supported.")
                if response.status_code in (403, 429):
                    raise IngestError(429, "GitHub rate limit reached. Try again later.")
                if response.status_code != 200:
                    raise IngestError(502, f"GitHub returned HTTP {response.status_code}.")
                return _read_capped(response, deadline)
    except httpx.HTTPError as exc:
        raise IngestError(502, f"Could not reach GitHub ({type(exc).__name__}).") from exc
    raise IngestError(502, "GitHub redirected too many times.")


def ingest_github(repo_url: str, ref: Optional[str], client: httpx.Client) -> IngestResponse:
    """Fetch a public GitHub repository and return its text files.

    Raises:
        IngestError: see :func:`parse_github_repo_url`, :func:`fetch_github_archive`,
            and :func:`extract_tar_gz`.
    """
    owner, repo, url_ref = parse_github_repo_url(repo_url)
    resolved_ref = validate_github_ref(ref if ref and ref.strip() else url_ref)
    archive = fetch_github_archive(owner, repo, resolved_ref, client)
    collector = IngestCollector()
    extract_tar_gz(archive, collector, strip_root=True, corrupt_status=502)
    return collector.to_response(f"github:{owner}/{repo}@{resolved_ref}")
