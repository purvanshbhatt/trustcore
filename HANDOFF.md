# TrustCore: Shared AI Security & Readiness Monorepo — HANDOFF & ARCHITECTURE MAP

**Repository Version:** 1.0.0  
**Phase Completed:** Phase 1: Interactive Frontend & Dual-Engine Core · Phase 2A: Auth, Per-User Isolation, Secret Redaction, Real Ingestion (see §6) · Phase 2B: Stripe Entitlements, Freemium Gate, Live Gemini Engine 2, Rate Limiting (see §7)  
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
│       │   │   ├── login/page.tsx          # Sign-in: email magic link + GitHub OAuth (Supabase Auth)
│       │   │   ├── auth/callback/page.tsx  # OAuth / magic-link return page (PKCE code exchange)
│       │   │   └── reports/[id]/page.tsx   # Shared Source-Cited Report Viewer (MD/JSON/Print) + Delete Report
│       │   ├── components/
│       │   │   ├── AppShell.tsx            # Unified sidebar shell + product switcher + health indicator + sign-in state
│       │   │   ├── FileDropzone.tsx        # Drag/drop + browse wired to POST /ingest/upload, paste, sample loader
│       │   │   ├── ZeroRetentionToggle.tsx # Zero-Retention Mode switch (sends ephemeral: true)
│       │   │   ├── ApiErrorNotice.tsx      # Visible scan/ingest errors incl. "Sign in required" (401)
│       │   │   ├── ReportFlags.tsx         # "Ephemeral — not saved" and "Demo data" badges
│       │   │   ├── PreviewLock.tsx         # Locked-content panel + Unlock button for free previews
│       │   │   ├── DemoNotice.tsx          # "Illustrative example — not your data" label
│       │   │   ├── FindingsTable.tsx       # Severity badges, rule IDs, click-to-cite action
│       │   │   ├── CitationDrawer.tsx      # Flyout showing exact source snippet, line, and file
│       │   │   ├── FixPromptCard.tsx       # One-click copyable remediation prompt block
│       │   │   └── PaywallModal.tsx        # Reusable Stripe checkout modal (per-job & monthly tiers)
│       │   └── lib/
│       │       ├── types.ts                # Shared Finding, Citation, Report, Run, and Ingest schemas
│       │       ├── supabase.ts             # Lazy browser Supabase client + getAccessToken()
│       │       ├── auth.tsx                # AuthProvider / useAuth (magic link, GitHub, sign out)
│       │       ├── billing.tsx             # BillingProvider / useBilling (live plan, paywall state)
│       │       ├── api.ts                  # API client: Bearer JWT, ApiError, ingest + delete, NEXT_PUBLIC_USE_MOCK toggle
│       │       └── mockData.ts             # Realistic synthetic sample outputs for all 4 tools
│       ├── package.json
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       └── next.config.js
├── services/
│   └── api/                                # FastAPI Backend (Python 3.11+)
│       ├── app/
│       │   ├── main.py                     # FastAPI entry point + CORS + body-size limits + startup config checks
│       │   ├── core/
│       │   │   ├── schemas.py              # Pydantic v2 schemas (Finding, Citation, Report, Ingest*)
│       │   │   ├── engine.py               # Shared pipeline: RulePack -> Explain -> Redact -> Store (unless ephemeral)
│       │   │   ├── explainer.py            # Engine 2 LLM layer (mock / live Gemini/OpenAI)
│       │   │   ├── config.py               # ENVIRONMENT / boolean env helpers
│       │   │   ├── auth.py                 # Supabase JWT verification + get_current_user dependency
│       │   │   ├── storage.py              # BaseReportStorage + PostgresReportRepository (user_id-scoped SQL)
│       │   │   ├── redaction.py            # mask_secret / redact_secrets / safe_snippet / redact_report
│       │   │   ├── ingestion.py            # ZIP, tar.gz, YAML, CSV/XLSX, PDF parsing + safe GitHub fetch + limits
│       │   │   ├── middleware.py           # BodySizeLimitMiddleware (413 on oversized/streamed bodies)
│       │   │   ├── db.py                   # Shared SQLAlchemy engine + reports / entitlements / stripe_events tables
│       │   │   ├── entitlements.py         # Tier, scan credits, free preview: atomic spend, idempotent grants
│       │   │   ├── preview.py              # Server-side free-preview cut of a report
│       │   │   ├── ratelimit.py            # slowapi limiter, forge-proof client IP, anonymous visitor id
│       │   │   └── billing.py              # Stripe Checkout + signed webhook -> entitlements (mock mode: dev only)
│       │   ├── rules/
│       │   │   ├── base.py                 # Abstract BaseRulePack interface
│       │   │   ├── launchgate.py           # Regex secret scan, Supabase/Firebase RLS, packages
│       │   │   ├── agentscope.py           # MCP JSON/YAML parser, wildcard & root mount audit
│       │   │   ├── evidence.py             # Policy parser, deterministic matcher, gap flagger
│       │   │   └── evalkit.py              # Prompt injection runner & canary exfiltration test
│       │   └── routers/
│       │       ├── scans.py                # POST /run/{product} + GET/DELETE /reports/{id} + GET /reports (owner-scoped)
│       │       ├── ingest.py               # POST /api/v1/ingest/upload + /ingest/github
│       │       └── billing.py              # POST /api/v1/billing/checkout + /webhook
│       ├── migrations/
│       │   ├── 001_reports.sql             # public.reports table, index, Row Level Security policies
│       │   └── 002_entitlements.sql        # public.entitlements + public.stripe_events (RLS on, no policies)
│       ├── tests/
│       │   ├── conftest.py                 # In-memory DB + synthetic JWT fixtures
│       │   ├── test_api.py                 # Pytest test suite covering all 4 tools & billing
│       │   ├── test_auth_isolation.py      # Token validation, per-user isolation, delete, zero-retention
│       │   ├── test_storage.py             # Repository ownership guarantees
│       │   ├── test_redaction.py           # Secret masking in snippets, responses, storage, logs
│       │   ├── test_ingest.py              # Upload limits, zip-slip, bombs, formats, GitHub fetch safety
│       │   ├── test_billing.py             # Entitlement store, webhook signatures + idempotency, checkout
│       │   ├── test_freemium.py            # Preview vs full vs 402, per-IP previews, refunds
│       │   ├── test_explainer.py           # Gemini path: validation, fallback, determinism
│       │   └── test_rate_limit.py          # Limits, client IP resolution, CORS lock-down
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
# First run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
# (Windows: .venv\Scripts\activate)
source .venv/bin/activate
# The API fails closed: with ENVIRONMENT unset it runs as production and refuses to start
# without auth, Stripe, CORS, and database settings. For local development copy the template
# once (cp ../../.env.example ../../.env); it sets ENVIRONMENT=development, which gives:
# auth off (requests run as "local-dev-user"), mock billing, reports in ./data/trustcore.db (SQLite).
# Run server (same as `npm run dev:api` from the repo root)
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --env-file ../../.env
# Running on http://localhost:8000
# OpenAPI Docs: http://localhost:8000/docs
```

### Run Backend Pytest Suite
```bash
cd services/api
.venv/bin/pytest tests/
# Result: 296 passed (in-memory SQLite, no network: Stripe and Gemini calls are replaced by fakes)
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
| **Paywall & Billing** | **WIRED — needs Stripe keys** | Entitlements (tier, credits, free preview) are stored in Postgres and granted only by signed Stripe webhooks. `MOCK_BILLING=true` is the development default and is refused outside development. Not yet exercised against live Stripe. |
| **Freemium Gate** | **WIRED & LIVE** | Enforced in the API: one free preview (score + top 2 findings), full report with a credit or subscription, `402` otherwise. The UI shows locked panels and the paywall. |
| **API Mock Toggle** | **WIRED & LIVE** | `NEXT_PUBLIC_USE_MOCK=true` serves labelled demo data. With `false` the app never shows sample data as a result: failures surface as an error banner with Retry. |
| **Rate Limiting & CORS** | **WIRED & LIVE** | 10 requests/minute per IP on scan and ingest routes; CORS origins come only from `CORS_ORIGINS`. |
| **Engine 1 Rule Engine** | **WIRED & LIVE** | Real deterministic regex secret scanning, Supabase/Firebase RLS rules, package audits, MCP JSON permission parsing, policy keyword matching, and canary exfiltration test harness. |
| **Engine 2 LLM Layer** | **WIRED — needs `GEMINI_API_KEY`** | Deterministic synthesis by default. With `LLM_EXPLAINER_PROVIDER=gemini` the model rewrites the summary and fix prompts from the verified findings; its answer is validated and discarded on any doubt or timeout. Not yet exercised against the live Gemini API. |
| **Auth (Supabase)** | **WIRED — needs project keys** | Email magic link + GitHub OAuth in the web app; API verifies the Bearer JWT. Not yet exercised against a live Supabase project. Off by default in development. |
| **Per-User Report Storage** | **WIRED — needs `DATABASE_URL`** | `PostgresReportRepository` filters every query by `user_id`. Tests run it on SQLite; the Postgres path has not been run against a live database. |
| **Zero-Retention Mode** | **WIRED & LIVE** | `ephemeral: true` returns the report without persisting anything. Toggle on all four product pages. |
| **Secret Redaction** | **WIRED & LIVE** | LaunchGate and AgentScope mask secrets in every citation snippet; the engine re-checks every report before return/storage. |
| **File Ingestion** | **WIRED & LIVE** | `POST /ingest/upload` and `POST /ingest/github`; `FileDropzone` uses them on all four pages (requires `NEXT_PUBLIC_USE_MOCK=false`). |

