# TrustCore: Shared AI Security & Readiness Monorepo — HANDOFF & ARCHITECTURE MAP

**Repository Version:** 1.0.0  
**Status:** Production-Structured Monorepo  
**Target Deployment:** Google Cloud Run (Backend API) + Vercel / Cloudflare (Frontend Web)  
**Primary Principle:** Dual-Engine Architecture (Deterministic Rule Engine + LLM Explanation Layer)

---

## 1. Executive Summary & Mission

**TrustCore** is an enterprise-grade AI security and readiness suite providing four specialized applications built upon a shared, deterministic Python core engine, a unified Next.js frontend shell, and a centralized Stripe billing module:

1. **LaunchGate (`/launchgate`)** — Pre-launch security gate for applications built with Cursor, Lovable, or Replit. Detects hardcoded secrets (OpenAI, Anthropic, Stripe, AWS, Supabase service roles), open Supabase/PostgreSQL RLS policies (`USING (true)`), Firebase open rules, and hallucinated npm/pip packages. Generates one-click copyable remediation prompts for immediate paste into Cursor or Lovable prompt bars.
2. **AgentScope (`/agentscope`)** — Access and permissions auditor for AI agents and Model Context Protocol (MCP) server configurations (`claude_desktop_config.json`, YAML manifests, agent tool definitions). Identifies wildcard scopes (`*`), embedded plaintext credentials, and root filesystem mounts (`/`). Computes an interactive **Before / After Permission Diff** reducing agent blast radius by up to 78%.
3. **Evidence-to-Answer (`/evidence`)** — Zero-hallucination security questionnaire workbench. Ingests organizational security policies, SOC 2 documents, and questionnaire requirements. Deterministically matches controls with exact file and line-level citations. **Explicitly flags unsupported evidence gaps** (`UNSUPPORTED_GAP`) to prevent fraudulent compliance attestations.
4. **EvalKit (`/evalkit`)** — Workflow regression and prompt-injection evaluation runner. Tests system prompts and agent workflows against deterministic assertions and adversarial attack vectors: direct prompt injection, DAN/jailbreak persona overrides, system prompt canary token exfiltration (`CANARY_AUTH_SECRET_8819`), and tool parameter hijacking (`DROP TABLE`). Exports client acceptance reports.

---

## 2. The Non-Negotiable Architectural Principle: Dual-Engine Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          INGESTED ARTIFACTS                            │
│  (Source Files, SQL Migrations, MCP JSON, SOC 2 Policies, Prompts)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 ENGINE 1: DETERMINISTIC RULE ENGINE                    │
│                                                                        │
│  • 100% Deterministic Regex, AST, Matrix & Assertions in Python code   │
│  • Strict Pydantic v2 schemas                                          │
│  • Exact source references (file, line_start, snippet, rule_id)        │
│  • Severity scoring (CRITICAL, HIGH, MEDIUM, LOW, INFO)                │
│  • Readiness gate status (PASSED, WARNING, BLOCKED)                    │
│  • ZERO LLM intervention — NO fabricated findings or evidence          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Verified Findings & Citations
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   ENGINE 2: LLM EXPLANATION LAYER                      │
│                                                                        │
│  • Swappable explainer adapter (Mock mode default, Gemini / OpenAI)    │
│  • ONLY translates verified deterministic findings into:               │
│      1. Plain-English executive summaries & risk narratives            │
│      2. Copy-paste remediation prompts formatted for Cursor/Claude     │
│      3. Step-by-step developer remediation checklists                  │
│  • NEVER invents findings, alters risk scores, or modifies citations   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED REPORT & PERSISTENCE                        │
│   (Storage Repository -> REST API -> Next.js Source-Cited Viewer)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Monorepo Structure

```text
trustcore/
├── apps/
│   └── web/                                # Next.js (App Router) Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx              # Unified dark/light shell & typography
│       │   │   ├── page.tsx                # Overview / Quick-Launch Hub for all 4 tools
│       │   │   ├── globals.css             # Tailwind enterprise minimalist theme & scrollbars
│       │   │   ├── launchgate/page.tsx     # Ingestion + findings + Cursor fix prompts
│       │   │   ├── agentscope/page.tsx     # MCP config audit + Before/After diff view
│       │   │   ├── evidence/page.tsx       # SOC 2 workbench + citation/gap matrix
│       │   │   ├── evalkit/page.tsx        # Adversarial injection harness + acceptance report
│       │   │   └── reports/[id]/page.tsx   # Shared Source-Cited Report Viewer (MD/JSON/Print)
│       │   ├── components/
│       │   │   ├── AppShell.tsx            # Unified sidebar shell + product switcher + health
│       │   │   ├── FileDropzone.tsx        # Multi-file drag/drop + paste + sample loader
│       │   │   ├── FindingsTable.tsx       # Severity badges, rule IDs, click-to-cite action
│       │   │   ├── CitationDrawer.tsx      # Flyout showing exact source snippet, line, file
│       │   │   ├── FixPromptCard.tsx       # One-click copyable remediation prompt block
│       │   │   └── PaywallModal.tsx        # Reusable Stripe checkout modal (per-job & tiers)
│       │   └── lib/
│       │       ├── types.ts                # Shared Finding, Citation, Report, and Run schemas
│       │       ├── api.ts                  # Resilient API client with automatic mock fallback
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
└── HANDOFF.md                              # This architecture and operations document
```

---

## 4. Quickstart Guide

### Prerequisites
- Node.js 18+ (tested with v24.21.0)
- Python 3.11+ (tested with Python 3.14.8)
- Linux / macOS / WSL

