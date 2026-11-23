# TrustCore: Shared AI Security & Readiness Monorepo — HANDOFF & ARCHITECTURE MAP

**Repository Version:** 1.0.0  
**Phase Completed:** Phase 1: Interactive Frontend & Dual-Engine Core  
**Target Deployment:** Google Cloud Run (Backend API) + Vercel / Cloudflare (Frontend Web)  
**Live GitHub Repository:** [https://github.com/purvanshbhatt/trustcore](https://github.com/purvanshbhatt/trustcore)  
**Primary Principle:** Dual-Engine Architecture (Deterministic Rule Engine + LLM Explanation Layer)

---

## 1. Monorepo Folder Tree

```text
trustcore/
├── apps/
│   └── web/                                # Next.js 14 (App Router) + TypeScript + Tailwind
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx              # Unified dark/light shell & typography
│       │   │   ├── page.tsx                # Overview / Quick-Launch Hub for all 4 tools
│       │   │   ├── globals.css             # Tailwind enterprise minimalist theme & custom scrollbars
│       │   │   ├── launchgate/page.tsx     # Ingestion (GitHub/ZIP/Snippet) + severity cards + fix prompts
│       │   │   ├── agentscope/page.tsx     # MCP config audit + visual permissions matrix + diff view
│       │   │   ├── evidence/page.tsx       # Dual dropzone + answer table (4 columns) + gap flags
│       │   │   ├── evalkit/page.tsx        # Adversarial harness + model regression diff + acceptance sign-off
│       │   │   └── reports/[id]/page.tsx   # Shared Source-Cited Report Viewer (MD/JSON/Print)
│       │   ├── components/
│       │   │   ├── AppShell.tsx            # Unified sidebar shell + product switcher + health indicator
│       │   │   ├── FileDropzone.tsx        # Multi-file drag/drop + paste + sample loader
│       │   │   ├── FindingsTable.tsx       # Severity badges, rule IDs, click-to-cite action
│       │   │   ├── CitationDrawer.tsx      # Flyout showing exact source snippet, line, and file
│       │   │   ├── FixPromptCard.tsx       # One-click copyable remediation prompt block
│       │   │   └── PaywallModal.tsx        # Reusable Stripe checkout modal (per-job & monthly tiers)
│       │   └── lib/
│       │       ├── types.ts                # Shared Finding, Citation, Report, and Run schemas
│       │       ├── api.ts                  # API client with NEXT_PUBLIC_USE_MOCK toggle
│       │       └── mockData.ts             # Realistic synthetic sample outputs for all 4 tools
│       ├── package.json
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       └── next.config.js
├── services/
│   └── api/                                # FastAPI Backend (Python 3.11+)
│       ├── app/
│       │   ├── main.py                     # FastAPI entry point + CORS + healthcheck
│       │   ├── core/
│       │   │   ├── schemas.py              # Pydantic v2 schemas (Finding, Citation, Report)
│       │   │   ├── engine.py               # Shared pipeline: Ingest -> RulePack -> Explain
│       │   │   ├── explainer.py            # Engine 2 LLM layer (mock / live Gemini/OpenAI)
│       │   │   ├── storage.py              # Repository interface (LocalStorageRepository)
│       │   │   └── billing.py              # Stripe Checkout session & webhook verifier
│       │   ├── rules/
│       │   │   ├── base.py                 # Abstract BaseRulePack interface
│       │   │   ├── launchgate.py           # Regex secret scan, Supabase/Firebase RLS, packages
│       │   │   ├── agentscope.py           # MCP JSON/YAML parser, wildcard & root mount audit
│       │   │   ├── evidence.py             # Policy parser, deterministic matcher, gap flagger
│       │   │   └── evalkit.py              # Prompt injection runner & canary exfiltration test
│       │   └── routers/
│       │       ├── scans.py                # POST /api/v1/run/{product} + GET /api/v1/reports/{id}
│       │       └── billing.py              # POST /api/v1/billing/checkout + /webhook
│       ├── tests/
│       │   └── test_api.py                 # Pytest test suite covering all 4 tools & billing
│       ├── pytest.ini
│       ├── Dockerfile                      # Production Google Cloud Run container
│       └── requirements.txt
├── package.json                            # Monorepo root scripts
├── .env.example                            # Comprehensive environment variable template
├── .gitignore
├── README.md                               # Project documentation & architecture diagram
└── HANDOFF.md                              # This architecture and operations document
```

---

## 2. Exact Commands to Run Locally

### Run Frontend Web App (`apps/web`)
```bash
cd apps/web
npm install
npm run dev
# Running on http://localhost:3000
```

To build production bundle and verify TypeScript types:
```bash
cd apps/web
npm run build
# Result: ✓ Compiled successfully, 0 TypeScript errors
```

### Run Backend FastAPI (`services/api`)
```bash
cd services/api
# Activate existing virtualenv
source .venv/bin/activate
# Run server
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Running on http://localhost:8000
# OpenAPI Docs: http://localhost:8000/docs
```

### Run Backend Pytest Suite
```bash
cd services/api
.venv/bin/pytest tests/
# Result: 6 passed in 0.47s
```

---

## 3. What is Currently Mocked vs. Wired

| Module | Status | Details |
|---|---|---|
| **Frontend Layout & Shell** | **WIRED & LIVE** | Unified left sidebar navigating between Hub, LaunchGate, AgentScope, Evidence-to-Answer, EvalKit, and Reports. |
| **LaunchGate UI** | **WIRED & LIVE** | Multi-mode input (GitHub URL, ZIP upload, Code snippet, One-click sample), severity cards, findings table, one-click copy fix prompts for Cursor/Claude. |
| **AgentScope UI** | **WIRED & LIVE** | MCP JSON editor, Visual Permissions Matrix (**Read / Write / Destructive / Network**), plaintext secret alerts, and interactive Before / After Diff view. |
| **Evidence-to-Answer UI** | **WIRED & LIVE** | **Dual Dropzone** (Questionnaire CSV/XLSX + Evidence Docs), answer table with 4 columns: `Question`, `Draft Answer`, `Exact Source Citation` (opens CitationDrawer), and `Status` (`SUPPORTED` vs `EVIDENCE GAP`). |
| **EvalKit UI** | **WIRED & LIVE** | Test-case table (baseline + adversarial injection), interactive Run Eval runner, **Model Version Regression Diff** (v1.0 vs v1.2), and **Client Acceptance Certificate Modal**. |
| **Paywall & Billing** | **MOCKED / WIRED** | `MOCK_BILLING=true` by default so users can test Stripe upgrade checkout sessions locally without credit card or live keys. Real Stripe client activates when `MOCK_BILLING=false` and `STRIPE_SECRET_KEY` is provided. |
| **API Fallback Toggle** | **WIRED & LIVE** | `NEXT_PUBLIC_USE_MOCK=true` serves instant synthetic data; when set to `false`, calls FastAPI backend with automatic graceful fallback if disconnected. |
| **Engine 1 Rule Engine** | **WIRED & LIVE** | Real deterministic regex secret scanning, Supabase/Firebase RLS rules, package audits, MCP JSON permission parsing, policy keyword matching, and canary exfiltration test harness. |
| **Engine 2 LLM Layer** | **MOCKED / ADAPTER** | Rule-to-narrative synthesis generates executive summaries and Cursor prompts by default. Ready to plug into live Gemini or OpenAI via `LLM_EXPLAINER_PROVIDER=gemini` or `openai`. |

---

## 4. API Endpoints & JSON Schemas

### Endpoints
- `GET /health` / `GET /api/v1/health`: Server health, dual-engine status, billing mode.
- `POST /api/v1/run/{product}`: Execute scan for `launchgate`, `agentscope`, `evidence`, or `evalkit`. Returns structured `Report`.
- `GET /api/v1/reports/{id}`: Retrieve persisted scan report.
- `GET /api/v1/reports`: List recent scan reports.
- `GET /api/v1/samples/{product}`: Return preloaded realistic sample files for instant UI testing.
- `POST /api/v1/billing/checkout`: Create Stripe Checkout Session (per-scan, pro, enterprise).
- `POST /api/v1/billing/webhook`: Stripe webhook signature verification and entitlement updates.
- `GET /api/v1/billing/status`: User tier, credits remaining, and mock status.

### Core Schemas (`schemas.py` / `types.ts`)
- **`Finding`**:
  ```typescript
  {
    id: string;
    rule_id: string;
    product: "launchgate" | "agentscope" | "evidence" | "evalkit";
    title: string;
    description: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    category: string;
    citation: SourceCitation;
    impact: string;
    remediation_prompt?: RemediationPrompt;
    metadata?: Record<string, any>;
  }
  ```
- **`SourceCitation`**:
  ```typescript
  {
    file_path: string;
    line_start?: number;
    line_end?: number;
    section_title?: string;
    snippet: string;
    source_type: "code" | "config" | "policy_doc" | "questionnaire" | "test_case";
  }
  ```
- **`RemediationPrompt`**:
  ```typescript
  {
    title: string;
    description: string;
    prompt_text: string;
    target_tool: "Cursor / Lovable" | "Claude Code / Windsurf" | "Terminal / CLI" | "Security Policy";
  }
  ```

---

## 5. Next Steps for Production Hardening

1. **Rule Pack Deepening:**
   - Expand `launchgate.py` with Python AST visitor for SQL injection (`raw_sql` string concatenation).
   - Expand `agentscope.py` with network CIDR egress validation for sandboxed agent environments.
2. **Connecting Live LLM:**
   - Add `GEMINI_API_KEY` or `OPENAI_API_KEY` in `.env` and set `LLM_EXPLAINER_PROVIDER=gemini`.
3. **Connecting Live Stripe:**
   - Add live Stripe credentials (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and set `MOCK_BILLING=false`.
4. **Deploying to Google Cloud Run:**
   - Build container with `gcloud builds submit --tag gcr.io/[PROJECT_ID]/trustcore-api services/api`
   - Deploy container with `gcloud run deploy trustcore-api --image gcr.io/[PROJECT_ID]/trustcore-api --platform managed`