---

## 4. API Endpoints & JSON Schemas

### Endpoints
- `GET /health` / `GET /api/v1/health`: Server health, dual-engine status, billing mode.
- `POST /api/v1/run/{product}` (sign-in optional, rate limited): Execute scan for `launchgate`, `agentscope`, `evidence`, or `evalkit`. Returns a full `Report` for paying callers, one free preview otherwise, then `402` (see §7.2). Stored for signed-in callers unless `ephemeral: true`.
- `GET /api/v1/reports/{id}` 🔒: Retrieve one of the caller's reports. `404` if missing **or owned by someone else**.
- `GET /api/v1/reports?limit=1..100` 🔒: List the caller's recent reports.
- `DELETE /api/v1/reports/{id}` 🔒: Permanently delete one of the caller's reports. `204`, or `404` if missing/not owned.
- `POST /api/v1/ingest/upload` (sign-in optional, rate limited): `multipart/form-data` with repeated `files` and optional `product`. Returns `IngestResponse`. `413` over 15 MB, `415` unsupported/binary, `400` corrupt archive or path traversal.
- `POST /api/v1/ingest/github` (sign-in optional, rate limited): JSON `{ "repo_url": "https://github.com/owner/repo", "ref": "main" }`. Returns `IngestResponse`. `404` missing/private, `413` archive over 15 MB.
- `GET /api/v1/samples/{product}`: Return preloaded realistic sample files for instant UI testing.
- `GET /api/v1/samples/{product}/report`: Full report produced by the real engine from those sample files (`metadata.is_sample = true`). Public, cached in memory, never stored, spends nothing. Backs the landing page's "Try Live Sample Audit".

