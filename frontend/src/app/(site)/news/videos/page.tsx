import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Container } from '@/components/layout/container';
import { buildMetadata } from '@/lib/seo';
import { CategoryRail } from '@/components/videos/category-rail';
import { HeroVideo } from '@/components/videos/hero-video';
import { PlaylistRail } from '@/components/videos/playlist-rail';
import { SectionHeader } from '@/components/videos/section-header';
import { VideoEmptyState } from '@/components/videos/video-empty-state';
import {
  SectionHeaderSkeleton,
  SpotlightSkeleton,
  VideoRailSkeleton,
} from '@/components/videos/video-skeletons';
import { VideoSpotlight } from '@/components/videos/video-spotlight';
import {
  getFeaturedVideos,
  getLatestVideos,
  getMostViewedVideos,
  getPlaylist,
  getPlaylists,
  getTrendingVideos,
  getVideosByCategory,
} from '@/lib/videos';

// صفحة مكتبة الفيديو (Path A — **Reuse 100%**؛ بلا Builder/إدارة/باك إند/API/Migration). **كلّ التنسيق من الإدارة الحاليّة**
// مع **تكيّف ببيانات حقيقيّة** (لا تلفيق): هيرو = **فيديو مميّز، وإلا أحدث فيديو** · كاروسيلات = **القوائم (المميّزة أوّلاً ثمّ
// sort_order)، لا تختفي عند غياب المميّز** · رفوف تصنيف من التصنيفات الموجودة (مُشتقّة) · رفوف ذكيّة (أحدث/رائج/الأكثر مشاهدة)
// بمشاهدات حقيقيّة. الترويسة فوريّة والمحتوى يبثّ عبر `<Suspense>` داخليّ (لا `loading.tsx` على المسار). صفر hardcoding/بيانات
// وهمية؛ قسم بلا بيانات حقيقيّة يُخفى؛ لا محتوى إطلاقاً ⇒ EmptyState.
// ISR = سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر video-feed:{locale} من كلّ أكشن فيديو/قائمة.
// نُقِلت إلى /news/videos (2026-07-18)؛ /videos القديم يُعيد التوجيه 301 عبر next.config.ts.
export const revalidate = 36000;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'فيديو',
    description: 'أحدث الفيديوهات ومقاطع الأخبار والتقارير المصوّرة',
    path: '/news/videos',
    type: 'website',
  });
}

const MAX_CATEGORY_RAILS = 8;

export default function VideosPage() {
  return (
    <Container className="py-8 sm:py-10">
      <div className="mb-8 flex items-start gap-3 border-b border-border pb-5">
        <span className="mt-1 h-9 w-1.5 shrink-0 bg-primary" aria-hidden />
        <div>
          <h1 className="font-heading text-h1 font-extrabold leading-tight text-fg">فيديو</h1>
          <p className="mt-1.5 text-sm text-muted">مكتبة الفيديو — أحدث المقاطع وقوائم التشغيل.</p>
        </div>
      </div>

      <Suspense fallback={<VideosIndexSkeleton />}>
        <VideosIndexContent />
      </Suspense>
    </Container>
  );
}

