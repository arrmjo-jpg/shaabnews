import { Clock, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EngagementBar } from '@/components/engagement/engagement-bar';
import { ViewBeacon } from '@/components/engagement/view-beacon';
import { Container } from '@/components/layout/container';
import { SectionHeader } from '@/components/videos/section-header';
import { VideoListItem } from '@/components/videos/video-list-item';
import { VideoPlayer } from '@/components/videos/video-player';
import { WatchPlaylist } from '@/components/videos/watch-playlist';
import { env } from '@/lib/env';
import { formatNumber, formatRelativeTime } from '@/lib/format';
import { getLatestVideos, getPlaylist, getRelatedVideos, getVideo, type VideoItem } from '@/lib/videos';

// صفحة المشاهدة المفردة (Watch) — **Frontend فقط، إعادة استخدام نقطة التفاصيل الموجودة**. الرابط القانونيّ id-slug؛
// **Next يمرّر المقطع مُرمَّزاً** ⇒ نفكّ ثمّ نقشّر `^\d+-` للحصول على السلَغ المجرَّد الذي تقبله النقطة. غير موجود ⇒
// `notFound()` = **404 حقيقيّ** (لذا لا `loading.tsx` على المسار: بثّ القشرة المبكّر يثبّت 200؛ نُبقي القائمة الجانبيّة
// تبثّ عبر `<Suspense>` بهيكل). ذات صلة حقيقيّة، وعند غيابها الأحدث (fallback مسموح صريح). القائمة عبر سياق
// `?playlist=` (لا تلفيق عضويّة). SEO: metadata+OG+canonical+JSON-LD VideoObject من حقول حقيقيّة (تُحذَف الفارغة).
// RSC؛ ISR = سقف أمان فقط والتحديث حدثيّ عبر video:{locale}:{slug}؛ منارة المشاهدة مؤجَّلة.
// نُقِلت إلى /news/videos/{idslug} (2026-07-18)؛ /videos/{idslug} القديم يُعيد التوجيه 301 عبر next.config.ts.
export const revalidate = 36000;

// فكّ ترميز المقطع (عربيّ مُرمَّز %D9..) ثمّ إزالة بادئة المعرّف (أوّل مقطع رقميّ فقط؛ آمن مع سلَغ يبدأ برقم).
const bareSlug = (idslug: string): string => {
  let s = idslug;
  try {
    s = decodeURIComponent(idslug);
  } catch {
    /* مقطع غير صالح الترميز — نُبقي الخام */
  }
  return s.replace(/^\d+-/, '');
};