🔒 = requires `Authorization: Bearer <Supabase access token>` whenever auth is required (see §6); `401` otherwise.
- `POST /api/v1/billing/checkout`: Create a Stripe Checkout Session (`per_scan`, `pro_monthly`, `enterprise_monthly`) bound to the caller. Live billing requires sign-in (`401`); `400` for a redirect URL off the web origin; `503` if Stripe is unavailable.
- `POST /api/v1/billing/webhook`: Verifies `Stripe-Signature`, then grants credits or updates the subscription (see §7.3). `400` on a bad signature.
- `GET /api/v1/billing/status`: Caller's `tier`, `credits_remaining`, `subscription_active`, `free_preview_available`, `can_run_full_scan`, `is_mock`. Works signed out.

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

- **`ScanRequest`** (Phase 2A adds `ephemeral`):
  ```typescript
  {
    product: ProductType;
    project_name: string;
    files: { filename: string; content: string; file_type?: string }[];
    raw_content?: string;
    options?: Record<string, any>;
    ephemeral?: boolean;   // Zero-Retention Mode. Response has metadata.ephemeral === true and is never stored.
  }
  ```
- **`IngestResponse`** (both ingest endpoints):
  ```typescript
  {
    source: string;                               // "upload" | "github:<owner>/<repo>@<ref>"
    files: ScanInputFile[];                       // pass straight to POST /run/{product}
    skipped: { path: string; reason: string }[];  // first 50 skipped entries
    skipped_count: number;
    total_bytes: number;
    truncated: boolean;                           // a file-count or size limit dropped input
  }
  ```
  `reason` is one of `excluded_directory`, `binary`, `too_large`, `file_limit`, `size_limit`, `not_a_regular_file`, `encrypted`.
  `file_type` is `questionnaire` for `.csv`/`.xlsx`, `policy_doc` for `.pdf` (and `.md`/`.txt` under `product=evidence`), `yaml` for YAML, otherwise the file extension.

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
   - The image sets `ENVIRONMENT=production`: the API refuses to start without auth and `DATABASE_URL` (see §6).

---

## 6. Phase 2A — Auth, Per-User Isolation, Secret Redaction, Ingestion

### 6.1 Environment Variables

**API (`services/api`)**

| Variable | Default | Purpose |
|---|---|---|
| `ENVIRONMENT` | `production` when unset | Only `development`/`dev`/`local`/`test` relax anything (optional auth, mock billing, SQLite, localhost CORS). Unset, blank, or any other value is strict, so a deployment that forgets the variable fails closed. |
| `AUTH_REQUIRED` | `true` outside development | Force auth on or off. Any value other than `0`/`false`/`no`/`off` means on. With auth off, unauthenticated requests run as the single user `local-dev-user`. |
| `SUPABASE_URL` | — | `https://<ref>.supabase.co`. Enables ES256/RS256 verification against `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` and pins the token issuer. |
| `SUPABASE_JWT_SECRET` | — | Legacy HS256 projects only (Supabase Dashboard → Settings → API → JWT Secret). |
| `SUPABASE_JWT_AUDIENCE` | `authenticated` | Expected `aud` claim. |
| `DATABASE_URL` | SQLite file in development | Postgres/Supabase connection string (`postgres://` and `postgresql://` are accepted). **Required outside development.** |
| `DB_AUTO_CREATE` | `false` | Create the `reports` table on a non-SQLite database at startup. Skips RLS; do not use on Supabase. |

