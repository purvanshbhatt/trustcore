from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.core.schemas import (
    ProductType,
    Finding,
    SourceCitation,
    PermissionDiffItem,
    EvidenceMappingItem,
    EvalCaseResult
)


class RulePackResult(BaseModel):
    findings: List[Finding] = Field(default_factory=list)
    citations: List[SourceCitation] = Field(default_factory=list)
    permission_diff: Optional[List[PermissionDiffItem]] = None
    evidence_matrix: Optional[List[EvidenceMappingItem]] = None
    eval_results: Optional[List[EvalCaseResult]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BaseRulePack(ABC):
    """
    Engine 1 (Deterministic Rule Engine).
    All evaluation, regex scanning, AST parsing, permission matrix computation,
    and gap identification MUST happen deterministically here.
    """
    product: ProductType
    name: str

    @abstractmethod
    def run(
        self,
        files: List[Any],
        raw_content: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> RulePackResult:
        """Execute deterministic checks against provided inputs."""
        pass
