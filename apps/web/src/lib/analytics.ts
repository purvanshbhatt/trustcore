/**
 * Cookieless product analytics (Plausible).
 *
 * Only four product events exist, and their properties are small enumerated
 * values. Never pass file names, file contents, repository URLs, report ids or
 * email addresses: the types forbid it and `sanitizeProps` drops anything that
 * is not on the allow-lists below.
 */
import type { ProductType } from './types';

export type AnalyticsEvent = 'sample_loaded' | 'scan_started' | 'paywall_opened' | 'checkout_completed';

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

type PlausibleProps = Record<string, string | boolean>;

interface PlausibleFn {
  (event: string, options?: { props: PlausibleProps }): void;
  /** Calls queued before the Plausible script has loaded. */
  q?: unknown[];
}

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

/** Plausible script URL. Analytics is off (and `track` is a no-op) when this is empty. */
export const PLAUSIBLE_SCRIPT_URL: string = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim() ?? '';

/** Site domain registered in Plausible (`data-domain`). Optional. */
export const PLAUSIBLE_DOMAIN: string = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() ?? '';

const EVENTS: readonly string[] = ['sample_loaded', 'scan_started', 'paywall_opened', 'checkout_completed'];
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

export function isAnalyticsConfigured(): boolean {
  return PLAUSIBLE_SCRIPT_URL !== '';
}

/** Keep only allow-listed keys with allow-listed values, whatever the caller passed. */
function sanitizeProps(props: AnalyticsProps | undefined): PlausibleProps | null {
  if (typeof props !== 'object' || props === null) {
    return null;
  }
  const clean: PlausibleProps = {};
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
  return Object.keys(clean).length > 0 ? clean : null;
}

/** `window.plausible`, or the same queue stub the root layout installs when the script has not run yet. */
function plausible(): PlausibleFn {
  const existing = window.plausible;
  if (typeof existing === 'function') {
    return existing;
  }
  const stub: PlausibleFn = (...args) => {
    (stub.q = stub.q || []).push(args);
  };
  window.plausible = stub;
  return stub;
}

/**
 * Record a product event. A no-op on the server and when analytics is not
 * configured; it never throws.
 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (typeof window === 'undefined' || !isAnalyticsConfigured()) {
    return;
  }
  try {
    if (!EVENTS.includes(event)) {
      return;
    }
    const clean = sanitizeProps(props);
    if (clean === null) {
      plausible()(event);
    } else {
      plausible()(event, { props: clean });
    }
  } catch {
    // Analytics must never break the product.
  }
}