Removed: `STORAGE_TYPE`, `STORAGE_DIR` (file-based JSON storage no longer exists).

Startup fails with a clear error when auth is required but neither `SUPABASE_URL` nor `SUPABASE_JWT_SECRET` is set, when `DATABASE_URL` is missing outside development, or when the `reports` table is missing on Postgres.

**Web (`apps/web`)**

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | — | Supabase project URL for the browser client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Supabase anon (publishable) key. With either unset, the app runs without sign-in. |
| `NEXT_PUBLIC_USE_MOCK` | `true` (set in `next.config.js`) | **Must be `false`** for real uploads, GitHub ingestion, auth, and stored reports. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API base URL. |

### 6.2 Supabase Setup

1. Authentication → Providers: enable **Email** (magic link) and **GitHub** (OAuth app client ID/secret).
2. Authentication → URL Configuration: add `https://<web-origin>/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs.
3. SQL editor: run `services/api/migrations/001_reports.sql`.
4. Set the API and web variables above. Add the web origin to `CORS_ORIGINS`.

### 6.3 Database Schema (`services/api/migrations/001_reports.sql`)

```sql
create table public.reports (
    id          text primary key,           -- rpt_<prod>_<24 hex chars>
    user_id     text not null,              -- Supabase auth.users.id (JWT "sub")
    product     text not null,              -- launchgate | agentscope | evidence | evalkit
    title       text not null,
    created_at  timestamptz not null default now(),
    payload     jsonb not null              -- full Report document (secrets already redacted)
);
create index ix_reports_user_created on public.reports (user_id, created_at desc);
alter table public.reports enable row level security;
-- policies: authenticated users may SELECT and DELETE rows where auth.uid()::text = user_id; anon has no access
```

The API filters every statement by `user_id`; RLS is a second layer that keeps the table closed to Supabase's public REST API. Uploaded files are never stored: only the redacted `Report` is.

### 6.4 Security Controls

- **Isolation:** read, list, and delete all match on `id` **and** `user_id`. A report ID that belongs to another user returns `404`, the same as a missing one. Report IDs carry 96 random bits.
- **Zero-Retention Mode:** `ephemeral: true` skips persistence entirely. The report exists only in the response, so its "View Full Report" link is hidden in the UI.
- **Secret redaction:** values are masked as first 4 + `****` + last 4 characters (`sk-p****2c1d`); values under 16 characters reveal less, under 8 nothing. LaunchGate and AgentScope redact every snippet at creation; the engine runs a second pass over every report (snippets, descriptions, answers, remediation prompts) before it is returned or stored. Logs contain product names, counts, and report IDs only.
- **Ingestion limits** (constants in `app/core/ingestion.py`):

  | Limit | Value |
  |---|---|
  | Upload request / GitHub archive download | 15 MB |
  | Single archive member | 1 MB (larger members are skipped) |
  | Extracted files per request | 500 |
  | Total extracted text | 15 MB |
  | Decompressed bytes per archive | 100 MB |
  | PDF pages / spreadsheet rows | 300 / 20,000 |
  | YAML config normalised for AgentScope | 256 KB, nesting depth 64, no aliases |

  Archives are read in memory and never extracted to disk. An archive containing an absolute or `..` path is rejected whole. `node_modules`, `.git`, `.next`, virtualenvs, caches, symlinks, and binary files are skipped. Uploads are held in memory rather than spooled to a temp file.
- **GitHub fetch:** only `https://github.com/<owner>/<repo>[/tree/<ref>]` is accepted. The server rebuilds the archive URL from the validated owner, repo, and ref, follows redirects only to `github.com` / `codeload.github.com`, and sends no credentials, so only public repositories are reachable.
- **Request size:** 16 MB on the upload route, 32 MB elsewhere, enforced on streamed bodies as well as `Content-Length`.
- **Hostile input cost:** scan lines are attacker-controlled and can be megabytes long, so the redaction patterns and LaunchGate's rules are written to run in linear time (regression tests feed them 600 KB–1 MB single lines), and each citation snippet redacts at most ~4.6 KB of its line. Keep new rule regexes linear: avoid `.*` between two repeated literals.

### 6.5 Known Gaps

