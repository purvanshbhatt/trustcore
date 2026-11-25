import {
  ProductType,
  ScanRequest,
  ScanInputFile,
  Report,
  IngestResponse,
  BillingCheckoutRequest,
  BillingCheckoutResponse,
  BillingStatusResponse,
  BillingTier,
} from './types';
import { MOCK_REPORTS } from './mockData';
import { getAccessToken } from './supabase';
import { track } from './analytics';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

const PRODUCTS: readonly ProductType[] = ['launchgate', 'agentscope', 'evidence', 'evalkit'];
const BILLING_TIERS: readonly BillingTier[] = ['free', 'per_scan', 'pro_monthly', 'enterprise'];

/** Hard cap enforced by POST /api/v1/ingest/upload (whole request). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const API_UNREACHABLE = 'TrustCore API is unreachable. Check that the API is running, then retry.';

/**
 * Why a report is demo data: `mock_mode` when NEXT_PUBLIC_USE_MOCK=true, `sample`
 * for the built-in sample report. Live mode never substitutes demo data for a
 * failed request.
 */
type MockReason = 'mock_mode' | 'sample';

/** HTTP error returned by the TrustCore API. `status` is 0 when the API could not be reached. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  /** Seconds to wait before retrying, from the `Retry-After` header (429 responses). */
  readonly retryAfterSeconds: number | null;

  constructor(status: number, detail: string, retryAfterSeconds: number | null = null) {
    super(detail);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Error shape rendered by the UI. `status` is null for non-HTTP failures. */
export interface UiError {
  readonly status: number | null;
  readonly message: string;
  readonly retryAfterSeconds?: number | null;
}

export function toUiError(err: unknown): UiError {
  if (err instanceof ApiError) {
    return { status: err.status, message: err.detail, retryAfterSeconds: err.retryAfterSeconds };
  }
  if (err instanceof Error) {
    return { status: null, message: err.message };
  }
  return { status: null, message: 'Unexpected error.' };
}

export interface SampleData {
  project_name?: string;
  files?: ScanInputFile[];
}

export function isMockEnabled(): boolean {
  return USE_MOCK;
}

/** True for built-in sample reports and mock-mode reports; these never exist server-side. */
export function isDemoReport(report: Report): boolean {
  if (report.metadata?.is_mock === true) {
    return true;
  }
  return PRODUCTS.some((product) => MOCK_REPORTS[product].id === report.id);
}

async function authHeaders(base: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : { ...base };
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === 'string' && detail.length > 0) {
        return detail;
      }
      if (Array.isArray(detail)) {
        // FastAPI validation errors: [{ loc, msg, type }]
        const messages = detail
          .map((item: unknown) =>
            typeof item === 'object' && item !== null && 'msg' in item
              ? String((item as { msg: unknown }).msg)
              : ''
          )
          .filter((msg) => msg.length > 0);
        if (messages.length > 0) {
          return messages.join('; ');
        }
      }
    }
  } catch {
    // Non-JSON error body: fall through to the generic message.
  }
  return `Request failed with HTTP ${res.status}`;
}

/** Parse `Retry-After` (delta-seconds or an HTTP date) into whole seconds. */
function parseRetryAfter(res: Response): number | null {
  const raw = res.headers.get('Retry-After');
  if (raw === null || raw.trim() === '') {
    return null;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds);
  }
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }
  return null;
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  return new ApiError(res.status, await readErrorDetail(res), parseRetryAfter(res));
}

/** fetch() against the API; a network failure becomes `ApiError(0)` instead of demo data. */
async function apiFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError(0, API_UNREACHABLE);
  }
}

function buildMockScanReport(request: ScanRequest): Report {
  const mock = MOCK_REPORTS[request.product];
  const reason: MockReason = 'mock_mode';
  return {
    ...mock,
    id: `rpt_${request.product}_${Date.now()}`,
    title: `${request.project_name || 'Project'} — Security & Readiness Audit`,
    created_at: new Date().toISOString(),
    metadata: {
      ...mock.metadata,
      is_mock: true,
      mock_reason: reason,
      ...(request.ephemeral ? { ephemeral: true } : {}),
    },
  };
}

