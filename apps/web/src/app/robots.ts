import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** Reports are private to an account and the auth callback is transient: keep both out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/reports/', '/auth/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