- **Not verified against live services.** Auth has not been run against a real Supabase project, the repository has not been run against real Postgres, and the new UI flows (sign-in, upload, delete) have not been clicked through in a browser. Automated tests cover the API on SQLite with synthetic tokens.
- **Questionnaires do not drive the Evidence matrix yet.** Uploaded `.csv`/`.xlsx` questionnaires are parsed and kept out of the evidence corpus, but the controls checked are still the built-in `STANDARD_CONTROLS`.
- **YAML line numbers.** YAML configs uploaded for AgentScope are normalised to JSON so the rules apply; citation line numbers refer to the normalised JSON, not the original file.
- **Billing is not per-user.** `/api/v1/billing/*` is unauthenticated and returns one global status.
- **Text encoding.** Files that are not UTF-8 (or BOM-marked UTF-16) are treated as binary and skipped.
- **GitHub rate limits** apply per server egress IP because fetches are unauthenticated.
- **Bundle size.** `@supabase/supabase-js` adds about 67 kB gzipped to every route; product pages now ship about 180–184 kB gzipped JS.

### 6.6 Benchmarks

`.ecc/benchmarks/phase2a-api-2026-11-23.json` records in-process API latency before and after Phase 2A (100 requests per endpoint, then 10 concurrent workers). With auth on, against the SQLite development backend (Postgres was not measured):

| | Before (`a8dd682`) | After |
|---|---|---|
| `POST /run/*` p50 | 3.8–4.0 ms | 3.7–4.4 ms |
| `GET /reports/{id}` p50 | 3.0 ms | 4.8 ms |
| `GET /reports?limit=20` p50 | 3.2 ms | 7.4 ms |
| 10 concurrent scans | 161 rps, p99 89 ms | 134 rps, p99 149 ms |
| `POST /ingest/upload` (400-entry zip) p50 | — | 18 ms |

These figures predate Phase 2B (entitlement check per scan, rate limiter) and were not re-measured.

---

## 7. Phase 2B — Payments, Freemium Gate, Live Engine 2, Rate Limiting

### 7.1 Environment Variables

**API (`services/api`)**

| Variable | Default | Purpose |
|---|---|---|
| `MOCK_BILLING` | `true` in development, `false` elsewhere | Mock mode unlocks every scan and takes no payment. **The API refuses to start with it on outside development.** |
| `STRIPE_SECRET_KEY` | — | Stripe secret key. Required outside development; the `sk_test_mock…` placeholder is rejected. |
| `STRIPE_WEBHOOK_SECRET` | — | Signing secret of the webhook endpoint (`whsec_…`). Required outside development; the public `whsec_mock…` placeholder is rejected. |
| `STRIPE_ALLOW_TEST_MODE` | `false` | Outside development a test-mode key (`sk_test_…`) stops startup, because test cards would unlock paid scans. Set `true` only for a non-public staging environment. |
| `STRIPE_PRICE_ID_PER_SCAN` / `_PRO` / `_ENTERPRISE` | — | Stripe Price IDs. Checkout answers `503` for a tier whose price is unset. |
| `STRIPE_PER_SCAN_CREDITS` | `1` | Scan credits granted per completed per-scan checkout. |
| `LLM_EXPLAINER_PROVIDER` | `mock` | `mock` (deterministic) or `gemini`. |
| `GEMINI_API_KEY` | — | Enables the live explainer together with `LLM_EXPLAINER_PROVIDER=gemini`. |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Model ID. |
| `GEMINI_TIMEOUT_SECONDS` | `8` | Hard deadline for the model call. |
| `CORS_ORIGINS` | localhost in development | Exact web origins, comma separated. **Required outside development.** `*`, paths, and non-https origins (except localhost) stop startup. |
| `RATE_LIMIT_SCAN` / `RATE_LIMIT_INGEST` | `10/minute` | Per-IP limits for `/api/v1/run/*` and `/api/v1/ingest/*`. |
| `RATE_LIMIT_ENABLED` | `true` | Turn the limiter off (tests). |
| `RATE_LIMIT_STORAGE_URI` | in-memory | Shared counter store, e.g. `redis://…`. Needed for the limit to hold across several instances. |
| `TRUSTED_PROXY_HOPS` | `0` (the Docker image sets `1`) | Reverse proxies in front of the API. `0` uses the TCP peer; `N` uses the Nth address from the right of `X-Forwarded-For`. Too low and every visitor shares one limit and one free preview; too high and clients can forge their address. A non-integer value stops startup. **Verify per deployment:** `GET /health` from a normal client returns `forwarded_for_entries`, which is the value to set. Google documents two appended entries behind an external Application Load Balancer; the count for a plain `run.app` URL was not confirmed here. |
| `ANON_ID_SALT` | empty | Salt for the IP hash that identifies signed-out visitors. Set a random value in production. |

The web app needs no new variables.

### 7.2 Freemium Gate (enforced in `POST /api/v1/run/{product}`)

