"""Secret redaction.

TrustCore must never store, return, or log a live customer credential. Rule
packs pass every source line through :func:`safe_snippet` before it becomes a
``SourceCitation``; the engine then runs :func:`redact_report` as a final
defence-in-depth pass before a report is returned or persisted.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING, FrozenSet, Match, Pattern, Tuple

if TYPE_CHECKING:
    from app.core.schemas import Report

MASK = "****"
MAX_SNIPPET_CHARS = 500
# safe_snippet() redacts at most this much of a line (the visible part plus room for
# a secret that starts inside it), which bounds the work per citation.
_SNIPPET_WINDOW_CHARS = MAX_SNIPPET_CHARS + 4096
# Characters that cannot occur inside a credential; used to drop a value cut by the window.
_VALUE_DELIMITERS = " \t\r\n\"'`,;()[]{}<>:="

# Every pattern below must run in linear time on hostile input: a scan line is
# attacker-controlled and can be megabytes long. The rules that keep them linear:
# a lookbehind pins each pattern to the start of a token so it is tried once per
# run of characters, and no unbounded quantifier is followed by another one that
# can match the same characters.

# High-precision credential formats. Safe to apply to any text, including prose.
_TOKEN_PATTERNS: Tuple[Pattern[str], ...] = tuple(
    re.compile(pattern)
    for pattern in (
        # JWT (Supabase keys, sessions)
        r"(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{2,}",
        r"\bsk-[A-Za-z0-9_-]{16,}",  # OpenAI / Anthropic
        r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}",  # Stripe secret / restricted keys
        r"\bwhsec_[A-Za-z0-9]{10,}",  # Stripe webhook secret
        r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b",  # AWS access key ID
        r"\bgh[pousr]_[A-Za-z0-9]{20,}",  # GitHub tokens
        r"\bgithub_pat_[A-Za-z0-9_]{20,}",  # GitHub fine-grained PAT
        r"\bxox[abprs]-[A-Za-z0-9-]{10,}",  # Slack tokens
        r"\bAIza[0-9A-Za-z_-]{35}",  # Google API key
        r"\bsbp_[a-f0-9]{40}",  # Supabase personal access token
        r"\bkey-[A-Za-z0-9]{20,}",  # Generic "key-" prefixed API keys
    )
)

_BEARER: Pattern[str] = re.compile(r"(?i)\b(Bearer\s{1,8})([A-Za-z0-9._~+/=-]{16,})")
_URL_CREDENTIALS: Pattern[str] = re.compile(
    r"(?<![A-Za-z0-9+.\-])([A-Za-z][A-Za-z0-9+.\-]{0,30}://[^\s:/@]{1,256}:)([^\s@/]{3,})(@)"
)

# Heuristic "<secret-looking name> = <value>" assignments (code, .env, JSON, YAML).
_SECRET_NAME = (
    r"(?:secret|token|passw(?:or)?d|passphrase|pwd|api[_-]?key|apikey|access[_-]?key"
    r"|private[_-]?key|service[_-]?role|credential)"
)
_IDENT = r"[A-Za-z0-9_.\-]"
# An identifier (at most 128 chars, tried only at its first character) whose first
# ~130 characters contain a secret-looking word. The bounded lookahead does the
# search so the identifier itself is matched without backtracking into the word.
_KEY = rf"(?<!{_IDENT})[\"'`]?(?={_IDENT}{{0,120}}?{_SECRET_NAME}){_IDENT}{{1,128}}[\"'`]?"
_SEPARATOR = r"\s{0,8}[:=]\s{0,8}"
# The value runs to the closing quote, or to the end of the text when the quote is
# never closed (a string continued on the next line, or a line cut for length).
_ASSIGN_QUOTED: Pattern[str] = re.compile(rf"(?i)({_KEY}{_SEPARATOR})([\"'`])((?:(?!\2).)+)(\2|$)")
_ASSIGN_BARE: Pattern[str] = re.compile(rf"(?i)({_KEY}{_SEPARATOR})([^\s\"'`,;{{}}()\[\]<>]+)")

_REFERENCE_PREFIXES: Tuple[str, ...] = (
    "${", "$(", "{{", "<", "process.env", "import.meta.env", "os.environ", "os.getenv",
    "env(", "ENV[", "System.getenv", "secrets.", "vault:",
)
_NON_SECRET_WORDS: FrozenSet[str] = frozenset({
    "true", "false", "null", "none", "undefined", "nil", "string", "str", "int", "integer",
    "bool", "boolean", "number", "float", "bytes", "any", "unknown", "object", "optional",
    "required", "text", "varchar", "uuid",
})
_DOTTED_IDENTIFIER: Pattern[str] = re.compile(r"^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$")
_LINE_START_PREFIXES: FrozenSet[str] = frozenset({"", "-", "export"})
_LINE_START_SCAN_CHARS = 16


def mask_secret(value: str) -> str:
    """Mask a secret, revealing at most its first 4 and last 4 characters.

    Short values reveal less (or nothing) so the mask never exposes most of a secret.
    """
    length = len(value)
    if length >= 16:
        return f"{value[:4]}{MASK}{value[-4:]}"
    if length >= 8:
        return f"{value[:2]}{MASK}{value[-2:]}"
    return MASK


def _is_exempt(value: str) -> bool:
    """True when an assigned value is a reference or placeholder, not a literal secret."""
    stripped = value.strip()
    if not stripped or MASK in stripped:
        return True
    if stripped.lower() in _NON_SECRET_WORDS:
        return True
    if stripped.replace(".", "", 1).isdigit():
        return True
    if stripped.startswith(_REFERENCE_PREFIXES):
        return True
    return bool(_DOTTED_IDENTIFIER.match(stripped))


def _looks_literal(value: str) -> bool:
    """Heuristic for an inline unquoted value that is a literal rather than a variable name."""
    return len(value) >= 24 or (len(value) >= 8 and any(char.isdigit() for char in value))


def _mask_whole(match: Match[str]) -> str:
    return mask_secret(match.group(0))


def _mask_middle(match: Match[str]) -> str:
    groups = match.groups()
    suffix = groups[2] if len(groups) > 2 else ""
    return f"{groups[0]}{mask_secret(groups[1])}{suffix}"


def _mask_quoted_assignment(match: Match[str]) -> str:
    prefix, quote, value, closing = match.group(1), match.group(2), match.group(3), match.group(4)
    if _is_exempt(value):
        return match.group(0)
    return f"{prefix}{quote}{mask_secret(value)}{closing}"


def _mask_bare_assignment(match: Match[str]) -> str:
    value = match.group(2)
    if _is_exempt(value):
        return match.group(0)
    following = match.string[match.end():match.end() + 1]
    if following in ("(", "["):
        return match.group(0)  # function call or index expression, not a literal
    # Only a short prefix can make this a line-start assignment; never copy the whole line.
    at_line_start = (
        match.start() <= _LINE_START_SCAN_CHARS
        and match.string[:match.start()].strip() in _LINE_START_PREFIXES
    )
    if not at_line_start and not _looks_literal(value):
        return match.group(0)  # inline code such as ``Client(api_key=key)``
    return f"{match.group(1)}{mask_secret(value)}"


def redact_secrets(text: str, *, include_assignments: bool = True) -> str:
    """Return ``text`` with detected secret values masked.

    Args:
        text: A single source line or free text.
        include_assignments: Also mask values assigned to secret-looking names
            (``PASSWORD=...``, ``"api_key": "..."``). Disable for prose, where only
            the high-precision credential formats should apply.

    The function is idempotent: redacting already-redacted text is a no-op.
    """
    if not text:
        return text
    redacted = text
    for pattern in _TOKEN_PATTERNS:
        redacted = pattern.sub(_mask_whole, redacted)
    redacted = _BEARER.sub(_mask_middle, redacted)
    redacted = _URL_CREDENTIALS.sub(_mask_middle, redacted)
    if include_assignments:
        redacted = _ASSIGN_QUOTED.sub(_mask_quoted_assignment, redacted)
        redacted = _ASSIGN_BARE.sub(_mask_bare_assignment, redacted)
    return redacted


def safe_snippet(line: str, max_chars: int = MAX_SNIPPET_CHARS) -> str:
    """Build a citation snippet from a source line: redact first, then bound its length.

    Only a bounded window of the line is processed, so one enormous line cannot
    stall a scan. When the window cuts the line, everything after the last
    delimiter is dropped before redaction: a value split by the cut is removed
    whole rather than shown as an unrecognisable, unmasked fragment.
    """
    text = line.strip()
    clipped = len(text) > _SNIPPET_WINDOW_CHARS
    if clipped:
        text = text[:_SNIPPET_WINDOW_CHARS]
        last_delimiter = max(text.rfind(char) for char in _VALUE_DELIMITERS)
        text = text[:last_delimiter + 1]
    redacted = redact_secrets(text)
    if clipped or len(redacted) > max_chars:
        return redacted[:max_chars] + "..."
    return redacted


def redact_report(report: "Report") -> "Report":
    """Final pass over a report: mask any credential that survived rule-level redaction.

    Uses only the high-precision credential formats so policy prose and evaluation
    transcripts are not distorted. Mutates and returns ``report``.
    """
    def clean(value: str) -> str:
        return redact_secrets(value, include_assignments=False)

    report.executive_summary = clean(report.executive_summary)
    for finding in report.findings:
        finding.description = clean(finding.description)
        finding.citation.snippet = clean(finding.citation.snippet)
        if finding.remediation_prompt is not None:
            finding.remediation_prompt.prompt_text = clean(finding.remediation_prompt.prompt_text)
    for prompt in report.remediation_prompts:
        prompt.prompt_text = clean(prompt.prompt_text)
    for item in report.evidence_matrix or []:
        item.answer = clean(item.answer)
        if item.citation is not None:
            item.citation.snippet = clean(item.citation.snippet)
    return report
