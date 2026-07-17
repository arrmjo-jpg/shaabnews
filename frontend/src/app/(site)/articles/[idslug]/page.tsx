import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AdZone } from '@/components/ads/ad-zone';
import { ArticleDetailView } from '@/components/articles/article-detail';
import { ArticleBreadcrumb } from '@/components/articles/blocks/breadcrumb';
import { FeedSection } from '@/components/articles/blocks/feed-section';
import { StickyShareSidebar } from '@/components/articles/blocks/reading-tools';
import { CommentSection } from '@/components/articles/comments/comment-section';
import { ViewBeacon } from '@/components/engagement/view-beacon';
import { Container } from '@/components/layout/container';
import { ReadingProgress } from '@/components/reading/reading-progress';
import { ReadingSidebar } from '@/components/reading/reading-sidebar';
import { TableOfContents } from '@/components/reading/table-of-contents';
import { SubscribeBoxSection } from '@/components/public-forms/subscribe-box-section';
import { articleSeoToMetadata, getArticle, getLiveUpdates, type LiveUpdateItem } from '@/lib/articles';
import { getArticleMetrics } from '@/lib/engagement';
import { env } from '@/lib/env';
import { getCategoryFeed, type FeedItem } from '@/lib/feed';
import { extractHeadings } from '@/lib/reading';
import { getTtsConfig } from '@/lib/tts';

// صفحة تفاصيل المحتوى الموحدة (news/live/opinion) - صفحة/Layout واحد، الفرق Conditional بـtype.
// إعادة استخدام نقطة التفاصيل + seo (يصدر كما هو) + Engagement المركزي + التعليقات (backend). الرابط القانوني
// id-slug؛ نفك الترميز ونقشر البادئة الرقمية للسلَغ المجرد الذي تطابقه النقطة (تتبع 301 لسلَغ قديم تلقائيا). غير
// موجود = notFound() = 404 حقيقي (لذا لا loading.tsx على المسار).
// ISR = سقف أمان فقط؛ التحديث الفعلي حدثي عبر article:{slug}/feed:*.
export const revalidate = 36000;

// فك الترميز (عربي) ثم إزالة بادئة المعرف (أول مقطع رقمي فقط؛ آمن مع سلَغ يبدأ برقم).
function bareSlug(idslug: string): string {
  let s = idslug;
  try {
    s = decodeURIComponent(idslug);
  } catch {
    /* مقطع غير صالح الترميز - نبقي الخام */
  }
  return s.replace(/^\d+-/, '');
}

// بدون هذه (حتى فارغة)، Next.js يُعامل مسارات dynamic params كـdynamic بالكامل دومًا (no-store)
// بصرف النظر عن revalidate أعلاه — تأكَّد تجريبيًا أثناء ISR Restoration (Cache-Control تحوّلت من
// no-store إلى s-maxage فور إضافتها، بلا أي تغيير آخر). لا مسارات مُولَّدة مسبقًا عند البناء
// (المقالات كثيرة ومتغيّرة) — كل مسار يُبنى ويُكاش عند أول زيارة (ISR عند الطلب).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ idslug: string }>;
}): Promise<Metadata> {
  const { idslug } = await params;
  const article = await getArticle(bareSlug(idslug));
  if (!article) return { title: 'مقال' };
  return articleSeoToMetadata(article, `${env.siteUrl}/articles/${idslug}`);
}

export default async function ArticlePage({ params }: { params: Promise<{ idslug: string }> }) {
  const { idslug } = await params;
  const slug = bareSlug(idslug);

  const article = await getArticle(slug);
  if (!article) notFound(); // 404 حقيقي - قبل أي بث

  const [metrics, liveUpdates, relatedRaw, ttsConfig] = await Promise.all([
    getArticleMetrics(article.id),
    article.type === 'live' ? getLiveUpdates(slug) : Promise.resolve<LiveUpdateItem[]>([]),
    article.primaryCategory
      ? getCategoryFeed(article.primaryCategory.slug, 6)
      : Promise.resolve<FeedItem[]>([]),
    getTtsConfig(),
  ]);

  // طبقة القراءة المشتركة: حقن ids بالعناوين (للمرابط/العمق).
  // headings: نفس القيمة التي يعيدها extractHeadings أصلا - لم تضف أي دالة/جلب بيانات جديد،
  // فقط استُهلك الجزء الثاني من نفس الإرجاع (كان مهملا سابقا) لتغذية جدول المحتوى.
  const { html, headings } = extractHeadings(article.contentHtml);
  const related = relatedRaw.filter((it) => it.href !== article.href).slice(0, 4);
  const ttsEnabled = ttsConfig?.enabled ?? false;
  const shareUrl = `${env.siteUrl}${article.href}`;

  const jsonLd = [article.seo?.structured_data, article.seo?.breadcrumbs]
    .filter((x): x is object => Boolean(x) && typeof x === 'object')
    .map((obj) => JSON.stringify(obj).replace(/</g, '\\u003c'));

  return (
    <Container className="py-6 sm:py-8">
      <ViewBeacon type="article" id={article.id} />
      <ReadingProgress targetId="article-content" />

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
        <aside className="hidden lg:col-span-1 lg:block print:hidden">
          <StickyShareSidebar articleId={article.id} url={shareUrl} title={article.title} initialMetrics={metrics} />
        </aside>

        <main className="min-w-0 lg:col-span-8 space-y-3 lg:border-l lg:border-primary/40 lg:pl-8">
          <div className="print:hidden">
            <div className="border-r-4 border-primary/80 pr-3 py-0.5">
              <ArticleBreadcrumb category={article.primaryCategory} title={article.title} articleUrl={article.href} />
            </div>
          </div>

          <ArticleDetailView
            article={article}
            slug={slug}
            metrics={metrics}
            shareUrl={shareUrl}
            liveUpdates={liveUpdates}
            contentHtml={html}
            ttsEnabled={ttsEnabled}
            headings={headings}
          />

          <AdZone zone="aalan_asfl_alkhbr_rym_1" className="mt-8" />
          <AdZone zone="aalan_asfl_alkhbr_rym_2" className="mt-6" />

          <CommentSection slug={slug} enabled={article.commentsEnabled} />

          <FeedSection id="related-heading" title="اقرأ أيضا" items={related} />

          <div className="mt-12 mb-8">
            <SubscribeBoxSection />
          </div>
        </main>

        <aside className="hidden lg:col-span-3 lg:block print:hidden">
          <div className="sticky top-24 space-y-6">
            {headings.length >= 2 && (
              <div className="border border-border bg-surface p-4">
                <TableOfContents headings={headings} />
              </div>
            )}
            <ReadingSidebar />
          </div>
        </aside>
      </div>

      {jsonLd.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: j }} />
      ))}
    </Container>
  );
}
