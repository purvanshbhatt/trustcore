# Graph Report - trustcore  (2026-11-23)

## Corpus Check
- Corpus is ~31,291 words - fits in a single context window. You may not need a graph.

## Summary
- 399 nodes · 989 edges · 17 communities (10 shown, 7 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 110 edges (avg confidence: 0.93)
- Token cost: 192,658 input · 0 output

## Community Hubs (Navigation)
- API Engine & Rule Packs
- Product Pages & Components
- Architecture & Handoff Docs
- FastAPI App & Billing
- Web Dependencies
- Reports & Storage
- App Shell & A/B Testing
- TypeScript Config
- EvalKit & Test Suite
- Monorepo Root Scripts
- Next.js Config

## God Nodes (most connected - your core abstractions)
1. `ProductType` - 24 edges
2. `Finding` - 22 edges
3. `lucide-react` - 21 edges
4. `react` - 21 edges
5. `RulePackResult` - 20 edges
6. `TrustCoreEngine` - 19 edges
7. `SourceCitation` - 17 edges
8. `Report` - 17 edges
9. `compilerOptions` - 16 edges
10. `BaseRulePack` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Readiness Gate Status (PASSED / WARNING / BLOCKED)` --references--> `ReadinessStatus`  [INFERRED]
  README.md → services/api/app/core/schemas.py
- `Before / After Permission Diff` --references--> `PermissionDiffItem`  [INFERRED]
  README.md → services/api/app/core/schemas.py
- `Severity Scoring (CRITICAL / HIGH / MEDIUM / LOW / INFO)` --references--> `Severity`  [INFERRED]
  README.md → services/api/app/core/schemas.py
- `GET /health and GET /api/v1/health` --references--> `healthcheck()`  [INFERRED]
  HANDOFF.md → services/api/app/main.py
- `GET /api/v1/billing/status` --references--> `get_billing_status()`  [INFERRED]
  HANDOFF.md → services/api/app/routers/billing.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Four TrustCore Products Built on One Shared Core Engine, Frontend Shell, and Billing Layer** — readme_launchgate, readme_agentscope, readme_evidence_to_answer, readme_evalkit, readme_shared_scan_pipeline, readme_unified_frontend_shell, readme_stripe_billing_module [EXTRACTED 1.00]
- **Dual-Engine Flow: Ingested Artifacts -> Deterministic Rules -> LLM Explanation -> Unified Report** — readme_ingested_artifacts, readme_engine_1_deterministic_rule_engine, readme_engine_2_llm_explanation_layer, readme_unified_report_persistence [EXTRACTED 1.00]
- **Mock-by-Default Toggles for Local Development (billing, API client, LLM explainer)** — handoff_mock_billing_mode, handoff_api_mock_fallback_toggle, handoff_llm_explainer_provider [INFERRED 0.85]

## Communities (17 total, 7 thin omitted)

### Community 0 - "API Engine & Rule Packs"
Cohesion: 0.10
Nodes (23): get_engine(), TrustCoreEngine, LLMExplainer, EvalCaseResult, EvidenceMappingItem, Finding, PermissionDiffItem, ProductType (+15 more)

### Community 1 - "Product Pages & Components"
Cohesion: 0.10
Nodes (47): AgentScopePage(), EvalKitPage(), EvidenceWorkbenchPage(), LaunchGatePage(), OverviewHubPage(), ReportViewerPage(), load(), BlastRadiusSimulator() (+39 more)

### Community 2 - "Architecture & Handoff Docs"
Cohesion: 0.06
Nodes (47): MCPToolPermission, TrustCore HANDOFF & Architecture Map, Connecting Live LLM (GEMINI_API_KEY / OPENAI_API_KEY), Target Deployment (Cloud Run backend + Vercel / Cloudflare frontend), Evidence Answer Table (Question / Draft Answer / Exact Source Citation / Status), Finding Schema, Deploying to Google Cloud Run (gcloud builds submit / gcloud run deploy), LaunchGate Multi-mode Input (GitHub URL / ZIP / snippet / sample) (+39 more)

### Community 3 - "FastAPI App & Billing"
Cohesion: 0.08
Nodes (16): Connecting Live Stripe (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET), GET /api/v1/billing/status, GET /health and GET /api/v1/health, POST /api/v1/billing/checkout, POST /api/v1/billing/webhook, Centralized Stripe Billing Module, BillingService, get_billing_service() (+8 more)

### Community 4 - "Web Dependencies"
Cohesion: 0.08
Nodes (33): dependencies, clsx@^2.1.1, lucide-react@^0.460.0, next@^14.2.20, react@^18.3.1, react-dom@^18.3.1, tailwind-merge@^2.5.5, devDependencies (+25 more)

### Community 5 - "Reports & Storage"
Cohesion: 0.10
Nodes (12): GET /api/v1/reports, GET /api/v1/reports/{id}, GET /api/v1/samples/{product}, Report Schema, Shared Source-Cited Report Viewer (MD / JSON / Print), Unified Report & Persistence, Report, BaseReportStorage (+4 more)

### Community 6 - "App Shell & A/B Testing"
Cohesion: 0.13
Nodes (22): metadata, RootLayout(), ABExperimentBar(), AppShell(), AppShellProps, InnerAppShell(), init(), PaywallModal() (+14 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 8 - "EvalKit & Test Suite"
Cohesion: 0.13
Nodes (10): ClientAcceptanceSignoff, ModelRegressionDiffItem, Client Acceptance Certificate Modal, Model Version Regression Diff (v1.0 vs v1.2), Adversarial Attack Vectors (prompt injection, DAN/jailbreak, tool parameter hijacking), System Prompt Canary Token Exfiltration Test, Client Acceptance Report, EvalKit (Regression & Prompt-Injection Eval Runner) (+2 more)

### Community 9 - "Monorepo Root Scripts"
Cohesion: 0.12
Nodes (15): author, description, keywords, license, name, private, scripts, build:web (+7 more)

## Knowledge Gaps
- **8 isolated node(s):** `Ingested Artifacts (source files, SQL migrations, MCP JSON, SOC 2 policies, prompts)`, `Open Supabase/PostgreSQL RLS & Firebase Rule Detection`, `Apache-2.0 License`, `GET /api/v1/reports`, `GET /api/v1/samples/{product}` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 125 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TrustCore AI Security & Readiness Suite` connect `Architecture & Handoff Docs` to `EvalKit & Test Suite`, `Product Pages & Components`, `FastAPI App & Billing`, `App Shell & A/B Testing`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `ProductType` (e.g. with `TrustCoreEngine` and `LLMExplainer`) actually correct?**
  _`ProductType` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Ingested Artifacts (source files, SQL migrations, MCP JSON, SOC 2 policies, prompts)`, `Open Supabase/PostgreSQL RLS & Firebase Rule Detection`, `Apache-2.0 License` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Engine & Rule Packs` be split into smaller, more focused modules?**
  _Cohesion score 0.1036653091447612 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Product Pages & Components` to `Web Dependencies`, `App Shell & A/B Testing`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `Finding` (e.g. with `LLMExplainer` and `AgentScopeRulePack`) actually correct?**
  _`Finding` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Should `Product Pages & Components` be split into smaller, more focused modules?**
  _Cohesion score 0.09606625258799172 - nodes in this community are weakly interconnected._