export type ProductType = 'launchgate' | 'agentscope' | 'evidence' | 'evalkit';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type ReadinessStatus = 'PASSED' | 'WARNING' | 'BLOCKED';

export interface SourceCitation {
  file_path: string;
  /** Line numbers and section are `null`, and `snippet` is empty, when the citation is locked (preview). */
  line_start?: number | null;
  line_end?: number | null;
  section_title?: string | null;
  snippet: string;
  source_type: 'code' | 'config' | 'policy_doc' | 'questionnaire' | 'test_case';
}

export interface RemediationPrompt {
  title: string;
  description: string;
  prompt_text: string;
  target_tool: 'Cursor / Lovable' | 'Claude Code / Windsurf' | 'Terminal / CLI' | 'Security Policy';
}

export interface Finding {
  id: string;
  rule_id: string;
  product: ProductType;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  citation: SourceCitation;
  impact: string;
  remediation_prompt?: RemediationPrompt;
  metadata?: Record<string, any>;
}

export interface ReportSummary {
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  risk_score: number;
  readiness_status: ReadinessStatus;
}

export interface PermissionDiffItem {
  field: string;
  before_value: any;
  after_value: any;
  action: 'RESTRICTED' | 'REMOVED' | 'SCOPED_DOWN' | 'PROTECTED' | 'VERIFIED';
  reason: string;
}

export interface MCPToolPermission {
  name: string;
  description: string;
  category: 'Read' | 'Write' | 'Destructive' | 'Network';
  scope: string;
  confirmationRequired: boolean;
  status: 'ALLOWED' | 'RESTRICTED' | 'BLOCKED';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface EvidenceMappingItem {
  id: string;
  question_id: string;
  question: string;
  status: 'VERIFIED_EVIDENCE' | 'UNSUPPORTED_GAP';
  answer: string;
  confidence_score: number;
  citation?: SourceCitation;
  gap_reason?: string;
}

export interface ModelRegressionDiffItem {
  testId: string;
  testName: string;
  category: string;
  baselineModel: string;
  baselineStatus: 'PASSED' | 'FAILED';
  candidateModel: string;
  candidateStatus: 'PASSED' | 'FAILED';
  verdict: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED';
  details: string;
}

export interface ClientAcceptanceSignoff {
  signoffId: string;
  projectName: string;
  evalDate: string;
  overallStatus: 'ACCEPTED' | 'REJECTED';
  passRate: number;
  canaryIntact: boolean;
  evaluatedBy: string;
  auditorNotes: string;
}

export interface EvalCaseResult {
  id: string;
  test_name: string;
  category: 'prompt_injection' | 'jailbreak' | 'canary_leak' | 'tool_hijack' | 'regression';
  input_payload: string;
  expected: string;
  actual_output: string;
  status: 'PASSED' | 'FAILED';
  adversarial_type?: string;
  defense_triggered: boolean;
  details: string;
}

export interface Report {
  id: string;
  product: ProductType;
  title: string;
  created_at: string;
  summary: ReportSummary;
  findings: Finding[];
  executive_summary: string;
  remediation_prompts: RemediationPrompt[];
  /** Detail views are `null` in preview reports (`metadata.access === 'preview'`). */
  permission_diff?: PermissionDiffItem[] | null;
  permissions_matrix?: MCPToolPermission[] | null;
  evidence_matrix?: EvidenceMappingItem[] | null;
  eval_results?: EvalCaseResult[] | null;
  regression_diff?: ModelRegressionDiffItem[];
  client_signoff?: ClientAcceptanceSignoff;
  metadata?: Record<string, any>;
}

export interface ScanInputFile {
  filename: string;
  content: string;
  file_type?: string;
}

export interface ScanRequest {
  product: ProductType;
  project_name: string;
  files: ScanInputFile[];
  raw_content?: string;
  options?: Record<string, any>;
  /** Zero-Retention Mode: scan in memory, return the report, never persist it. */
  ephemeral?: boolean;
}

export interface IngestSkippedFile {
  readonly path: string;
  readonly reason: string;
}

export interface IngestResponse {
  readonly source: string;
  readonly files: ScanInputFile[];
  readonly skipped: IngestSkippedFile[];
  readonly skipped_count: number;
  readonly total_bytes: number;
  readonly truncated: boolean;
}

export interface BillingCheckoutRequest {
  tier: 'per_scan' | 'pro_monthly' | 'enterprise_monthly';
  success_url?: string;
  cancel_url?: string;
}

export interface BillingCheckoutResponse {
  checkout_url: string;
  session_id: string;
  is_mock: boolean;
  message: string;
}

export type BillingTier = 'free' | 'per_scan' | 'pro_monthly' | 'enterprise';

export interface BillingStatusResponse {
  tier: BillingTier;
  credits_remaining: number;
  is_mock: boolean;
  subscription_active: boolean;
  /** True while the caller's single free preview scan is still unused. */
  free_preview_available: boolean;
  /** True when the next scan returns a full report (credits or an active subscription). */
  can_run_full_scan: boolean;
}

/** `Report.metadata.access`: a preview withholds citations, fix prompts and detail views. */
export type ReportAccess = 'full' | 'preview';

/** Normalised `Report.metadata.locked` for preview reports. */
export interface ReportLockedInfo {
  readonly hiddenFindings: number;
  readonly features: readonly string[];
}

type ReportMetadataCarrier = { readonly metadata?: Record<string, unknown> } | null | undefined;

/** Access level of a report. Reports without `metadata.access` (older ones) are full. */
export function getReportAccess(report: ReportMetadataCarrier): ReportAccess {
  const access: unknown = report?.metadata?.access;
  return access === 'preview' ? 'preview' : 'full';
}

export function isPreviewReport(report: ReportMetadataCarrier): boolean {
  return getReportAccess(report) === 'preview';
}

/** What a preview report withholds; zero/empty for full reports. */
export function getLockedInfo(report: ReportMetadataCarrier): ReportLockedInfo {
  const locked: unknown = report?.metadata?.locked;
  if (typeof locked !== 'object' || locked === null) {
    return { hiddenFindings: 0, features: [] };
  }
  const hidden: unknown = (locked as { hidden_findings?: unknown }).hidden_findings;
  const features: unknown = (locked as { features?: unknown }).features;
  return {
    hiddenFindings: typeof hidden === 'number' && Number.isFinite(hidden) && hidden > 0 ? Math.floor(hidden) : 0,
    features: Array.isArray(features)
      ? features.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

/** Preview reports ship citations with an empty snippet: the exact source is locked. */
export function isCitationLocked(citation: Pick<SourceCitation, 'snippet'>): boolean {
  return citation.snippet === '';
}
