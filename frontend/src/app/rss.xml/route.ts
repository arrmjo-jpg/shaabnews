import { env } from '@/lib/env';

// Proxies the backend's main news RSS feed (routes/web.php: GET /rss/news.xml → RssController@news),
// rewriting backend URLs to the frontend's public site URL. Per-category feeds (videos/reels) are
// served at /rss/[feed].xml. The backend owns feed-item generation — no frontend recomputation.
export async function GET(): Promise<Response> {
  const backendUrl = env.apiBaseUrl.replace(/\/api\/v1$/, '').replace(/\/v1$/, '');
  const siteUrl = env.siteUrl;

  try {
    const res = await fetch(`${backendUrl}/rss/news.xml`, {
      headers: { ...env.internalHeaders },
      cache: 'no-store',
    });
    if (!res.ok) return new Response('Not Found', { status: 404 });
    let xml = await res.text();
    xml = xml.replaceAll(backendUrl, siteUrl);

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    });
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }
}
