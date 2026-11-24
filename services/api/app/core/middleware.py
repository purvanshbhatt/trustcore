"""ASGI middleware enforcing request body size limits.

A declared ``Content-Length`` above the limit is rejected before any body is
read. Bodies without a trustworthy length (chunked uploads) are counted as they
stream in and cut off once they exceed the limit, so an oversized upload is
never buffered or spooled in full.
"""
from __future__ import annotations

import json
from typing import Dict, Optional

from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_TOO_LARGE = 413


class BodySizeLimitMiddleware:
    """Reject request bodies larger than a per-route byte limit with HTTP 413."""

    def __init__(self, app: ASGIApp, default_limit: int, route_limits: Optional[Dict[str, int]] = None) -> None:
        """
        Args:
            app: The wrapped ASGI application.
            default_limit: Maximum body size in bytes for routes without an override.
            route_limits: Path-prefix to byte-limit overrides; the longest prefix wins.
        """
        self.app = app
        self.default_limit = default_limit
        self.route_limits = sorted((route_limits or {}).items(), key=lambda item: len(item[0]), reverse=True)

    def _limit_for(self, path: str) -> int:
        for prefix, limit in self.route_limits:
            if path.startswith(prefix):
                return limit
        return self.default_limit

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = self._limit_for(scope.get("path", ""))
        detail = f"Request body exceeds the {limit} byte limit."

        declared = _declared_length(scope)
        if declared is not None and declared > limit:
            await _send_too_large(send, detail)
            return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    # An HTTPException passes through FastAPI's body parsing untouched
                    # and is rendered by its exception handlers.
                    raise HTTPException(status_code=_TOO_LARGE, detail=detail)
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except HTTPException as exc:
            if exc.status_code != _TOO_LARGE or response_started:
                raise
            await _send_too_large(send, detail)


def _declared_length(scope: Scope) -> Optional[int]:
    """Return the request's Content-Length, or ``None`` if absent or malformed."""
    for name, value in scope.get("headers", []):
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


async def _send_too_large(send: Send, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": _TOO_LARGE,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode("ascii")),
                (b"connection", b"close"),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
