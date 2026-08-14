import { NextResponse } from 'next/server';

import { getMatchBar } from '@/lib/match-bar';

// BFF شريط المباريات — غرضه الوحيد إخراج الشريط من شجرة كاش صفحات (site). getMatchBar() تبقى
// بلا أيّ تعديل بجلبتها ‎revalidate: 60, tags: ['match-bar']‎؛ الفرق أنّها صارت في مسار مستقلّ.
// السبب: أيّ fetch بقيمة revalidate أدنى يستبدل قيمة المسار الحاويّ
// (next/dist/server/lib/patch-fetch.js:775) — وبما أنّ الاستدعاء كان في (site)/layout.tsx المشترك،
// كانت الـ60 سقفًا فعليًّا لكلّ صفحة في المجموعة رغم إعلانها revalidate = 36000.
//
// force-dynamic إلزاميّ لا تحسينيّ: هذا المسار بلا معاملات، فبدونه يُولَّد ساكنًا وقت
// `docker build` حيث API_BASE_URL فارغ عمدًا (راجع Dockerfile وتعليق ISR في (site)/layout.tsx)
// ⇒ يتجمّد على [] أبدًا بلا تعافٍ ذاتيّ — نفس العطل الذي جمّد /login سابقًا. وهو لا يُلغي كاش
// البيانات: الجلبة الداخليّة تبقى تستعمله في التصيير الديناميكيّ أيضًا (patch-fetch.js:143
// createCachedDynamicResponse، والشرط isCacheableRevalidate في :519 لا يشترط تصييرًا ساكنًا)،
// فلارافيل تُنادى مرّة كلّ 60ث كحدّ أقصى تمامًا كاليوم، والوسم يُخزَّن على الإدخال (:615) فيبقى
// revalidateTag('match-bar') عاملًا.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const matches = await getMatchBar();
  return NextResponse.json(
    { matches },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' } },
  );
}
