import { env } from '@/lib/env';

// Proxies the backend's per-content sitemap-index children (routes/web.php:
// GET /sitemap-articles-{locale}.xml, -categories-, -news-, -reels-, -videos-,
// -video-categories-, -playlists-, and /sitemap-team.xml → SitemapController@*), rewriting
// backend URLs to the frontend's public site URL. Filename is read straight off the request path
// so this covers every current and future child sitemap without listing them here.
export async function GET(request: Request) {
  const sitemap = new URL(request.url).pathname.split('/').pop()?.replace('.xml', '') ?? '';
  const filename = `${sitemap}.xml`;
  const backendUrl = env.apiBaseUrl.replace(/\/api\/v1$/, '').replace(/\/v1$/, '');
  const siteUrl = env.siteUrl;

  try {
    const res = await fetch(`${backendUrl}/${filename}`, {
      headers: { ...env.internalHeaders },
      cache: 'no-store',
    });
    if (!res.ok) return new Response('Not Found', { status: 404 });
    let xml = await res.text();
    xml = xml.replaceAll(backendUrl, siteUrl);

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
      },
    });
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }
}
