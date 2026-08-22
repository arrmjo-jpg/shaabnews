import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

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
import {
  articleSeoToMetadata,
  canonicalArticleDateParts,
  canonicalArticlePath,
  getArticle,
  getLiveUpdates,
  type LiveUpdateItem,
} from '@/lib/articles';
import { getArticleMetrics } from '@/lib/engagement';
import { env } from '@/lib/env';
import { getCategoryFeed, type FeedItem } from '@/lib/feed';
import { extractHeadings } from '@/lib/reading';
import { getTtsConfig } from '@/lib/tts';

// المسار القانونيّ الجديد للمقال — /news/dd/mm/yyyy/{id}/ (2026-07-18). التاريخ من
// published_at حصراً (لا slug إطلاقاً في الشكل القانونيّ — زخرفيّ اختياريّ فقط في
// idslug). ISR = سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر article:{id}/feed:*.
export const revalidate = 36000;

// بدون هذه (حتى فارغة)، Next.js يُعامل مسارات dynamic params كـdynamic بالكامل دومًا
// (راجع articles/[idslug] القديمة — نفس النمط المُثبَت تجريبياً هذه الجلسة).
export async function generateStaticParams() {
  return [];
}

type RouteParams = { dd: string; mm: string; yyyy: string; idslug: string };

// فكّ الترميز ثم إزالة بادئة المعرّف الرقميّ (أول مقطع رقميّ فقط) — نفس نمط الصفحة
// القديمة والصفحات الأخرى (writer/live/tv/radio).
function bareId(idslug: string): string {
  let s = idslug;
  try {
    s = decodeURIComponent(idslug);
  } catch {
    /* مقطع غير صالح الترميز — نُبقي الخام */
  }
  return s.replace(/^(\d+).*$/, '$1');
}

/**
 * يحسم: هل هذا الطلب هو الشكل القانونيّ تماماً (تاريخ مطابق + بلا سلَغ)، أم يجب
 * إعادة توجيهه 301؟ يُستهلَك من الصفحة و generateMetadata معاً (نفس الحساب).
 */
async function resolveCanonical(params: RouteParams) {
  const { dd, mm, yyyy, idslug } = params;
  const id = bareId(idslug);
  if (!/^\d+$/.test(id)) return { article: null, isCanonical: false, target: null };

  const article = await getArticle(id);
  if (!article) return { article: null, isCanonical: false, target: null };

  const target = canonicalArticlePath(article.id, article.publishedAt);
  const { dd: trueDd, mm: trueMm, yyyy: trueYyyy } = article.publishedAt
    ? canonicalArticleDateParts(article.publishedAt)
    : { dd: '00', mm: '00', yyyy: '0000' };

  // قانونيّ فقط عند تطابق التاريخ الثلاثي تماماً **و** idslug مجرّد id بلا أي سلَغ.
  const isCanonical = dd === trueDd && mm === trueMm && yyyy === trueYyyy && idslug === id;

  return { article, isCanonical, target };
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const resolved = await resolveCanonical(await params);
  if (!resolved.article) return { title: 'مقال' };

  return articleSeoToMetadata(resolved.article, `${env.siteUrl}${resolved.target}`);
}

export default async function CanonicalArticlePage({ params }: { params: Promise<RouteParams> }) {
  const resolved = await resolveCanonical(await params);
  if (!resolved.article) notFound(); // 404 حقيقيّ — id غير موجود إطلاقاً، لا شكل رابط بديل يُنقذه

  if (!resolved.isCanonical) {
    permanentRedirect(resolved.target as string);
  }

  const article = resolved.article;
  const idForFetch = String(article.id);

  const [metrics, liveUpdates, relatedRaw, ttsConfig] = await Promise.all([
    getArticleMetrics(article.id),
    article.type === 'live' ? getLiveUpdates(idForFetch) : Promise.resolve<LiveUpdateItem[]>([]),
    article.primaryCategory
      ? getCategoryFeed(article.primaryCategory.slug, 6)
      : Promise.resolve<FeedItem[]>([]),
    getTtsConfig(),
  ]);

  // طبقة القراءة المشتركة: حقن ids بالعناوين (للمرابط/العمق).
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
            slug={idForFetch}
            metrics={metrics}
            shareUrl={shareUrl}
            liveUpdates={liveUpdates}
            contentHtml={html}
            ttsEnabled={ttsEnabled}
            headings={headings}
          />

          <AdZone zone="aalan_asfl_ns_almqal_fy_alkhbr_rqm_1" className="mt-8" />
          <AdZone zone="aalan_asfl_ns_almqal_fy_alkhbr_rqm_2" className="mt-6" />

          <CommentSection slug={idForFetch} enabled={article.commentsEnabled} />

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
