import re
import uuid
from typing import List, Optional, Dict, Any
from app.core.schemas import (
    ProductType,
    Finding,
    SourceCitation,
    Severity,
    ScanInputFile
)
from app.rules.base import BaseRulePack, RulePackResult

# Deterministic regex patterns for leaked secrets
SECRET_PATTERNS = [
    {
        "rule_id": "LG-SEC-001",
        "title": "Hardcoded OpenAI API Key Detected",
        "regex": r"(sk-[a-zA-Z0-9]{20,48}|sk-proj-[a-zA-Z0-9-_]{40,100})",
        "severity": Severity.CRITICAL,
        "category": "Secret Leak",
        "impact": "Unrestricted billing usage, potential fine-tuning data exfiltration, and API quota burnout."
    },
    {
        "rule_id": "LG-SEC-002",
        "title": "Hardcoded Anthropic API Key Detected",
        "regex": r"(sk-ant-[a-zA-Z0-9-_]{40,100})",
        "severity": Severity.CRITICAL,
        "category": "Secret Leak",
        "impact": "Direct access to Claude API endpoints without rate limiting or spending caps."
    },
    {
        "rule_id": "LG-SEC-003",
        "title": "Hardcoded Stripe Secret Key Detected",
        "regex": r"(sk_live_[a-zA-Z0-9]{24,34}|sk_test_[a-zA-Z0-9]{24,34})",
        "severity": Severity.CRITICAL,
        "category": "Secret Leak",
        "impact": "Complete unauthorized read/write access to customer financial records and payment balances."
    },
    {
        "rule_id": "LG-SEC-004",
        "title": "Hardcoded AWS Access Key ID Detected",
        "regex": r"(AKIA[0-9A-Z]{16})",
        "severity": Severity.CRITICAL,
        "category": "Secret Leak",
        "impact": "Potential AWS account takeover or cloud infrastructure compromise."
    },
    {
        "rule_id": "LG-SEC-005",
        "title": "Hardcoded Supabase Service Role Key Exposed",
        "regex": r"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+",
        "severity": Severity.CRITICAL,
        "category": "Secret Leak",
        "impact": "Bypasses all PostgreSQL Row Level Security (RLS) policies completely."
    }
]

# Hallucinated or typosquatted AI package names
SUSPICIOUS_PACKAGES = {
    "auth0-next-toolkit": "Hallucinated package commonly proposed by LLMs for Auth0 Next.js integration.",
    "supabase-secure-auth": "Non-existent npm package hallucinated by AI code assistants.",
    "react-domm": "Known typosquat of 'react-dom' targetting developer copy-paste typos.",
    "expresss": "Typosquat targeting 'express' framework.",
    "pydantic-v3": "Hallucinated Python package; Pydantic is currently v2.",
    "fastapi-jwt-extension": "Unmaintained / spoofed security dependency."
}


