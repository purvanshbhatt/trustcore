import type { MetadataRoute } from 'next';
import { LEGAL_LAST_UPDATED_ISO, SITE_URL } from '@/lib/site';

const MARKETING_PATHS: readonly string[] = ['/', '/sample'];
const LEGAL_PATHS: readonly string[] = ['/security', '/privacy', '/terms'];
const PRODUCT_PATHS: readonly string[] = ['/launchgate', '/agentscope', '/evidence', '/evalkit'];

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string): string => (path === '/' ? SITE_URL : `${SITE_URL}${path}`);
  return [
    ...MARKETING_PATHS.map((path) => ({ url: url(path), priority: path === '/' ? 1 : 0.8 })),
    ...PRODUCT_PATHS.map((path) => ({ url: url(path), priority: 0.6 })),
    ...LEGAL_PATHS.map((path) => ({ url: url(path), lastModified: LEGAL_LAST_UPDATED_ISO, priority: 0.4 })),
  ];
}