| Caller | Result |
|---|---|
| Active subscription (`pro_monthly`, `enterprise`) | Full report, unlimited. |
| At least one scan credit | Full report; one credit is spent. |
| Free preview unused (signed in or signed out) | Preview report; the preview is marked used. |
| None of the above | `402 Payment Required`. |

- A **preview** (`metadata.access = "preview"`) contains the full `summary` (score and counts), the executive summary, and the top 2 findings by severity with `citation.snippet = ""`, no line numbers, no finding metadata, and no fix prompt. `remediation_prompts` is empty and `permission_diff`, `evidence_matrix`, `eval_results` are `null`. `metadata.locked` reports `hidden_findings` and the locked `features`. The cut happens on the server, so the browser never receives locked content; the UI disables citations, fix prompts, detail views, and Markdown/JSON/PDF export for previews.
- Paying unlocks **new** scans. A stored preview stays a preview; re-run the scan for the full report.
- Signed-out visitors are identified by a salted hash of their IP (IPv6 addresses by their /64 prefix, so rotating addresses does not mint new previews). Their reports are never stored.
- `AUTH_REQUIRED=false` now stops startup outside development: with auth off every caller would be the same user and share one payment.
- A scan that fails returns the credit or preview it spent.
- Each spend is one conditional `UPDATE` (`… WHERE credits_remaining > 0`), so concurrent requests cannot double-spend.

### 7.3 Stripe Flow

1. `POST /billing/checkout` creates a Checkout Session with `client_reference_id` and `metadata.user_id` set to the caller, and `metadata.tier`. Nothing is granted here.
2. Stripe calls `POST /api/v1/billing/webhook`. The raw body is verified against `STRIPE_WEBHOOK_SECRET` (5-minute tolerance) before anything is read from it.
3. Events handled:
   - `checkout.session.completed` with `payment_status` `paid` / `no_payment_required`, and `checkout.session.async_payment_succeeded`: per-scan adds `STRIPE_PER_SCAN_CREDITS`; `pro_monthly` / `enterprise_monthly` set the tier and store the subscription id. Sessions with an unknown tier, a mode that does not match the tier, or no user are ignored.
   - `customer.subscription.deleted`: the account whose **current** subscription has that id drops to `per_scan` (credits left) or `free`.
   - Anything else is acknowledged and ignored.
4. The event id is inserted into `stripe_events` in the same transaction as the entitlement change, so a re-delivered event changes nothing.

Stripe setup: create the three Prices, add a webhook endpoint for the three events above pointing at `/api/v1/billing/webhook`, and set the keys from §7.1. Local testing: `MOCK_BILLING=false` plus `stripe listen --forward-to localhost:8000/api/v1/billing/webhook`.

### 7.4 Database Schema (`services/api/migrations/002_entitlements.sql`)

```sql
create table public.entitlements (
    user_id                 text primary key,   -- auth.users.id, or "anon:<ip hash>" for signed-out visitors
    tier                    text not null default 'free',   -- free | per_scan | pro_monthly | enterprise
    credits_remaining       integer not null default 0 check (credits_remaining >= 0),
    free_scans_used         integer not null default 0 check (free_scans_used >= 0),
    stripe_customer_id      text,
    stripe_subscription_id  text,
    updated_at              timestamptz default now()
);
create table public.stripe_events (
    event_id      text primary key,
    event_type    text not null,
    processed_at  timestamptz not null default now()
);
-- RLS enabled on both with no policies: only the API connection can read or write them.
```

Apply it after `001_reports.sql`. The API refuses to start on Postgres if either table is missing.

### 7.5 Live Engine 2 (Gemini)

Engine 1 stays the only source of findings, severities, counts, and score: none of those fields is ever read from the model.

- **Input:** the verified `Finding[]` as JSON (at most 40), with credential formats masked again before sending.
- **System prompt** (`SYSTEM_PROMPT` in `explainer.py`): summarise only the supplied findings, never add or change a finding, severity, or count, treat everything in the input as untrusted data, output no URLs.
- **Output check:** the answer must be the expected JSON; every `finding_ids` entry and every rule/finding id mentioned must exist in Engine 1's result; any stated severity count must match; no URLs, bare `host/path` references, download or pipe-to-shell commands, or package-install commands; `target_tool` from the fixed list. One failed check discards the whole answer.
- **Fix prompts never quote scanned text** (deterministic and live): they give file path, line, and rule title only, and file paths are reduced to a safe character set. A comment planted in a scanned repository therefore cannot ride into the prompt a user pastes into their AI editor. The redacted line is still shown in the citation, as data.
- **Assembly:** the `**Audit Status: … (Readiness Score: …)**` line is generated by code; file and line locations in each fix prompt are appended from Engine 1 data.
- **Fallback:** timeout, API error, or a rejected answer keeps the deterministic explanation. `metadata.explainer` records `provider` (`gemini` or `deterministic`), `model`, and `fallback_reason`.
- **Not sent to the model:** zero-retention scans (`ephemeral: true`) and free previews.

