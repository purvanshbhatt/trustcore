"""File ingestion endpoints: multipart uploads and public GitHub repositories.

Both endpoints are stateless. Inputs are parsed in memory and returned to the
caller as text files for ``POST /api/v1/run/{product}``; nothing is stored.
"""
import logging
from typing import Iterator, List, Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from app.core import ingestion
from app.core.auth import AuthenticatedUser, get_caller
from app.core.ingestion import IngestCollector, IngestError
from app.core.ratelimit import INGEST_SCOPE, ingest_limit, limiter
from app.core.schemas import GithubIngestRequest, IngestResponse, ProductType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ingest", tags=["ingest"])


def get_github_client() -> Iterator[httpx.Client]:
    """HTTP client for GitHub downloads.

    Redirects are followed manually against a host allow-list, and ``trust_env``
    is off so no proxy settings or ``.netrc`` credentials are ever applied:
    requests are always unauthenticated, which limits fetches to public repos.
    """
    with httpx.Client(
        follow_redirects=False,
        trust_env=False,
        timeout=httpx.Timeout(20.0, connect=5.0),
    ) as client:
        yield client


@router.post("/upload", response_model=IngestResponse)
@limiter.shared_limit(ingest_limit, scope=INGEST_SCOPE)
def ingest_upload(
    request: Request,
    files: List[UploadFile] = File(..., description="One or more files; the whole request is capped at 15 MB"),
    product: Optional[ProductType] = Form(None, description="Restrict accepted file types to one product"),
    user: AuthenticatedUser = Depends(get_caller),
) -> IngestResponse:
    """
    Ingest uploaded files (multipart/form-data, max 15 MB per request).

    Supports `.zip` repo exports (LaunchGate), `.json`/`.yaml` MCP and agent configs
    (AgentScope), `.csv`/`.xlsx` questionnaires and `.pdf`/`.md`/`.txt` policy documents
    (Evidence-to-Answer). Binaries, `node_modules`, and `.git` are skipped; archives
    with path-traversal entries are rejected.
    """
    collector = IngestCollector()
    remaining = ingestion.MAX_UPLOAD_BYTES
    try:
        for upload in files:
            data = upload.file.read(remaining + 1)
            if len(data) > remaining:
                limit_mb = ingestion.MAX_UPLOAD_BYTES // ingestion.MB
                raise IngestError(413, f"Upload exceeds the {limit_mb} MB limit.")
            remaining -= len(data)
            ingestion.ingest_file(upload.filename or "upload", data, product, collector)
    except IngestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    finally:
        for upload in files:
            upload.file.close()

    # Counts only: file names and contents are never logged.
    logger.info(
        "Ingested upload: %d files, %d bytes, %d skipped",
        len(collector.files), collector.total_bytes, collector.skipped_count,
    )
    return collector.to_response("upload")


@router.post("/github", response_model=IngestResponse)
@limiter.shared_limit(ingest_limit, scope=INGEST_SCOPE)
def ingest_github_repository(
    request: Request,
    github_request: GithubIngestRequest,
    user: AuthenticatedUser = Depends(get_caller),
    client: httpx.Client = Depends(get_github_client),
) -> IngestResponse:
    """
    Fetch a public GitHub repository through its archive tarball.

    Only `https://github.com/<owner>/<repo>` URLs are accepted; the download is capped
    at 15 MB and the extracted file count is limited.
    """
    try:
        response = ingestion.ingest_github(github_request.repo_url, github_request.ref, client)
    except IngestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    logger.info(
        "Ingested GitHub archive: %d files, %d bytes, %d skipped",
        len(response.files), response.total_bytes, response.skipped_count,
    )
    return response
