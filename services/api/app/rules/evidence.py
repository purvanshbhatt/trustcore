import re
import uuid
from typing import List, Optional, Dict, Any
from app.core.schemas import (
    ProductType,
    Finding,
    SourceCitation,
    Severity,
    ScanInputFile,
    EvidenceMappingItem
)
from app.rules.base import BaseRulePack, RulePackResult

# Common SOC 2 / ISO 27001 questionnaire requirements
STANDARD_CONTROLS = [
    {
        "qid": "SOC2-CC6.1",
        "question": "How does the organization restrict logical access to customer data and infrastructure?",
        "keywords": ["access control", "least privilege", "mfa", "multi-factor", "role-based access", "rbac"],
        "min_match": 2
    },
    {
        "qid": "SOC2-CC6.6",
        "question": "How are customer data encrypted at rest and in transit across public networks?",
        "keywords": ["encryption", "aes-256", "tls 1.3", "tls 1.2", "at rest", "in transit"],
        "min_match": 2
    },
    {
        "qid": "SOC2-CC7.2",
        "question": "Describe the incident response process and timeline for notifying impacted customers.",
        "keywords": ["incident response", "security incident", "72 hours", "breach notification", "post-mortem"],
        "min_match": 2
    },
    {
        "qid": "SOC2-CC8.1",
        "question": "What change management and code review policies are enforced prior to production deployment?",
        "keywords": ["change management", "pull request", "peer review", "automated testing", "ci/cd pipeline"],
        "min_match": 2
    },
    {
        "qid": "SOC2-A1.2",
        "question": "How often are disaster recovery, failover, and database backup restoration drills tested?",
        "keywords": ["disaster recovery", "backup restoration", "annual drill", "rto", "rpo", "failover test"],
        "min_match": 3
    },
    {
        "qid": "SOC2-CC4.1",
        "question": "Describe the vendor risk management process and third-party security assessment criteria.",
        "keywords": ["vendor risk", "third-party", "annual review", "supplier assessment", "subprocessor"],
        "min_match": 2
    }
]


class EvidenceRulePack(BaseRulePack):
    """
    Evidence-to-Answer: Evidence-cited security questionnaire workbench.
    Deterministically matches questionnaire items against ingested policy text.
    Strictly flags unsupported gaps when no deterministic proof exists.
    """
    product = ProductType.EVIDENCE
    name = "Evidence-to-Answer Deterministic Matcher"

    def run(
        self,
        files: List[ScanInputFile],
        raw_content: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> RulePackResult:
        findings: List[Finding] = []
        citations: List[SourceCitation] = []
        mapping_matrix: List[EvidenceMappingItem] = []

        all_files = list(files)
        if raw_content:
            all_files.append(
                ScanInputFile(
                    filename="policy_evidence.md",
                    content=raw_content
                )
            )

        # Combine all uploaded policy documents for indexing
        policy_corpus = []
        for f in all_files:
            if f.file_type == "questionnaire":
                # Questionnaires state requirements; they are never evidence for them.
                continue
            lines = f.content.splitlines()
            for line_no, line in enumerate(lines, start=1):
                if line.strip():
                    policy_corpus.append({
                        "file": f.filename,
                        "line_no": line_no,
                        "text": line.strip()
                    })

        verified_count = 0
        gap_count = 0

        for ctrl in STANDARD_CONTROLS:
            qid = ctrl["qid"]
            question = ctrl["question"]
            keywords = ctrl["keywords"]
            min_match = ctrl["min_match"]

            # Deterministic scan through policy lines
            best_snippet = None
            best_file = None
            best_line = None
            matched_keywords = []

            for item in policy_corpus:
                line_lower = item["text"].lower()
                matches = [kw for kw in keywords if kw in line_lower]
                if len(matches) > len(matched_keywords):
                    matched_keywords = matches
                    best_snippet = item["text"]
                    best_file = item["file"]
                    best_line = item["line_no"]

            # Evaluate whether sufficient deterministic evidence exists
            if best_snippet and len(matched_keywords) >= min_match:
                citation = SourceCitation(
                    file_path=best_file,
                    line_start=best_line,
                    line_end=best_line,
                    section_title=f"Policy Section (Line {best_line})",
                    snippet=best_snippet,
                    source_type="policy_doc"
                )
                citations.append(citation)

                mapping_matrix.append(
                    EvidenceMappingItem(
                        id=f"EV-MAP-{qid}",
                        question_id=qid,
                        question=question,
                        status="VERIFIED_EVIDENCE",
                        answer=f"Verified in policy: \"{best_snippet}\" (Matched: {', '.join(matched_keywords)}).",
                        confidence_score=round(min(1.0, 0.7 + (len(matched_keywords) * 0.1)), 2),
                        citation=citation,
                        gap_reason=None
                    )
                )
                verified_count += 1
            else:
                # EVIDENCE GAP DETECTED
                gap_reason = f"No deterministic evidence found containing required controls: {', '.join(keywords)}."
                mapping_matrix.append(
                    EvidenceMappingItem(
                        id=f"EV-MAP-{qid}",
                        question_id=qid,
                        question=question,
                        status="UNSUPPORTED_GAP",
                        answer="UNSUPPORTED: Insufficient documentation in uploaded policy repository.",
                        confidence_score=0.0,
                        citation=None,
                        gap_reason=gap_reason
                    )
                )
                gap_count += 1

                # Register as a formal Finding to prevent hallucinated compliance
                dummy_citation = SourceCitation(
                    file_path=all_files[0].filename if all_files else "policies/",
                    line_start=1,
                    line_end=1,
                    section_title="Missing Policy Clause",
                    snippet=f"Missing: Documentation for {qid} ({question})",
                    source_type="questionnaire"
                )
                citations.append(dummy_citation)

                findings.append(
                    Finding(
                        id=f"FND-EV-GAP-{qid}",
                        rule_id="EV-GAP-001",
                        product=ProductType.EVIDENCE,
                        title=f"Compliance Evidence Gap: {qid}",
                        description=f"Questionnaire requirement '{question}' cannot be substantiated from current evidence. {gap_reason}",
                        severity=Severity.HIGH,
                        category="Evidence Gap",
                        citation=dummy_citation,
                        impact="Submitting unverified or missing answers to enterprise auditors risks failing SOC 2 certification or customer vendor review.",
                        metadata={"question_id": qid, "required_controls": keywords}
                    )
                )

        total_controls = len(STANDARD_CONTROLS)
        coverage_rate = int((verified_count / total_controls) * 100) if total_controls > 0 else 0

        return RulePackResult(
            findings=findings,
            citations=citations,
            evidence_matrix=mapping_matrix,
            metadata={
                "coverage_rate": coverage_rate,
                "verified_controls": verified_count,
                "unsupported_gaps": gap_count,
                "total_questions": total_controls
            }
        )
