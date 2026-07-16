import { env } from '@/lib/env';

// Proxies the backend's per-content RSS feeds (routes/web.php: GET /rss/videos.xml, /rss/reels.xml,
// /rss/news.xml → RssController@*), rewriting backend URLs to the frontend's public site URL.
// Filename is read straight off the request path so this covers any feed the backend adds later.
export async function GET(request: Request) {
  const feed = new URL(request.url).pathname.split('/').pop()?.replace('.xml', '') ?? '';
  const filename = `${feed}.xml`;
  const backendUrl = env.apiBaseUrl.replace(/\/api\/v1$/, '').replace(/\/v1$/, '');
  const siteUrl = env.siteUrl;

  try {
    const res = await fetch(`${backendUrl}/rss/${filename}`, {
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
