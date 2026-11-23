export type ProductType = 'launchgate' | 'agentscope' | 'evidence' | 'evalkit';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type ReadinessStatus = 'PASSED' | 'WARNING' | 'BLOCKED';

export interface SourceCitation {
  file_path: string;
  line_start?: number;
  line_end?: number;
  section_title?: string;
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
  permission_diff?: PermissionDiffItem[];
  permissions_matrix?: MCPToolPermission[];
  evidence_matrix?: EvidenceMappingItem[];
  eval_results?: EvalCaseResult[];
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

export interface BillingStatusResponse {
  tier: string;
  credits_remaining: number;
  is_mock: boolean;
  subscription_active: boolean;
}