async function VideosIndexContent() {
  // الدفعة الأولى: ما يلزم دائماً + ما يقرّر الإظهار.
  const [featured, latestPool, playlists] = await Promise.all([
    getFeaturedVideos(12),
    getLatestVideos(30),
    getPlaylists(24),
  ]);

  // هيرو: فيديو مميّز إن وُجد، **وإلا أحدث فيديو تلقائيّاً** (تكيّف ببيانات حقيقيّة، لا تلفيق). يُستبعَد من أقسام «الأحدث» (لا تكرار).
  const heroVideo = featured[0] ?? latestPool[0] ?? null;
  const latestRest = heroVideo ? latestPool.filter((v) => v.id !== heroVideo.id) : latestPool;
  const spotlightLead = latestRest[0] ?? null;
  const spotlightItems = latestRest.slice(1, 6);
  const restLatest = latestRest.slice(6, 18);

  // رفوف التفاعل ذات معنى فقط بوجود مشاهدات حقيقيّة — وإلا فهي تكرار للأحدث ⇒ تُخفى (صدق، لا تكرار، لا fallback).
  const hasViews = latestPool.some((v) => v.views > 0);

  // اكتشاف التصنيفات **من البيانات الموجودة فقط** (من الأحدث) — لا slug ثابت.
  const discovered = new Map<string, string>();
  for (const v of latestPool) {
    if (v.category && !discovered.has(v.category.slug)) discovered.set(v.category.slug, v.category.name);
  }

  // الدفعة الثانية: **لا نجلب إلا ما سيُعرَض فعلاً** (لا طلبات لرفوف مخفيّة).
  const [trending, mostViewed, categoryRailsRaw, playlistRailsRaw] = await Promise.all([
    hasViews ? getTrendingVideos(12) : Promise.resolve([]),
    hasViews ? getMostViewedVideos(12) : Promise.resolve([]),
    Promise.all(
      [...discovered.entries()].slice(0, MAX_CATEGORY_RAILS).map(async ([slug, name]) => ({
        slug,
        name,
        videos: await getVideosByCategory(slug, 12),
      })),
    ),
    // كاروسيلات الهوم = كلّ القوائم ذات الأعضاء، **المميّزة أوّلاً** ثمّ sort_order (لا اختفاء عند غياب المميّز؛ التمييز يمنح الأولوية). سقف 8.
    Promise.all(
      [...playlists.filter((p) => p.videosCount > 0)]
        .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
        .slice(0, 8)
        .map((p) => getPlaylist(p.slug)),
    ),
  ]);
  const categoryRails = categoryRailsRaw.filter((c) => c.videos.length > 0);
  const playlistRails = playlistRailsRaw.filter((p): p is NonNullable<typeof p> => p !== null);

  const hasAny =
    Boolean(heroVideo) ||
    Boolean(spotlightLead) ||
    categoryRails.length > 0 ||
    playlistRails.length > 0 ||
    (hasViews && (trending.length > 0 || mostViewed.length > 0));

  if (!hasAny) return <VideoEmptyState />;

  return (
    <div className="vid-rise space-y-12 sm:space-y-16">
      <HeroVideo video={heroVideo} />

      {/* الكاروسيلات = القوائم (المميّزة أوّلاً ثمّ sort_order) — أبرز محتوى تحريريّ بعد الهيرو؛ لا تختفي عند غياب المميّز */}
      {playlistRails.map((pl) => (
        <PlaylistRail key={pl.id} playlist={pl} id={`videos-playlist-${pl.id}`} />
      ))}

      {spotlightLead && (
        <section aria-labelledby="videos-spotlight">
          <SectionHeader title="أحدث الفيديوهات" id="videos-spotlight" />
          <VideoSpotlight lead={spotlightLead} items={spotlightItems} />
        </section>
      )}

      {restLatest.length >= 3 && (
        <CategoryRail title="مزيد من الأحدث" videos={restLatest} id="videos-more-latest" />
      )}

      {/* استبعاد فيديو الهيرو من الرفوف الذكيّة أيضاً (لا تكرار عبر الأقسام) */}
      {hasViews && (
        <CategoryRail title="الرائج الآن" videos={trending.filter((v) => v.id !== heroVideo?.id)} id="videos-trending" />
      )}
      {hasViews && (
        <CategoryRail
          title="الأكثر مشاهدة"
          videos={mostViewed.filter((v) => v.id !== heroVideo?.id)}
          id="videos-most-viewed"
        />
      )}

      {/* «مميّزة»: فيديوهات مميّزة أخرى عدا فيديو الهيرو (featured[0]=الهيرو؛ تُخفى إن لم توجد) */}
      <CategoryRail title="مميّزة" videos={featured.slice(1)} id="videos-featured" />

      {categoryRails.map((c, i) => (
        <CategoryRail key={c.slug} title={c.name} videos={c.videos} id={`videos-cat-${i}`} />
      ))}
    </div>
  );
}

// هيكل تحميل الفهرس (Skeleton) — كان `loading.tsx`؛ نُقِل إلى Suspense داخليّ كي لا يغلّف صفحة المشاهدة.
function VideosIndexSkeleton() {
  return (
    <div className="space-y-12 sm:space-y-16">
      <div>
        <SectionHeaderSkeleton />
        <SpotlightSkeleton />
      </div>
      {[0, 1].map((i) => (
        <div key={i}>
          <SectionHeaderSkeleton />
          <VideoRailSkeleton />
        </div>
      ))}
    </div>
  );
}
