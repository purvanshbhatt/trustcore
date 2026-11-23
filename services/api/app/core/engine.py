import uuid
import datetime
import logging
from typing import Dict, Any, Optional
from app.core.schemas import (
    ProductType,
    ScanRequest,
    Report,
    ReportSummary,
    ReadinessStatus,
    Severity
)
from app.core.storage import get_storage
from app.core.explainer import LLMExplainer
from app.rules.base import BaseRulePack
from app.rules.launchgate import LaunchGateRulePack
from app.rules.agentscope import AgentScopeRulePack
from app.rules.evidence import EvidenceRulePack
from app.rules.evalkit import EvalKitRulePack

logger = logging.getLogger(__name__)


class TrustCoreEngine:
    """
    Dual-Engine Orchestrator:
    - Step 1: Ingest input payloads
    - Step 2: Route to deterministic RulePack (Engine 1)
    - Step 3: Compute deterministic findings, citations, metrics, and risk scores
    - Step 4: Route findings to LLM Explainer (Engine 2) for plain-English synthesis & prompts
    - Step 5: Store report & return structured JSON
    """

    def __init__(self):
        self.rule_packs: Dict[ProductType, BaseRulePack] = {
            ProductType.LAUNCHGATE: LaunchGateRulePack(),
            ProductType.AGENTSCOPE: AgentScopeRulePack(),
            ProductType.EVIDENCE: EvidenceRulePack(),
            ProductType.EVALKIT: EvalKitRulePack()
        }
        self.explainer = LLMExplainer()
        self.storage = get_storage()

    def run_scan(self, req: ScanRequest) -> Report:
        logger.info(f"[Engine] Starting scan for product={req.product.value}, project={req.project_name}")

        rule_pack = self.rule_packs.get(req.product)
        if not rule_pack:
            raise ValueError(f"Unsupported product type: {req.product}")

        # ENGINE 1: Deterministic Rule Execution
        rule_result = rule_pack.run(
            files=req.files,
            raw_content=req.raw_content,
            options=req.options
        )

        findings = rule_result.findings
        citations = rule_result.citations

        # Compute deterministic score and severity counts
        critical_count = sum(1 for f in findings if f.severity == Severity.CRITICAL)
        high_count = sum(1 for f in findings if f.severity == Severity.HIGH)
        medium_count = sum(1 for f in findings if f.severity == Severity.MEDIUM)
        low_count = sum(1 for f in findings if f.severity == Severity.LOW)
        info_count = sum(1 for f in findings if f.severity == Severity.INFO)

        # Risk score formula: 100 minus weighted penalties
        penalty = (critical_count * 25) + (high_count * 15) + (medium_count * 8) + (low_count * 3)
        risk_score = max(0, min(100, 100 - penalty))

        # Determine readiness gate status
        if critical_count > 0 or risk_score < 50:
            status = ReadinessStatus.BLOCKED
        elif high_count > 0 or risk_score < 80:
            status = ReadinessStatus.WARNING
        else:
            status = ReadinessStatus.PASSED

        summary = ReportSummary(
            total_findings=len(findings),
            critical_count=critical_count,
            high_count=high_count,
            medium_count=medium_count,
            low_count=low_count,
            info_count=info_count,
            risk_score=risk_score,
            readiness_status=status
        )

        # ENGINE 2: LLM Explanation Layer (Strictly takes verified findings, never hallucinates)
        exec_summary, remediation_prompts = self.explainer.explain(
            product=req.product,
            summary=summary,
            findings=findings,
            metadata=rule_result.metadata
        )

        # Build full report
        report_id = f"rpt_{req.product.value[:3]}_{uuid.uuid4().hex[:8]}"
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        report = Report(
            id=report_id,
            product=req.product,
            title=f"{req.project_name} — {rule_pack.name}",
            created_at=created_at,
            summary=summary,
            findings=findings,
            executive_summary=exec_summary,
            remediation_prompts=remediation_prompts,
            permission_diff=rule_result.permission_diff,
            evidence_matrix=rule_result.evidence_matrix,
            eval_results=rule_result.eval_results,
            metadata={
                **rule_result.metadata,
                "project_name": req.project_name,
                "engine_version": "1.0.0-dual-core"
            }
        )

        # Save report
        self.storage.save_report(report)
        logger.info(f"[Engine] Scan completed successfully. Report ID: {report.id}")
        return report


_engine_instance: Optional[TrustCoreEngine] = None


def get_engine() -> TrustCoreEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = TrustCoreEngine()
    return _engine_instance
