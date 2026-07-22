import { notFound, permanentRedirect } from 'next/navigation';

import { canonicalArticlePath, getArticle } from '@/lib/articles';

// مسار قديم — كان الصفحة القانونية، صار الآن مُعيد توجيه فقط (2026-07-18). القانونيّ
// الجديد: /news/dd/mm/yyyy/{id}/ (راجع news/[dd]/[mm]/[yyyy]/[idslug]/page.tsx).
// لا عرض محتوى هنا إطلاقاً — كل رابط قديم (/articles/{id} أو /articles/{id}-{slug})
// يُحلّ حيّاً من published_at الحاليّ، لا من جدول تاريخيّ (id لا يتغيّر أبداً).
export const revalidate = 36000;

export async function generateStaticParams() {
  return [];
}

function bareId(idslug: string): string {
  let s = idslug;
  try {
    s = decodeURIComponent(idslug);
  } catch {
    /* مقطع غير صالح الترميز — نُبقي الخام */
  }
  return s.replace(/^(\d+).*$/, '$1');
}

export default async function LegacyArticleRedirect({ params }: { params: Promise<{ idslug: string }> }) {
  const { idslug } = await params;
  const id = bareId(idslug);
  if (!/^\d+$/.test(id)) notFound();

  const article = await getArticle(id);
  if (!article) notFound();

  permanentRedirect(canonicalArticlePath(article.id, article.publishedAt));
}
