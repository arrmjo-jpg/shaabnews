import { env } from '@/lib/env';

// وكيل خادميّ يبثّ ملفّ الـ PDF بنفس‑الأصل: pdf.js يجلب بايتات الملفّ (لا iframe)، ولو جلبها
// مباشرةً من الباك إند (أصل مختلف + تحويل 302 لرابط موقَّت) لفشل بقيد CORS. هنا الخادم يتبع
// التسليم المضمّن داخليّاً (canView يُفرض في الباك إند) ويعيد البايتات نفسها لنفس الأصل.
// عامّ فقط (الأعداد public)؛ لا تلفيق — أيّ فشل أعلى ⇒ رمز الحالة المناسب.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ idslug: string }> },
): Promise<Response> {
  const { idslug } = await params;
  const id = Number.parseInt(idslug, 10);
  if (!Number.isInteger(id) || id <= 0) return new Response('Bad request', { status: 400 });
  if (!env.apiBaseUrl) return new Response('Service unavailable', { status: 503 });

  // whereKey يقصّ الرقم في الباك إند ⇒ slug اصطناعيّ ASCII يكفي ويتجنّب ترميز العربيّة.
  const upstream = `${env.apiBaseUrl}/ar/epaper/${id}-doc/document`;
  let res: Response;
  try {
    res = await fetch(upstream, {
      headers: { ...(env.internalHeaders ?? {}), Accept: 'application/pdf' },
      redirect: 'follow',
      cache: 'no-store',
    });
  } catch {
    return new Response('Upstream error', { status: 502 });
  }

  if (res.status === 403) return new Response('Forbidden', { status: 403 });
  if (!res.ok || res.body === null) return new Response('Not found', { status: 404 });

  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
}
