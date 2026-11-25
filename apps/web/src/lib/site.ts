/**
 * Site-wide constants for the public marketing and legal pages.
 * Every value comes from a NEXT_PUBLIC_* variable, so it is safe to render.
 */

/** Legal name of the provider, shown on /privacy and /terms. */
export const LEGAL_ENTITY: string = process.env.NEXT_PUBLIC_LEGAL_ENTITY?.trim() || 'TrustCore';

/**
 * Public contact address. Empty until one is configured: pages then render
 * `CONTACT_PLACEHOLDER` instead of an invented address.
 */
export const CONTACT_EMAIL: string = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? '';

export const CONTACT_PLACEHOLDER = 'Contact details are published before launch';

/** Canonical origin of the web app, without a trailing slash. */
export const SITE_URL: string = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(
  /\/+$/,
  ''
);

/** "Last updated" date shown on /security, /privacy and /terms. */
export const LEGAL_LAST_UPDATED = '24 November 2026';

/** ISO form of `LEGAL_LAST_UPDATED`, for the sitemap. */
export const LEGAL_LAST_UPDATED_ISO = '2026-11-24';