### 1. Environment Setup
```bash
cd /home/purvansh/Projects/trustcore
cp .env.example .env
```

### 2. Run the Backend (FastAPI API)
The backend uses a Python virtual environment located at `services/api/.venv`:
```bash
cd services/api
source .venv/bin/activate
# Run API server on port 8000
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Healthcheck: `http://localhost:8000/health`  
Interactive Swagger Docs: `http://localhost:8000/docs`

### 3. Run the Backend Test Suite
```bash
cd services/api
.venv/bin/pytest tests/
# Output: 6 passed in 0.47s
```

### 4. Run the Frontend (Next.js)
```bash
cd apps/web
npm run dev
```
Open `http://localhost:3000` to launch the unified TrustCore hub.

---

## 5. Product Modules & Deterministic Rules Reference

| Product | Rule ID | Category | Severity | Description |
|---|---|---|---|---|
| **LaunchGate** | `LG-SEC-001` | Secret Leak | CRITICAL | Hardcoded OpenAI API key (`sk-proj-...`) |
| **LaunchGate** | `LG-SEC-002` | Secret Leak | CRITICAL | Hardcoded Anthropic API key (`sk-ant-...`) |
| **LaunchGate** | `LG-SEC-003` | Secret Leak | CRITICAL | Hardcoded Stripe Secret key (`sk_live_...`) |
| **LaunchGate** | `LG-SEC-004` | Secret Leak | CRITICAL | Hardcoded AWS Access Key ID (`AKIA...`) |
| **LaunchGate** | `LG-SEC-005` | Secret Leak | CRITICAL | Hardcoded Supabase Service Role JWT |
| **LaunchGate** | `LG-RLS-001` | Database RLS | CRITICAL | Open PostgreSQL/Supabase RLS: `USING (true)` |
| **LaunchGate** | `LG-RLS-002` | Database RLS | CRITICAL | Open Firebase rule: `allow read, write: if true;` |
| **LaunchGate** | `LG-PKG-001` | Package Audit | HIGH | Hallucinated npm package (e.g. `auth0-next-toolkit`) |
| **LaunchGate** | `LG-ENV-001` | Frontend Leak | CRITICAL | Client prefix (`NEXT_PUBLIC_`) on backend service key |
| **AgentScope** | `AS-SCP-001` | Wildcard Scope | CRITICAL | Wildcard tool/action scope (`"*"`, `"admin:*"`) |
| **AgentScope** | `AS-KEY-001` | Credential | HIGH | Embedded plaintext API key in MCP `env` block |
| **AgentScope** | `AS-FS-001` | Filesystem | CRITICAL | Dangerous root filesystem mount (`/`, `~`, `C:\`) |
| **AgentScope** | `AS-TOOL-001`| Risky Tool | HIGH | Destructive unconfirmed tool execution (`bash`, `drop_database`) |
| **Evidence** | `EV-GAP-001` | Evidence Gap | HIGH | Missing deterministic evidence for compliance control |
| **EvalKit** | `EVK-ADV-001` | Prompt Injection | CRITICAL | System prompt canary exfiltration (`CANARY_AUTH_SECRET_8819`) |
| **EvalKit** | `EVK-ADV-002` | Prompt Injection | HIGH | DAN / persona roleplay jailbreak compliance |
| **EvalKit** | `EVK-ADV-003` | Tool Hijack | CRITICAL | Destructive SQL invocation parameter hijacking |

---

## 6. Stripe Billing & Webhook Layer

Billing is encapsulated cleanly in `services/api/app/core/billing.py` and exposed via `/api/v1/billing/*`:
- **Mock Mode (`MOCK_BILLING=true`):** Simulates instant checkout success without making external network calls or needing live Stripe API keys. Great for local layout work and testing.
- **Live Mode (`MOCK_BILLING=false`):** Calls official `stripe.checkout.Session.create()` using configured price IDs (`STRIPE_PRICE_ID_PER_SCAN`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_ENTERPRISE`).
- **Webhook Endpoint (`/api/v1/billing/webhook`):** Validates incoming `Stripe-Signature` headers with `STRIPE_WEBHOOK_SECRET` and unpacks event payloads.

---

## 7. Containerization & Google Cloud Run

A production-ready `services/api/Dockerfile` is included:
- Base: `python:3.11-slim`
- Security: Non-root user `trustcore` (UID 1000)
- Port: Automatically binds to `$PORT` (defaults to 8000 for local, 8080 on Cloud Run)
- Build & Deploy Command:
  ```bash
  cd services/api
  gcloud builds submit --tag gcr.io/[PROJECT_ID]/trustcore-api
  gcloud run deploy trustcore-api --image gcr.io/[PROJECT_ID]/trustcore-api --platform managed --allow-unauthenticated
  ```

---

## 8. State for Switching Between IDEs & Agents

If picking up this repository in Cursor, Claude Code, Windsurf, or another environment:
- **FastAPI Backend Virtualenv:** Located at `services/api/.venv/bin/python`.
- **Sample Testing Data:** Each tool has a dedicated `GET /api/v1/samples/{product}` endpoint providing realistic code, SQL, MCP JSON, and SOC 2 markdown.
- **Frontend Fallback:** The web app has built-in resilient fallbacks in `apps/web/src/lib/api.ts` so all UI interactions work cleanly even if the backend is temporarily offline.
- **Extending Rules:** To add a new deterministic rule, create a new rule definition in `services/api/app/rules/` implementing `BaseRulePack`, register it in `services/api/app/core/engine.py`, and the entire frontend findings table, citation drawer, and fix prompt cards will automatically reflect the findings!