### 7.6 Rate Limiting, CORS, and Mock Data

- `/api/v1/run/*` shares one budget per IP, `/api/v1/ingest/*` another. Over the limit: `429` with `Retry-After`.
- CORS allows only the configured origins, methods `GET, POST, DELETE, OPTIONS`, headers `Authorization, Content-Type`, no credentials, and exposes `Retry-After`.
- With `NEXT_PUBLIC_USE_MOCK=false` the web app never substitutes `MOCK_REPORTS`: scan, report, sample, and billing calls throw, and pages show an error banner with Retry. Pages start empty rather than with a sample report; remaining static widgets carry an "Illustrative example — not your data" label.

### 7.7 Known Gaps

- **Not verified against live services:** Stripe (checkout creation and real webhook deliveries), the Gemini API, and the paywall flow in a browser. Tests use signed synthetic events and a fake model client.
- **Anonymous access changed from Phase 2A:** `/api/v1/run/*` and `/api/v1/ingest/*` no longer require sign-in. Stored-report routes still do.
- **One free preview per IP** for signed-out visitors: people behind one NAT share it, and a new IP gets a new one. A signed-in account gets its own preview as well.
- **Rate limits are per instance** unless `RATE_LIMIT_STORAGE_URI` is set.
- **Subscription changes other than deletion** (`customer.subscription.updated`, failed renewals) are not handled, and neither are refunds or disputes: a refunded per-scan purchase keeps its credit.
- **Subscription edge cases:** one subscription id is stored per account, so a second subscription replaces the first and cancelling it downgrades the account; and a `customer.subscription.deleted` delivered before its `checkout.session.completed` leaves the subscription active.
- **Local development needs `ENVIRONMENT=development`.** The service fails closed: unset means production, and unsafe combinations (`MOCK_BILLING=true`, `AUTH_REQUIRED=false`, placeholder or test Stripe keys, `CORS_ORIGINS=*`, missing auth/database/CORS settings) stop startup with a message naming the variable. `npm run dev:api` loads the repo-root `.env`; the API does not read `.env` on its own, so a bare `uvicorn app.main:app` needs the variables exported or `--env-file`.
- **Prompt injection is reduced, not eliminated:** a model answer that passes every check can still contain misleading prose. It cannot alter findings, severities, counts, or the score.

---

## 8. Phase 2C — Public Launch: Landing, Legal, Analytics, Deployment

### 8.1 Routes

| Route | Purpose |
|---|---|
| `/` | Public marketing landing page: value proposition, "Try Live Sample Audit", four-product grid, pricing. |
| `/sample` | Sample audit, no login. Shows `GET /api/v1/samples/{product}/report`; falls back to the built-in sample, with a note, if the API is unreachable or has not answered within 2.5 s. Always labelled as sample data. |
| `/security`, `/privacy`, `/terms` | Trust and legal pages. |
| `/dashboard` | The workspace hub (previously `/`). Stripe Checkout and sign-in return here (`/dashboard?billing=success`). |
| `/launchgate`, `/agentscope`, `/evidence`, `/evalkit`, `/reports/[id]`, `/login` | Unchanged. |

Pricing shown on the site: **Launch Audit $29** (tier `per_scan`), **Pro Builder $49/mo** (`pro_monthly`), **Done-For-You AI Readiness Sprint from $1,500** (contact). The amounts charged are whatever the Stripe Prices behind `STRIPE_PRICE_ID_*` say: create the Prices to match.

### 8.2 Analytics (Plausible, cookieless)

Off unless `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` is set. Events (`src/lib/analytics.ts`), each with enumerated properties only (product, tier, source, zero-retention flag) and never file names, contents, repo URLs, report ids, or emails:

| Event | Fired when |
|---|---|
| `sample_loaded` | A sample audit is shown on `/sample`, or a product page loads its sample. |
| `scan_started` | A scan request is sent. |
| `paywall_opened` | The paywall opens. |
| `checkout_completed` | The app is opened with `?billing=success` after Stripe Checkout. |

Add the four names as custom event goals in the Plausible site settings. `checkout_completed` reflects the browser returning from Checkout; Stripe remains the source of truth for payments.

### 8.3 Deploy the API to Cloud Run

Files: `deploy/cloud-run-deploy.sh`, `deploy/cloud-run.env.example.yaml`, `.github/workflows/deploy-api.yml` (manual trigger), `.github/workflows/ci.yml` (pytest + web build on push and pull request).

