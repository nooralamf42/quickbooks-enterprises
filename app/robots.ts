import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Neither is public-facing content — the admin panel is login-gated, and API
      // routes return JSON, not pages worth indexing.
      disallow: ['/admin', '/api'],
    },
  };
}
