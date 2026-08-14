import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

// نقطة إبطال كاش الواجهة عند الطلب — يستدعيها الباك إند (RevalidateFrontendCacheJob) بعد كتابة محتوى.
// تستقبل `{ tags: string[] }` مع ترويسة `x-revalidate-secret`، وتربط كلّ وسم بـ`revalidateTag()` (إبطال فوريّ
// لكاش بيانات Next + المسارات المعتمدة عليه). الوسوم تطابق وسوم fetch في `lib/*` (feed:*/article:*/category:*).
// fail-safe: سرّ غير مضبوط ⇒ 503؛ سرّ خاطئ ⇒ 401؛ بلا وسوم ⇒ 422.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const raw = (body as { tags?: unknown } | null)?.tags;
  const tags = Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string' && t.length > 0) : [];
  if (tags.length === 0) return NextResponse.json({ error: 'no_tags' }, { status: 422 });

  for (const tag of tags) revalidateTag(tag);

  return NextResponse.json({ revalidated: true, count: tags.length, tags });
}
