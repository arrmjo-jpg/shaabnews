import { notFound, permanentRedirect } from 'next/navigation';

import { categoryHref, getCategoryAncestry, getCategoryBySlug } from '@/lib/feed';

// مسار قديم — كان الصفحة القانونية، صار الآن مُعيد توجيه فقط (2026-07-18). القانونيّ
// الجديد: /news/category/{...} متداخل (راجع news/category/[...segments]/page.tsx).
export const revalidate = 36000;

export default async function LegacyCategoryRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const [category, ancestry] = await Promise.all([
    getCategoryBySlug(decoded),
    getCategoryAncestry(decoded),
  ]);
  if (!category) notFound();

  // ancestry فارغة (قسم خارج شجرة /categories) ⇒ ارتداد بمسار مفرد أفضل من فشل كامل.
  // encodeURIComponent إلزاميّ — slug عربيّ خام في ترويسة Location يُسقِط الخادم.
  const target = ancestry && ancestry.length > 0 ? categoryHref(ancestry) : `/news/category/${encodeURIComponent(decoded)}`;

  permanentRedirect(target);
}
