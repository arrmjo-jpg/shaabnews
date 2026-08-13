import type { MetadataRoute } from 'next';

import { env } from '@/lib/env';

// Dynamic, environment-aware robots. Non-production is fully disallowed; production allows crawl
// (minus private areas) and advertises the sitemap.
export default function robots(): MetadataRoute.Robots {
  if (!env.isProd) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  // /sport/player/ is disallowed after a measured crawl incident (2026-08-13): 518 requests in
  // 10 minutes across 514 unique athlete IDs — 99.2% unique, 100% bots, zero human sessions. Each
  // page view fans out to ~10 upstream 365Scores calls, so enumerating the athlete graph (every
  // player page links to 12 teammates) is expensive with no SEO value on our side. The middleware
  // enforces this for crawlers that ignore robots.txt.
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/account/', '/sport/player/'] }],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
