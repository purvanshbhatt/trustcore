/**
 * Cookieless product analytics (PostHog HTTP capture API, no SDK).
 *
 * Only five product events exist, and their properties are small enumerated
 * values. Never pass file names, file contents, repository URLs, report ids or
 * email addresses: the types forbid it and `sanitizeProps` drops anything that
 * is not on the allow-lists below.
 *
 * Events are not tied to a page: no page views, URLs or referrers are sent. The
 * only identifier is a random per-tab id kept in `sessionStorage` (in memory when
 * storage is unavailable). No cookie or `localStorage` entry is ever written, and
 * `$process_person_profile: false` keeps PostHog from creating a person profile.
 */
import type { ProductType } from './types';

export type AnalyticsEvent =
  | 'sample_loaded'
  | 'scan_started'
  | 'preview_locked'
  | 'paywall_opened'
  | 'checkout_completed';

export type AnalyticsTier = 'per_scan' | 'pro_monthly';

/** Where the paywall was opened from. */
export type PaywallSource = 'sidebar' | 'header' | 'preview_panel' | 'locked_section' | 'upgrade_required';

/** Where a sample was loaded. */
export type SampleSource = 'sample_page' | 'product_page';

export type AnalyticsSource = PaywallSource | SampleSource;

export interface AnalyticsProps {
  readonly product?: ProductType;
  readonly tier?: AnalyticsTier;
  readonly source?: AnalyticsSource;
  readonly zero_retention?: boolean;
}

type CaptureProperties = Record<string, string | boolean>;

/** Body of PostHog's single-event capture request (https://posthog.com/docs/api/capture). */
interface CapturePayload {
  readonly api_key: string;
  readonly event: AnalyticsEvent;
  readonly distinct_id: string;
  readonly properties: CaptureProperties;
  readonly timestamp: string;
}

/** PostHog project token. Analytics is off (and `track` is a complete no-op) when this is empty. */
const POSTHOG_KEY: string = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? '';

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

/** PostHog ingestion host, without a trailing slash. */
const POSTHOG_HOST: string = (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST).replace(
  /\/+$/,
  ''
);

/** Single-event capture endpoint: `POST {host}/i/v0/e/`. */
const CAPTURE_PATH = '/i/v0/e/';

const EVENTS: readonly string[] = [
  'sample_loaded',
  'scan_started',
  'preview_locked',
  'paywall_opened',
  'checkout_completed',
];
const PRODUCTS: readonly string[] = ['launchgate', 'agentscope', 'evidence', 'evalkit'];
const TIERS: readonly string[] = ['per_scan', 'pro_monthly'];
const SOURCES: readonly string[] = [
  'sidebar',
  'header',
  'preview_panel',
  'locked_section',
  'upgrade_required',
  'sample_page',
  'product_page',
];

/** `sessionStorage` key of the anonymous per-tab id. */
const DISTINCT_ID_STORAGE_KEY = 'trustcore_analytics_id';
const DISTINCT_ID_PATTERN = /^[0-9a-f-]{32,36}$/;

/** In-memory copy of the per-tab id; the only copy when `sessionStorage` is unavailable. */
let cachedDistinctId: string | null = null;

export function isAnalyticsConfigured(): boolean {
  return POSTHOG_KEY !== '';
}

/** Keep only allow-listed keys with allow-listed values, whatever the caller passed. */
function sanitizeProps(props: AnalyticsProps | undefined): CaptureProperties {
  const clean: CaptureProperties = {};
  if (typeof props !== 'object' || props === null) {
    return clean;
  }
  if (typeof props.product === 'string' && PRODUCTS.includes(props.product)) {
    clean.product = props.product;
  }
  if (typeof props.tier === 'string' && TIERS.includes(props.tier)) {
    clean.tier = props.tier;
  }
  if (typeof props.source === 'string' && SOURCES.includes(props.source)) {
    clean.source = props.source;
  }
  if (typeof props.zero_retention === 'boolean') {
    clean.zero_retention = props.zero_retention;
  }
  return clean;
}

/** A random id that identifies nothing but this browser tab. */
function randomId(): string {
  const webCrypto: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (webCrypto !== undefined && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  if (webCrypto !== undefined && typeof webCrypto.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // No Web Crypto: the id is only an anonymous grouping key, so Math.random is acceptable.
  let id = '';
  for (let index = 0; index < 32; index += 1) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

/** The per-tab id: read from `sessionStorage`, created on first use. Never a cookie or `localStorage`. */
function distinctId(): string {
  if (cachedDistinctId !== null) {
    return cachedDistinctId;
  }
  let id: string | null = null;
  try {
    id = window.sessionStorage.getItem(DISTINCT_ID_STORAGE_KEY);
  } catch {
    // Storage is blocked: use the in-memory id.
  }
  if (id === null || !DISTINCT_ID_PATTERN.test(id)) {
    id = randomId();
    try {
      window.sessionStorage.setItem(DISTINCT_ID_STORAGE_KEY, id);
    } catch {
      // Storage is blocked or full: the id lives in memory for this page load only.
    }
  }
  cachedDistinctId = id;
  return id;
}

function send(payload: CapturePayload): void {
  if (typeof fetch !== 'function') {
    return;
  }
  // `keepalive` lets the request finish when the page navigates away (for example to Stripe Checkout).
  // No credentials and no referrer: the request carries the JSON body and nothing about the page.
  void fetch(`${POSTHOG_HOST}${CAPTURE_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  }).catch(() => undefined);
}

/**
 * Record a product event. A complete no-op (no network, no storage) on the
 * server and when `NEXT_PUBLIC_POSTHOG_KEY` is unset; it never throws.
 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (typeof window === 'undefined' || !isAnalyticsConfigured()) {
    return;
  }
  try {
    if (!EVENTS.includes(event)) {
      return;
    }
    send({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: distinctId(),
      // No person profile is created for the anonymous per-tab id.
      properties: { ...sanitizeProps(props), $process_person_profile: false },
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Analytics must never break the product.
  }
}
