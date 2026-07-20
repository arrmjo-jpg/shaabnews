// Phase 1.4 §28 — عقد stale-if-error: عند فشل الجلب بعد نجاح سابق، تُعاد آخر نسخة ناجحة معروفة
// (لا رسالة خطأ للمستخدم)، مع تعليم freshness بصدق للتشخيص/التحليلات مستقبلاً.
//
// لماذا مخزن يدويّ بسيط (Map في الذاكرة) بدل الاعتماد على Next.js وحده: fetch() في Next.js لا
// يُعلم الكود المستدعي — بأي واجهة موثّقة — ما إذا كانت الاستجابة الناجحة (res.ok) طازجة فعلاً أم
// نسخة قديمة صالحة أعادها الكاش أثناء إعادة التحقّق في الخلفية (stale-while-revalidate شفّاف تمامًا
// من منظور fetch() نفسه). فتتبّع "fresh/stale" بدقّة يحتاج مخزنًا صريحًا نديره نحن، لا افتراضًا
// بأن Next.js يوفّر هذه المعلومة مجّانًا — لا يوفّرها.
//
// حدود متعمَّدة: مخزن بالذاكرة لكل عملية خادم (يُصفَّر عند إعادة النشر/التشغيل) — كافٍ للسلوك
// المطلوب (تفضيل نسخة قديمة صالحة على شاشة فارغة) دون بناء طبقة كاش جديدة موازية لكاش Next.js.
//
// قيد صريح وملزم (راجَعه المستخدم وأقرّه — §28 من الوثيقة): هذا المخزن محليّ لكل Process — في أي
// طوبولوجيا بأكثر من عملية Node مستقلّة (serverless، عدّة نسخ Next.js، PM2 cluster، Kubernetes)
// تملك كل عملية ذاكرتها الخاصة، فـ freshness/fetchedAt يعكسان ما رأته هذه العملية وحدها فقط،
// لا حقيقة عالمية متّسقة عبر الأسطول. freshness هنا **بيانات تشخيصية اجتهادية (best-effort
// diagnostic metadata) فقط** — يُمنَع الاعتماد عليها في: أي منطق أعمال، أي قرار تخويل/صلاحيات، أي
// قرار SEO، أي قرار إبطال كاش، أو أي قرار وظيفي/يمسّ الصحّة. استخدامها المُصرَّح به حصرًا: تسجيل
// (logging)، تنقيح (debugging)، قياس (telemetry)، وشارة واجهة اختيارية مستقبلاً. إن ظهرت حاجة فعلية
// لاتّساق عالميّ عبر عدّة عمليات، فالمطلوب استبدال هذا التنفيذ بآلية موزَّعة (مخزن مشترك)، لا توسيعه.
export interface SportQueryResult<T> {
  data: T;
  freshness: 'fresh' | 'stale';
  fetchedAt: string;
}

interface FreshnessEntry<T> {
  data: T;
  fetchedAt: string;
}

const store = new Map<string, FreshnessEntry<unknown>>();

/**
 * يلتف حول أي جالب بيانات: عند نجاحه (وفق isEmpty) يُخزَّن كآخر نسخة ناجحة ويُعاد freshness:'fresh'؛
 * عند فشله (نتيجة فارغة) يُعاد آخر نسخة ناجحة معروفة بعلامة freshness:'stale' إن وُجدت، وإلا النتيجة
 * الفارغة نفسها بعلامة 'fresh' (لا نسخة قديمة لتفضيلها — حالة "لم ينجح قطّ"، §30).
 */
export async function withFreshness<T>(
  key: string,
  fetcher: () => Promise<T>,
  isEmpty: (value: T) => boolean,
): Promise<SportQueryResult<T>> {
  const result = await fetcher();
  const now = new Date().toISOString();

  if (!isEmpty(result)) {
    store.set(key, { data: result, fetchedAt: now });
    return { data: result, freshness: 'fresh', fetchedAt: now };
  }

  const cached = store.get(key) as FreshnessEntry<T> | undefined;
  if (cached) {
    return { data: cached.data, freshness: 'stale', fetchedAt: cached.fetchedAt };
  }

  return { data: result, freshness: 'fresh', fetchedAt: now };
}

/** للاختبارات فقط — يُصفّر المخزن بين الحالات كي لا تتسرّب بيانات اختبار سابقة. */
export function resetFreshnessStore(): void {
  store.clear();
}
