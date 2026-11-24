"""Free preview: the subset of a report shown before payment.

The cut is made on the server, so locked content never reaches an unpaid client:
a preview keeps the overall score and counts and the top findings, and withholds
exact citations, remediation prompts, and the per-product detail views.
"""
from __future__ import annotations

import re
from typing import List

from app.core.schemas import Finding, Report, Severity, SourceCitation

PREVIEW_FINDINGS = 2
_MASKED_VALUE = re.compile(r"\S*\*{4}\S*")
LOCKED_FEATURES: List[str] = ["citations", "remediation_prompts", "exports", "detail_views"]
_SEVERITY_RANK = {severity: rank for rank, severity in enumerate(
    (Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO)
)}


def _teaser(finding: Finding) -> Finding:
    """A finding with its location evidence removed: file path only, no line or snippet."""
    return finding.model_copy(
        update={
            # Masked secret fragments ("sk-p****2c1d") are part of the evidence too.
            "description": _MASKED_VALUE.sub("****", finding.description),
            "citation": SourceCitation(
                file_path=finding.citation.file_path,
                snippet="",
                source_type=finding.citation.source_type,
            ),
            "remediation_prompt": None,
            "metadata": {},
        }
    )


def build_preview(report: Report) -> Report:
    """Return the free-preview view of ``report`` (the original is not modified)."""
    ranked = sorted(report.findings, key=lambda finding: _SEVERITY_RANK[finding.severity])  # stable
    visible = [_teaser(finding) for finding in ranked[:PREVIEW_FINDINGS]]
    return report.model_copy(
        update={
            "findings": visible,
            "remediation_prompts": [],
            "permission_diff": None,
            "evidence_matrix": None,
            "eval_results": None,
            "metadata": {
                **report.metadata,
                "access": "preview",
                "locked": {
                    "hidden_findings": max(0, len(report.findings) - len(visible)),
                    "features": list(LOCKED_FEATURES),
                },
            },
        }
    )