class LaunchGateRulePack(BaseRulePack):
    """
    LaunchGate: Pre-launch security gate for apps built with Cursor, Lovable, or Replit.
    Executes deterministic regex and syntax validations on code and configs.
    """
    product = ProductType.LAUNCHGATE
    name = "LaunchGate Pre-Launch Security Engine"

    def run(
        self,
        files: List[ScanInputFile],
        raw_content: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> RulePackResult:
        findings: List[Finding] = []
        citations: List[SourceCitation] = []

        all_files = list(files)
        if raw_content:
            all_files.append(
                ScanInputFile(
                    filename="submitted_code.txt",
                    content=raw_content
                )
            )

        for file_obj in all_files:
            file_name = file_obj.filename
            content = file_obj.content
            lines = content.splitlines()

            # Check 1: Secret Leaks
            for pat in SECRET_PATTERNS:
                for line_idx, line in enumerate(lines, start=1):
                    match = re.search(pat["regex"], line)
                    if match:
                        matched_str = match.group(0)
                        masked = matched_str[:8] + "..." + matched_str[-4:]
                        snippet = line.strip()

                        citation = SourceCitation(
                            file_path=file_name,
                            line_start=line_idx,
                            line_end=line_idx,
                            section_title=f"Line {line_idx}",
                            snippet=snippet,
                            source_type="code"
                        )
                        citations.append(citation)

                        finding = Finding(
                            id=f"FND-{pat['rule_id']}-{uuid.uuid4().hex[:6]}",
                            rule_id=pat["rule_id"],
                            product=ProductType.LAUNCHGATE,
                            title=pat["title"],
                            description=f"Secret token detected ({masked}) directly committed in source code.",
                            severity=pat["severity"],
                            category=pat["category"],
                            citation=citation,
                            impact=pat["impact"],
                            metadata={"secret_type": pat["category"], "line": line_idx}
                        )
                        findings.append(finding)

            # Check 2: Client-side Exposure of Backend Keys in Environment Files
            if "env" in file_name.lower():
                for line_idx, line in enumerate(lines, start=1):
                    if re.search(r"^(NEXT_PUBLIC_|VITE_|PUBLIC_).*(SERVICE_ROLE|SECRET|PRIVATE)", line, re.IGNORECASE):
                        citation = SourceCitation(
                            file_path=file_name,
                            line_start=line_idx,
                            line_end=line_idx,
                            section_title=f"Environment Definition",
                            snippet=line.strip(),
                            source_type="config"
                        )
                        citations.append(citation)
                        findings.append(
                            Finding(
                                id=f"FND-LG-ENV-001-{uuid.uuid4().hex[:6]}",
                                rule_id="LG-ENV-001",
                                product=ProductType.LAUNCHGATE,
                                title="Public Frontend Key Prefix on Backend Secret",
                                description="Client-exposed prefix (NEXT_PUBLIC_/VITE_) used on high-privilege service key.",
                                severity=Severity.CRITICAL,
                                category="Frontend Leak",
                                citation=citation,
                                impact="Exposes administrative backend keys in user-accessible browser bundles.",
                                metadata={"variable": line.split("=")[0] if "=" in line else line}
                            )
                        )

            # Check 3: Supabase / PostgreSQL Row Level Security (RLS)
            if any(ext in file_name.lower() for ext in [".sql", ".prisma", "supabase", "schema"]):
                # Look for open USING (true) policies
                for line_idx, line in enumerate(lines, start=1):
                    if re.search(r"create\s+policy\s+.*using\s*\(\s*true\s*\)", line, re.IGNORECASE) or \
                       re.search(r"with\s+check\s*\(\s*true\s*\)", line, re.IGNORECASE):
                        citation = SourceCitation(
                            file_path=file_name,
                            line_start=line_idx,
                            line_end=line_idx,
                            section_title="RLS Policy Definition",
                            snippet=line.strip(),
                            source_type="code"
                        )
                        citations.append(citation)
                        findings.append(
                            Finding(
                                id=f"FND-LG-RLS-001-{uuid.uuid4().hex[:6]}",
                                rule_id="LG-RLS-001",
                                product=ProductType.LAUNCHGATE,
                                title="Overly Permissive Supabase RLS Policy: USING (true)",
                                description="Policy allows unrestricted public read/write access without authenticating user ID.",
                                severity=Severity.CRITICAL,
                                category="Database RLS",
                                citation=citation,
                                impact="Any unauthenticated visitor can query, modify, or truncate sensitive application data.",
                                metadata={"table_reference": "public"}
                            )
                        )

            # Check 4: Firebase Open Rules
            if "firestore.rules" in file_name or "database.rules" in file_name:
                for line_idx, line in enumerate(lines, start=1):
                    if re.search(r"allow\s+read,\s*write\s*:\s*if\s+true\s*;", line):
                        citation = SourceCitation(
                            file_path=file_name,
                            line_start=line_idx,
                            line_end=line_idx,
                            section_title="Firebase Rule Clause",
                            snippet=line.strip(),
                            source_type="config"
                        )
                        citations.append(citation)
                        findings.append(
                            Finding(
                                id=f"FND-LG-RLS-002-{uuid.uuid4().hex[:6]}",
                                rule_id="LG-RLS-002",
                                product=ProductType.LAUNCHGATE,
                                title="Open Firebase Rules: Unauthenticated Read/Write Allowed",
                                description="Rule block allows unrestricted global read and write operations to the database.",
                                severity=Severity.CRITICAL,
                                category="Database RLS",
                                citation=citation,
                                impact="Global read/write access allows direct database wiping or data leakage.",
                                metadata={"rule_line": line_idx}
                            )
                        )

            # Check 5: Package Manifest Inspection (package.json / requirements.txt)
            if "package.json" in file_name or "requirements.txt" in file_name:
                for line_idx, line in enumerate(lines, start=1):
                    for suspicious_pkg, reason in SUSPICIOUS_PACKAGES.items():
                        if suspicious_pkg in line:
                            citation = SourceCitation(
                                file_path=file_name,
                                line_start=line_idx,
                                line_end=line_idx,
                                section_title="Dependencies",
                                snippet=line.strip(),
                                source_type="config"
                            )
                            citations.append(citation)
                            findings.append(
                                Finding(
                                    id=f"FND-LG-PKG-001-{uuid.uuid4().hex[:6]}",
                                    rule_id="LG-PKG-001",
                                    product=ProductType.LAUNCHGATE,
                                    title=f"Unverified or Hallucinated Package: {suspicious_pkg}",
                                    description=f"Package '{suspicious_pkg}' identified as suspicious: {reason}",
                                    severity=Severity.HIGH,
                                    category="Unverified Package",
                                    citation=citation,
                                    impact="Severe risk of supply-chain dependency hijacking or runtime import failure.",
                                    metadata={"package_name": suspicious_pkg}
                                )
                            )

        return RulePackResult(
            findings=findings,
            citations=citations,
            metadata={"scanned_files_count": len(all_files)}
        )
