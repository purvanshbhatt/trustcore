# TrustCore — Shared AI Security & Readiness Monorepo

<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2+-000000.svg?style=flat&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4+-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Google_Cloud_Run-2496ED.svg?style=flat&logo=docker&logoColor=white)](https://cloud.google.com/run)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**One deterministic core engine • One unified frontend shell • One Stripe payment layer**

</div>

---

## Overview

**TrustCore** is an enterprise-grade AI security and readiness suite providing four specialized applications built upon a shared, deterministic Python core engine, a unified Next.js frontend shell, and a centralized Stripe billing module:

1. **LaunchGate (`/launchgate`)** — Pre-launch security gate for applications built with Cursor, Lovable, or Replit. Detects hardcoded secrets (OpenAI, Anthropic, Stripe, AWS, Supabase service roles), open Supabase/PostgreSQL RLS policies (`USING (true)`), Firebase open rules, and hallucinated npm/pip packages. Generates one-click copyable remediation prompts for immediate paste into Cursor or Lovable prompt bars.
2. **AgentScope (`/agentscope`)** — Access and permissions auditor for AI agents and Model Context Protocol (MCP) server configurations (`claude_desktop_config.json`, YAML manifests, agent tool definitions). Identifies wildcard scopes (`*`), embedded plaintext credentials, and root filesystem mounts (`/`). Computes an interactive **Before / After Permission Diff** reducing agent blast radius by up to 78%.
3. **Evidence-to-Answer (`/evidence`)** — Zero-hallucination security questionnaire workbench. Ingests organizational security policies, SOC 2 documents, and questionnaire requirements. Deterministically matches controls with exact file and line-level citations. **Explicitly flags unsupported evidence gaps** (`UNSUPPORTED_GAP`) to prevent fraudulent compliance attestations.
4. **EvalKit (`/evalkit`)** — Workflow regression and prompt-injection evaluation runner. Tests system prompts and agent workflows against deterministic assertions and adversarial attack vectors: direct prompt injection, DAN/jailbreak persona overrides, system prompt canary token exfiltration (`CANARY_AUTH_SECRET_8819`), and tool parameter hijacking (`DROP TABLE`). Exports client acceptance reports.

---

## Architectural Principle: Dual-Engine Architecture

TrustCore strictly adheres to a **Dual-Engine Architecture**:

- **Engine 1 (Deterministic Rule Engine):** All findings, risk scores, secret matches, permission flags, package checks, and gap flags MUST be computed deterministically in code with structured JSON output and exact source references (`file`, `line_start`, `line_end`, `snippet`, `rule_id`, `severity`). **Zero LLM hallucinations or fabricated findings.**
- **Engine 2 (LLM Explanation Layer):** LLMs are exclusively used to translate verified deterministic findings into plain-English explanations, copy-paste remediation prompts, or executive summaries—never to invent findings or fabricate compliance evidence.

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

## Monorepo Structure

```text
trustcore/
├── apps/
│   └── web/                                # Next.js 14 (App Router) + TypeScript + Tailwind
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx              # Unified dark/light shell & typography
│       │   │   ├── page.tsx                # Overview / Quick-Launch Hub for all 4 tools
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
├── services/
│   └── api/                                # FastAPI Backend (Python 3.11+)
│       ├── app/
│       │   ├── main.py                     # FastAPI entry point + CORS + healthcheck
│       │   ├── core/
│       │   │   ├── schemas.py              # Pydantic v2 schemas (Finding, Citation, Report)
│       │   │   ├── engine.py               # Shared pipeline: Ingest -> RulePack -> Explain
│       │   │   ├── explainer.py            # Engine 2 LLM layer (mock / live Gemini/OpenAI)
│       │   │   ├── storage.py              # Repository interface (PostgresReportRepository, user_id-scoped)
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
│       ├── Dockerfile                      # Production Google Cloud Run container
│       └── requirements.txt
├── .env.example                            # Comprehensive environment variable template
├── HANDOFF.md                              # Architecture map + exact state for switching IDEs
└── README.md
```

---

## Quickstart

### 1. Setup Environment
```bash
git clone git@github.com:purvanshbhatt/trustcore.git
cd trustcore
cp .env.example .env
```

### 2. Run the Backend API
```bash
cd services/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start FastAPI server on port 8000
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Healthcheck: `http://localhost:8000/health`
- Interactive Swagger Docs: `http://localhost:8000/docs`

### 3. Run Backend Pytest Suite
```bash
cd services/api
.venv/bin/pytest tests/
# Output: 6 passed in 0.47s
```

### 4. Run the Web Application
```bash
cd apps/web
npm install
npm run dev
```
Open `http://localhost:3000` to access the unified TrustCore hub.

---

## License

Apache-2.0 License.
