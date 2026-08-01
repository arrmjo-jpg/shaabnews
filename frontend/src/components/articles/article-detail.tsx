import { ChevronDown, PenLine } from 'lucide-react';
import Link from 'next/link';

import { ArticleHeader } from './blocks/article-header';
import { ArticleMetadata } from './blocks/metadata-row';
import { ReadingToolsBar } from './blocks/reading-tools';
import { ArticleHero } from './blocks/hero-image';
import { ArticleBody } from './blocks/article-body';
import { LivePulse } from '@/components/ui/live-pulse';
import { TableOfContents } from '@/components/reading/table-of-contents';
import { editorialSpacing } from '@/lib/design-tokens';
import { readingMinutes, type ArticleDetail, type LiveUpdateItem } from '@/lib/articles';
import type { EngagementMetrics } from '@/lib/engagement';
import type { Heading } from '@/lib/reading';

import { ArticleLiveUpdates } from './article-live-updates';

// عارض تفاصيل المحتوى الموحد - طبقة العرض فقط أعيد بناؤها بصريا لتطابق المشروع المرجعي
// (D:\gasem\frontend)؛ عقد الـProps نفسه، وكل جلب البيانات ما يزال في app/(site)/articles/[idslug]/page.tsx
// (Server Component) كما هو تماما. الإضافة الوحيدة على العقد: headings (اختياري) - تمرير بسيط
// لقيمة محسوبة أصلا من extractHeadings() الموجود في الصفحة، لا جلب بيانات جديد.
export function ArticleDetailView({
  article,
  slug,
  metrics,
  shareUrl,
  liveUpdates,
  contentHtml,
  ttsEnabled,
  headings = [],
}: {
  article: ArticleDetail;
  slug: string;
  metrics: EngagementMetrics;
  shareUrl: string;
  liveUpdates: LiveUpdateItem[];
  contentHtml?: string;
  ttsEnabled?: boolean;
  headings?: Heading[];
}) {
  const isOpinion = article.type === 'opinion';
  const isLive = article.type === 'live';
  const minutes = readingMinutes(contentHtml ?? article.contentHtml);
  const writerHref =
    article.author?.isWriter && article.author.id
      ? `/news/writer/${article.author.id}${article.author.slug ? `-${article.author.slug}` : ''}`
      : null;
  const bodyHtml = stripTitleFromHtml(contentHtml ?? article.contentHtml, article.title, article.subtitle);
  const photo = article.cover?.url || article.author?.avatar || null;

  // تسمية دور الكاتب: النسخة المرجعية تعرض دورا حقيقيا (article.author.role) - هذا الحقل غير
  // موجود في مخطط ArticleDetail الحالي (lib/articles.ts)، فبدل توسيع الـDTO استبدل بتسمية ثابتة.
  const authorRoleLabel = 'كاتب مقال';

  const cleanExcerpt = getCleanExcerpt(article.excerpt, article.title, article.subtitle);

  return (
    <article className="min-w-0 w-full">
      {isOpinion && (
        <div className="space-y-6">
          <ArticleHeader
            title={article.title}
            subtitle={article.subtitle}
            isLive={isLive}
            isOpinion
            breaking={article.flags.breaking}
            featured={article.flags.featured}
          />

          <ArticleMetadata publishedAt={article.publishedAt} readingTime={minutes} author={article.author} />

          <div className="w-full space-y-6 pt-4">
            <ReadingToolsBar
              articleId={article.id}
              url={shareUrl}
              title={article.title}
              initialMetrics={metrics}
              ttsEnabled={ttsEnabled}
            />

            <div className={`${editorialSpacing.readingColumn} block overflow-hidden`}>
              <div className="float-none mx-auto w-full max-w-[320px] mb-8 sm:float-left sm:ml-0 sm:mr-8 sm:mb-6 flex flex-col">
                <div className="relative w-full overflow-hidden shadow-lg ring-1 ring-black/5 mb-4 bg-surface-2 transition-transform duration-500 hover:scale-[1.02]">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود (سياسة صور الواجهة)
                    <img src={photo} alt={article.author?.name || 'صورة الكاتب'} className="w-full h-auto object-cover" />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center text-muted" aria-hidden>
                      <PenLine className="size-16 opacity-30" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full bg-gradient-to-br from-primary to-[#a30b13] p-3 shadow-lg ring-1 ring-primary/50">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow-inner">
                    <PenLine className="size-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider mb-0.5">
                      {authorRoleLabel}
                    </span>
                    {writerHref ? (
                      <Link href={writerHref} className="text-[15px] font-extrabold text-white hover:text-white/80 transition-colors leading-tight truncate">
                        {article.author?.name}
                      </Link>
                    ) : (
                      <span className="text-[15px] font-extrabold text-white leading-tight truncate">{article.author?.name}</span>
                    )}
                  </div>
                </div>

                {article.author?.bio && (
                  <p className="mt-3 text-[13px] text-muted leading-relaxed text-center px-1">{article.author.bio}</p>
                )}
              </div>

              <ArticleBody contentHtml={bodyHtml} excerpt={cleanExcerpt} />
            </div>
          </div>
        </div>
      )}

      {!isOpinion && (
        <div className="space-y-2">
          <div className="border-t border-border/80 pt-1">
            <ArticleMetadata publishedAt={article.publishedAt} readingTime={minutes} author={article.author} />
          </div>

          <h1 className="text-[18px] font-extrabold leading-snug text-fg !mt-2 py-0">{article.title}</h1>

          {article.subtitle && (
            <h2 className="text-[16px] sm:text-[18px] font-bold leading-snug text-primary mt-2 mb-2 py-0">{article.subtitle}</h2>
          )}

          <div className="w-full space-y-2 pt-0">
            <ReadingToolsBar
              articleId={article.id}
              url={shareUrl}
              title={article.title}
              initialMetrics={metrics}
              ttsEnabled={ttsEnabled}
            />

            <div className="mt-2 mb-6 block overflow-hidden">
              {article.cover?.url ? (
                <ArticleHero
                  cover={article.cover}
                  defaultTitle={article.title}
                  isLive={isLive}
                  breaking={article.flags.breaking}
                  featured={article.flags.featured}
                />
              ) : (
                (isLive || article.flags.breaking || article.flags.featured) && (
                  <div className="flex flex-wrap gap-1.5 mb-4 justify-start print:hidden">
                    {isLive && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-primary">
                        <LivePulse />
                        <span>مباشر الآن</span>
                      </span>
                    )}
                    {article.flags.breaking && (
                      <span className="px-3 py-1 text-xs font-bold text-white bg-[#dc2626] animate-pulse">عاجل</span>
                    )}
                    {article.flags.featured && <span className="px-3 py-1 text-xs font-bold text-white bg-primary">تغطية خاصة</span>}
                  </div>
                )
              )}

              <ArticleBody contentHtml={bodyHtml} excerpt={cleanExcerpt} />
            </div>

            {headings.length >= 2 && (
              <div className="lg:hidden mb-6 border border-border bg-surface-2 p-4 print:hidden">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer font-bold text-fg text-sm list-none select-none">
                    <span>فهرس محتويات المقال</span>
                    <span className="transition-transform duration-200 group-open:rotate-180">
                      <ChevronDown className="size-4 text-muted" />
                    </span>
                  </summary>
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <TableOfContents headings={headings} />
                  </div>
                </details>
              </div>
            )}

            {isLive && liveUpdates.length > 0 && (
              <div className="mb-8 border-t border-border/80 pt-6">
                <ArticleLiveUpdates slug={slug} initial={liveUpdates} />
              </div>
            )}
          </div>
        </div>
      )}

      {article.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 lg:max-w-[720px] lg:mx-auto lg:pr-14 print:hidden">
          {article.tags.map((t) => (
            <span
              key={t}
              className="bg-surface-2 border border-border px-2.5 py-1 text-xs text-muted font-semibold hover:text-primary hover:border-primary transition-colors cursor-pointer select-none"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function normalizeForCompare(s: string): string {
  return s.trim().toLowerCase().replace(/[-\s]/g, '');
}

function getCleanExcerpt(excerpt: string | null, title: string, subtitle: string | null): string | null {
  if (!excerpt) return null;
  const exc = normalizeForCompare(excerpt);
  const normTitle = normalizeForCompare(title);
  const normSub = normalizeForCompare(subtitle || '');
  if (exc === normTitle || exc === normSub) return null;
  if (normTitle.length > 8 && (exc.includes(normTitle) || normTitle.includes(exc))) return null;
  if (normSub.length > 8 && (exc.includes(normSub) || normSub.includes(exc))) return null;
  return excerpt;
}

function stripTitleFromHtml(html: string, title: string, subtitle: string | null): string {
  if (!html) return html;

  let currentHtml = html.trim();
  const cleanTitle = normalizeForCompare(title);
  const cleanSub = normalizeForCompare(subtitle || '');
  const blockSeparatorRegex = /(<\/p>|<br\s*\/?>|<\/div>|<\/h[1-6]>|\n\n)/i;

  for (let i = 0; i < 2; i++) {
    const parts = currentHtml.split(blockSeparatorRegex);
    if (parts.length === 0) break;

    const firstBlock = parts[0];
    const innerText = firstBlock.replace(/<[^>]*>/g, '').trim();
    const cleanInner = normalizeForCompare(innerText);

    if (
      cleanInner &&
      (cleanInner === cleanTitle ||
        cleanInner === cleanSub ||
        (cleanTitle.includes(cleanInner) && cleanInner.length > 8) ||
        (cleanInner.includes(cleanTitle) && cleanTitle.length > 8))
    ) {
      const separator = parts[1] || '';
      currentHtml = currentHtml.substring(firstBlock.length + separator.length).trim();
    } else {
      break;
    }
  }
  return currentHtml;
}