1. Apply `services/api/migrations/001_reports.sql` and `002_entitlements.sql` to the database.
2. Enable APIs and create the secrets (values via stdin):
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com --project "$PROJECT_ID"
   printf '%s' "$DATABASE_URL" | gcloud secrets create trustcore-database-url --data-file=- --project "$PROJECT_ID"
   printf '%s' "$STRIPE_SECRET_KEY" | gcloud secrets create trustcore-stripe-secret-key --data-file=- --project "$PROJECT_ID"
   printf '%s' "$STRIPE_WEBHOOK_SECRET" | gcloud secrets create trustcore-stripe-webhook-secret --data-file=- --project "$PROJECT_ID"
   openssl rand -hex 32 | gcloud secrets create trustcore-anon-id-salt --data-file=- --project "$PROJECT_ID"
   ```
   Grant the Cloud Run service account `roles/secretmanager.secretAccessor`.
3. `cp deploy/cloud-run.env.example.yaml deploy/cloud-run.env.yaml` (git-ignored) and replace every `YOUR-` / `REPLACE` value.
4. Deploy:
   ```bash
   PROJECT_ID=my-gcp-project REGION=us-central1 bash deploy/cloud-run-deploy.sh
   ```
   which runs exactly:
   ```bash
   gcloud run deploy trustcore-api \
     --project "$PROJECT_ID" --region "$REGION" \
     --source services/api --port 8000 --allow-unauthenticated \
     --memory 1Gi --cpu 1 --concurrency 20 --timeout 120 \
     --min-instances 0 --max-instances 4 \
     --env-vars-file deploy/cloud-run.env.yaml \
     --set-secrets "DATABASE_URL=trustcore-database-url:latest,STRIPE_SECRET_KEY=trustcore-stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=trustcore-stripe-webhook-secret:latest,ANON_ID_SALT=trustcore-anon-id-salt:latest"
   ```
   Add `WITH_GEMINI=1` (and `LLM_EXPLAINER_PROVIDER: "gemini"` in the env file, plus the `trustcore-gemini-api-key` secret) to enable the live explainer.
5. Verify:
   ```bash
   curl -s "$SERVICE_URL/health"
   ```
   - `environment` is `production`, `mock_billing` is `false`.
   - `forwarded_for_entries` equals `TRUSTED_PROXY_HOPS` in the env file. If not, fix the value and redeploy.
6. In Stripe, point the webhook endpoint at `$SERVICE_URL/api/v1/billing/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.deleted`, and store its signing secret as a new version of `trustcore-stripe-webhook-secret`.

The service refuses to start if anything required is missing; the revision log names the variable. With more than one instance, rate limits are per instance unless `RATE_LIMIT_STORAGE_URI` points at a shared store.

### 8.4 Deploy the web app to Vercel

Project settings: Root Directory `apps/web`, Framework Next.js, default build command. Environment variables (Production):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Cloud Run service URL (no trailing slash) |
| `NEXT_PUBLIC_USE_MOCK` | `false` — **required**; the build default is `true` (demo data) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `NEXT_PUBLIC_SITE_URL` | Public site origin, e.g. `https://trustcore.example` (canonical URLs, sitemap, robots) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact address shown on the legal pages and the sprint CTA |
| `NEXT_PUBLIC_LEGAL_ENTITY` | Legal name of the company operating the service |
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` | Plausible script URL from the site's installation snippet (omit to disable analytics) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Site domain as registered in Plausible, if the snippet uses `data-domain` |

`NEXT_PUBLIC_*` values are compiled into the bundle: redeploy after changing one. None of them is a secret.

After the first deploy: put the Vercel origin in `CORS_ORIGINS` (API), and in Supabase add `https://<web-origin>/auth/callback` to the redirect URLs.

### 8.5 Before Announcing

- **Legal text is a template.** `/privacy` and `/terms` (including the liability cap) need review by counsel, and the legal entity and contact address must be set.
- **Check the "no training on your data" statement against your LLM provider's terms** before enabling Gemini in production.
- **Nothing in §8.3–8.4 has been run:** the deploy script, both workflows, and the Vercel settings were written without access to Google Cloud, GitHub Actions, or Vercel. CI targets Python 3.11; the suite was run locally on 3.13.
- Confirm `TRUSTED_PROXY_HOPS` (step 5 above), the Stripe Prices against the displayed prices, and one real test purchase end to end.
- **Checked locally in a browser (desktop width):** the landing page, `/sample` against the running API (real engine report, HTTP 200 in 45 ms) and with the API stopped (labelled built-in sample), `/dashboard`, and `/terms`. **Not exercised:** sign-in, uploads, the paywall and checkout, analytics delivery to Plausible, and mobile widths.
- `checkout_completed` fires again if the `?billing=success` URL is reloaded, and carries no tier.
- Local preview: `.claude/launch.json` starts the web app and the API (the API loads `.env.example` for development settings).