const withParam = (href: string, key: string, value: string): string =>
  `${href}${href.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ idslug: string }>;
}): Promise<Metadata> {
  const { idslug } = await params;
  const video = await getVideo(bareSlug(idslug));
  if (!video) return { title: 'فيديو' };

  const canonical = `${env.siteUrl}/news/videos/${idslug}`;
  const description = video.description ?? undefined;
  const images = video.poster ? [video.poster] : undefined;

  return {
    title: video.title,
    description,
    alternates: { canonical },
    openGraph: { type: 'video.other', title: video.title, description, url: canonical, images },
    twitter: {
      card: video.poster ? 'summary_large_image' : 'summary',
      title: video.title,
      description,
      images,
    },
  };
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ idslug: string }>;
  searchParams: Promise<{ playlist?: string | string[] }>;
}) {
  const { idslug } = await params;
  const sp = await searchParams;
  const playlistSlug = typeof sp.playlist === 'string' ? sp.playlist : undefined;
  const slug = bareSlug(idslug);

  const video = await getVideo(slug);
  if (!video) notFound(); // 404 حقيقيّ — قبل أيّ بثّ

  const canonical = `${env.siteUrl}/news/videos/${idslug}`;
  const jsonLd = JSON.stringify(buildVideoJsonLd(video, canonical)).replace(/</g, '\\u003c');

  return (
    <Container className="py-6 sm:py-8">
      {/* منارة المشاهدة — جزيرة عميل غير مرئيّة تجلب توكناً طازجاً (state) ثمّ ترسل نبضة المشاهدة. */}
      <ViewBeacon type="video" id={video.id} />
      <nav aria-label="مسار التنقّل" className="mb-4 flex items-center gap-2 text-caption text-muted">
        <Link href="/" className="shrink-0 transition-colors hover:text-primary">
          الرئيسية
        </Link>
        <span aria-hidden>/</span>
        <Link href="/news/videos" className="shrink-0 transition-colors hover:text-primary">
          فيديو
        </Link>
        <span aria-hidden>/</span>
        <span className="line-clamp-1 text-fg">{video.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <main className="space-y-4 lg:col-span-8">
          <div className="aspect-video w-full overflow-hidden bg-black">
            <VideoPlayer
              hls={video.hls}
              mp4={video.mp4}
              youtubeId={video.youtubeId}
              poster={video.poster}
              title={video.title}
              autoPlay={false}
            />
          </div>

          <h1 className="text-xl font-extrabold leading-snug text-fg sm:text-2xl">{video.title}</h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-4 text-sm text-muted">
            {video.category && <span className="font-extrabold text-primary">{video.category.name}</span>}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Eye className="size-4 shrink-0" aria-hidden />
              {formatNumber(video.views)}
              <span className="sr-only">مشاهدة</span>
            </span>
            {video.publishedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4 shrink-0" aria-hidden />
                <time dateTime={video.publishedAt}>{formatRelativeTime(video.publishedAt)}</time>
              </span>
            )}
            {video.durationLabel && <span className="tabular-nums">{video.durationLabel}</span>}
          </div>

          {/* تفاعل مركزيّ (إعجاب ❤️ + حفظ 🔖 + مشاركة) — الفيديو Consumer لنظام Engagement العام.
              ترطيب حالة المستخدم client-side (صفحة المشاهدة مُكاشة ISR — لا تُخبز حالة المستخدم). */}
          <EngagementBar
            type="video"
            id={video.id}
            href={video.href}
            title={video.title}
            initialMetrics={{
              views: video.views,
              likes: video.likes,
              dislikes: video.dislikes,
              favorites: video.favorites,
            }}
            reactionStyle="heart"
            hydrate
            className="border-b border-border pb-3"
          />

          {video.description && (
            <div className="whitespace-pre-line bg-surface-2 p-4 text-sm leading-relaxed text-fg">
              {video.description}
            </div>
          )}
        </main>

        <aside className="lg:col-span-4">
          <Suspense fallback={<SidebarSkeleton />}>
            <WatchSidebar slug={slug} currentId={video.id} playlistSlug={playlistSlug} />
          </Suspense>
        </aside>
      </div>

      {/* JSON-LD VideoObject — حقول حقيقيّة فقط (تُحذَف الفارغة) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </Container>
  );
}

// القائمة الجانبيّة (تبثّ عبر Suspense) — قائمة التشغيل (إن قدِم سياقها) ثمّ «ذات صلة» (وعند غيابها الأحدث).
async function WatchSidebar({
  slug,
  currentId,
  playlistSlug,
}: {
  slug: string;
  currentId: number;
  playlistSlug?: string;
}) {
  const [relatedRaw, playlistRaw] = await Promise.all([
    getRelatedVideos(slug, 12),
    playlistSlug ? getPlaylist(playlistSlug) : Promise.resolve(null),
  ]);

  let related = relatedRaw.filter((v) => v.id !== currentId);
  let relatedTitle = 'مقاطع ذات صلة';
  if (related.length === 0) {
    const latest = await getLatestVideos(12);
    related = latest.filter((v) => v.id !== currentId);
    relatedTitle = 'أحدث الفيديوهات';
  }

  const playlist =
    playlistRaw && playlistSlug && playlistRaw.videos.length > 0
      ? {
          ...playlistRaw,
          videos: playlistRaw.videos.map((v) => ({ ...v, href: withParam(v.href, 'playlist', playlistSlug) })),
        }
      : null;

  return (
    <div className="space-y-6">
      {playlist && <WatchPlaylist playlist={playlist} currentId={currentId} />}
      {related.length > 0 && (
        <section aria-labelledby="watch-related">
          <SectionHeader title={relatedTitle} id="watch-related" />
          <div className="flex flex-col gap-1">
            {related.map((v) => (
              <VideoListItem key={v.id} video={v} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="aspect-video w-32 shrink-0 animate-pulse bg-surface-2 sm:w-40" aria-hidden />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-full animate-pulse bg-surface-2" aria-hidden />
            <div className="h-3 w-2/3 animate-pulse bg-surface-2" aria-hidden />
          </div>
        </div>
      ))}
    </div>
  );
}

// VideoObject من حقول حقيقيّة فقط (لا تلفيق): يُحذَف ما لا قيمة له.
function buildVideoJsonLd(video: VideoItem, canonical: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    embedUrl: video.youtubeId ? `https://www.youtube.com/embed/${video.youtubeId}` : canonical,
  };
  if (video.description) ld.description = video.description;
  if (video.poster) ld.thumbnailUrl = [video.poster];
  if (video.publishedAt) ld.uploadDate = video.publishedAt;
  if (video.durationSeconds) ld.duration = `PT${video.durationSeconds}S`;
  const content = video.mp4 ?? video.hls;
  if (!video.youtubeId && content) ld.contentUrl = content;
  if (video.views > 0) {
    ld.interactionStatistic = {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'WatchAction' },
      userInteractionCount: video.views,
    };
  }
  return ld;
}