function findBuiltInSampleReport(reportId: string): Report | null {
  for (const product of PRODUCTS) {
    if (MOCK_REPORTS[product].id === reportId) {
      const reason: MockReason = 'sample';
      const sample = MOCK_REPORTS[product];
      return { ...sample, metadata: { ...sample.metadata, is_mock: true, mock_reason: reason } };
    }
  }
  return null;
}

function buildMockReportForId(reportId: string): Report {
  // Mock scan ids look like `rpt_<product>_<timestamp>`; default to the LaunchGate demo.
  const product = PRODUCTS.find((p) => reportId.startsWith(`rpt_${p}_`)) ?? 'launchgate';
  const mock = MOCK_REPORTS[product];
  const reason: MockReason = 'mock_mode';
  return {
    ...mock,
    id: reportId,
    metadata: { ...mock.metadata, is_mock: true, mock_reason: reason },
  };
}

export async function checkApiHealth(): Promise<boolean> {
  if (USE_MOCK) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Run a scan. Demo data is served only when NEXT_PUBLIC_USE_MOCK=true, and is
 * always flagged with `metadata.is_mock`. In live mode every failure — network
 * or HTTP (401, 402, 413, 422, 429, ...) — throws ApiError; sample findings are
 * never returned in place of the caller's own results.
 */
export async function runScan(request: ScanRequest): Promise<Report> {
  if (USE_MOCK) {
    console.info(`[TrustCore] NEXT_PUBLIC_USE_MOCK=true: Serving instant mock report for ${request.product}`);
    return buildMockScanReport(request);
  }

  // Enumerated values only: never the project name, file names or contents.
  track('scan_started', { product: request.product, zero_retention: request.ephemeral === true });
  const res = await apiFetch(`/api/v1/run/${request.product}`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
  return (await res.json()) as Report;
}

/**
 * Fetch a report owned by the signed-in user. The built-in sample report ids
 * resolve to the labelled sample; in live mode every other failure throws ApiError.
 */
export async function getReport(reportId: string): Promise<Report> {
  const sample = findBuiltInSampleReport(reportId);
  if (sample !== null) {
    return sample;
  }
  if (USE_MOCK) {
    return buildMockReportForId(reportId);
  }

  const res = await apiFetch(`/api/v1/reports/${encodeURIComponent(reportId)}`, {
    method: 'GET',
    cache: 'no-store',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
  return (await res.json()) as Report;
}

/** Permanently delete a report owned by the signed-in user. */
export async function deleteReport(reportId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/reports/${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
}

/**
 * Upload files to the real ingestion endpoint (multipart/form-data, 15 MB cap).
 * Never falls back to mock data.
 */
export async function ingestUpload(files: File[], product?: ProductType): Promise<IngestResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file, file.name);
  }
  if (product) {
    form.append('product', product);
  }

  // No explicit Content-Type: the browser sets the multipart boundary.
  const res = await apiFetch('/api/v1/ingest/upload', {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  });
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
  return (await res.json()) as IngestResponse;
}

/** Fetch a public GitHub repository through the ingestion endpoint. Never falls back to mock data. */
export async function ingestGithub(repoUrl: string, ref?: string): Promise<IngestResponse> {
  const trimmedRef = ref?.trim();
  const payload: { repo_url: string; ref?: string } = { repo_url: repoUrl.trim() };
  if (trimmedRef) {
    payload.ref = trimmedRef;
  }

  const res = await apiFetch('/api/v1/ingest/github', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
  return (await res.json()) as IngestResponse;
}

function mockSampleData(product: ProductType): SampleData {
  return {
    project_name: `Sample ${product.toUpperCase()} Project`,
    files: [
      {
        filename: `${product}_sample_config.json`,
        content: JSON.stringify(MOCK_REPORTS[product], null, 2),
      },
    ],
  };
}

/**
 * Sample scan inputs from GET /api/v1/samples/{product}. In live mode a failure
 * throws ApiError; only mock mode falls back to a locally built sample.
 */
export async function getSampleData(product: ProductType): Promise<SampleData> {
  if (USE_MOCK) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/samples/${product}`, { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        return (await res.json()) as SampleData;
      }
    } catch {
      // Mock mode: fall through to the local sample.
    }
    return mockSampleData(product);
  }

  const res = await apiFetch(`/api/v1/samples/${product}`, {
    method: 'GET',
    cache: 'no-store',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
  return (await res.json()) as SampleData;
}

/** How long the live sample report may take before the caller falls back to the built-in one. */
const SAMPLE_REPORT_TIMEOUT_MS = 2500;

/** The built-in sample report for a product, flagged as sample data. */
export function getBuiltInSampleReport(product: ProductType): Report {
  const sample = MOCK_REPORTS[product];
  const reason: MockReason = 'sample';
  return { ...sample, metadata: { ...sample.metadata, is_mock: true, mock_reason: reason, is_sample: true } };
}

function isReportPayload(value: unknown, product: ProductType): value is Report {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { product?: unknown; summary?: unknown; findings?: unknown };
  return (
    candidate.product === product &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null &&
    Array.isArray(candidate.findings)
  );
}

/**
 * Public sample audit from GET /api/v1/samples/{product}/report (no auth): a full
 * report the real engine produced from a bundled demo app, flagged
 * `metadata.is_sample`. Mock mode returns the built-in sample. In live mode a
 * failure, a timeout or a malformed payload throws; a caller that must always
 * render (the /sample page) then shows `getBuiltInSampleReport`, which is
 * labelled sample data either way.
 */
export async function getSampleReport(product: ProductType): Promise<Report> {
  if (USE_MOCK) {
    return getBuiltInSampleReport(product);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SAMPLE_REPORT_TIMEOUT_MS);
  try {
    const res = await apiFetch(`/api/v1/samples/${product}/report`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw await errorFromResponse(res);
    }
    const body: unknown = await res.json();
    if (!isReportPayload(body, product)) {
      throw new ApiError(res.status, 'The sample report response was not a valid report.');
    }
    return { ...body, metadata: { ...body.metadata, is_sample: true } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Start a Stripe Checkout session. `success_url` / `cancel_url` stay on this app's
 * origin. In live mode there is no simulated success: 401 (sign-in required), 400
 * and 503 surface as ApiError.
 */
export async function createCheckout(tier: BillingCheckoutRequest['tier']): Promise<BillingCheckoutResponse> {
  if (USE_MOCK) {
    return {
      checkout_url: '/dashboard?billing=mock_success',
      session_id: `cs_mock_${Date.now()}`,
      is_mock: true,
      message: `Mock checkout initiated for ${tier}. Plan activated.`,
    };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const body: BillingCheckoutRequest = {
    tier,
    success_url: `${origin}/dashboard?billing=success`,
    cancel_url: `${origin}/dashboard?billing=cancelled`,
  };
  const res = await apiFetch('/api/v1/billing/checkout', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
  return (await res.json()) as BillingCheckoutResponse;
}

const MOCK_BILLING_STATUS: BillingStatusResponse = {
  tier: 'pro_monthly',
  credits_remaining: 15,
  is_mock: true,
  subscription_active: true,
  free_preview_available: false,
  can_run_full_scan: true,
};

/** Coerce the API payload so a missing or unknown field can never render as invented credit. */
function normalizeBillingStatus(raw: unknown): BillingStatusResponse {
  const data = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const tier = BILLING_TIERS.find((candidate) => candidate === data.tier) ?? 'free';
  const credits =
    typeof data.credits_remaining === 'number' && Number.isFinite(data.credits_remaining)
      ? Math.max(0, Math.floor(data.credits_remaining))
      : 0;
  const subscriptionActive = data.subscription_active === true;
  return {
    tier,
    credits_remaining: credits,
    is_mock: data.is_mock === true,
    subscription_active: subscriptionActive,
    free_preview_available: data.free_preview_available === true,
    can_run_full_scan:
      typeof data.can_run_full_scan === 'boolean' ? data.can_run_full_scan : subscriptionActive || credits > 0,
  };
}

/**
 * The caller's plan, credits and free-preview availability (works signed out).
 * In live mode a failure throws ApiError; no plan or credit balance is invented.
 */
export async function getBillingStatus(): Promise<BillingStatusResponse> {
  if (USE_MOCK) {
    return MOCK_BILLING_STATUS;
  }

  const res = await apiFetch('/api/v1/billing/status', {
    method: 'GET',
    cache: 'no-store',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    throw await errorFromResponse(res);
  }
  return normalizeBillingStatus(await res.json());
}
