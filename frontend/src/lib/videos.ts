import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// مكتبة الفيديو — طبقة بيانات **مستقلّة تماماً** عن الأخبار والريلز (نطاق Video Library في الباك إند).
// تجمّع كلّ مصادر الفيديو العامّة الموجودة (إعادة استخدام بحتة، صفر تغيير باك إند): أحدث/مميّز/رائج/الأكثر
// مشاهدة/حسب التصنيف/ذات صلة + قوائم التشغيل (فهرس/تفاصيل). كلّها server-only + React cache() (دمج طلبات
// لكلّ طلب صفحة) + ISR (revalidate) + وسوم كاش؛ وأيّ فشل/فراغ ⇒ [] أو null (عزل، لا تلفيق).
//
// النقاط (مؤكَّدة من Actions الباك إند):
//   GET /{locale}/videos?per_page&sort=-published_at|-views_count   (sort allow-list: published_at, views_count)
//   GET /{locale}/videos/featured?per_page                          (is_featured؛ ≤50)
//   GET /{locale}/videos/trending?per_page                          (موزون بالتفاعل؛ ≤50)
//   GET /{locale}/video-categories/{slug}?per_page                  (تصنيف نشِط؛ غيره ⇒ 404)
//   GET /{locale}/videos/{slug}/related?per_page                    (نفس التصنيف ثمّ الأحدث؛ ≤24)
//   GET /{locale}/playlists?per_page                                (فهرس؛ بلا فيديوهات، عدّاد + غلاف)
//   GET /{locale}/playlists/{slug}                                  (تفاصيل؛ أعضاء مرتّبون بالـ position)
// المظروف القياسيّ: { success, message, data, meta }.

const REVALIDATE = 36000; // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر وسوم القاموس الموحَّد أدناه.
// القاموس الموحَّد (يطابق FrontendCacheTags::fromVideoTags حرفيًّا): القوائم على وسم الخلاصة،
// والتفاصيل على وسم العنصر وحده (فلا يبطل تعديلُ فيديو كلَّ صفحات التفاصيل).
const videoFeedTag = (locale: string) => `video-feed:${locale}`;
const videoTag = (locale: string, slug: string) => `video:${locale}:${slug}`;
const videoCategoryTag = (locale: string, slug: string) => `video-category:${locale}:${slug}`;
const playlistTag = (locale: string, slug: string) => `playlist:${locale}:${slug}`;

const enc = encodeURIComponent;

// بطاقة فيديو موحّدة للواجهة (تُغذّي كلّ الرفوف/البطاقات) — حقول العرض + التشغيل.
export interface VideoItem {
  id: number;
  title: string;
  href: string;
  poster: string | null;
  hls: string | null;
  mp4: string | null;
  youtubeId: string | null;
  durationLabel: string | null;
  durationSeconds: number | null;
  views: number;
  likes: number;
  dislikes: number;
  favorites: number;
  publishedAt: string | null;
  category: { name: string; slug: string } | null;
  isFeatured: boolean;
  sourceType: string | null;
  description: string | null;
}

// قائمة تشغيل موحّدة (الفهرس: videos فارغة + عدّاد؛ التفاصيل: videos مرتّبة بالـ position).
export interface PlaylistItem {
  id: number;
  title: string;
  slug: string;
  href: string;
  description: string | null;
  cover: string | null;
  isFeatured: boolean;
  videosCount: number;
  videos: VideoItem[];
}

export const VideoSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    description: z.string().nullish(),
    excerpt: z.string().nullish(),
    canonical_path: z.string().nullish(),
    share_image: z.string().nullish(),
    duration_seconds: z.number().nullish(),
    source_type: z.string().nullish(),
    is_featured: z.boolean().nullish(),
    published_at: z.string().nullish(),
    category: z.object({ id: z.number().nullish(), name: z.string(), slug: z.string() }).nullish(),
    metrics: z
      .object({
        views: z.number().nullish(),
        likes: z.number().nullish(),
        dislikes: z.number().nullish(),
        favorites: z.number().nullish(),
      })
      .nullish(),
    media: z
      .object({
        kind: z.string().nullish(),
        provider: z.string().nullish(),
        poster: z.string().nullish(),
        hls: z.string().nullish(),
        url: z.string().nullish(),
        embed_url: z.string().nullish(),
        source_url: z.string().nullish(),
        processing_status: z.string().nullish(),
        renditions: z.array(z.object({ url: z.string().nullish() }).passthrough()).nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const PlaylistSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullish(),
    is_featured: z.boolean().nullish(),
    canonical_path: z.string().nullish(),
    cover: z.string().nullish(),
    videos_count: z.number().nullish(),
    videos: z.array(VideoSchema).nullish(),
  })
  .passthrough();

type RawVideo = z.infer<typeof VideoSchema>;
type RawPlaylist = z.infer<typeof PlaylistSchema>;

const VideoListEnvelope = z.object({ data: z.array(VideoSchema).nullish() }).passthrough();
const VideoDetailEnvelope = z.object({ data: VideoSchema.nullish() }).passthrough();
const PlaylistListEnvelope = z.object({ data: z.array(PlaylistSchema).nullish() }).passthrough();
const PlaylistDetailEnvelope = z.object({ data: PlaylistSchema.nullish() }).passthrough();

// نزع بادئة اللغة (الواجهة العامّة بلا /ar|/en).
function localeless(path: string | null | undefined): string {
  if (!path) return '#';
  return path.replace(/^\/[a-z]{2}(?=\/)/, '') || '#';
}

// ثوانٍ → m:ss أو h:mm:ss.
function fmtDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// معرّف يوتيوب من رابط (المصدر الخارجيّ عبر embed_url؛ المرفوع ⇒ null).
function youtubeIdFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function mapVideo(v: RawVideo): VideoItem {
  // الخارجيّ (روابط) يكشف معرّف يوتيوب من embed_url؛ بوستر احتياطيّ من مصغّرة يوتيوب لو غاب.
  const youtubeId = youtubeIdFrom(v.media?.embed_url ?? v.media?.url);
  const ytPoster = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null;
  return {
    id: v.id,
    title: v.title,
    href: localeless(v.canonical_path),
    poster: v.media?.poster ?? v.share_image ?? ytPoster,
    hls: v.media?.hls ?? null,
    mp4: v.media?.renditions?.find((r) => r.url)?.url ?? null,
    youtubeId,
    durationLabel: fmtDuration(v.duration_seconds),
    durationSeconds: v.duration_seconds ?? null,
    views: v.metrics?.views ?? 0,
    likes: v.metrics?.likes ?? 0,
    dislikes: v.metrics?.dislikes ?? 0,
    favorites: v.metrics?.favorites ?? 0,
    publishedAt: v.published_at ?? null,
    category: v.category ? { name: v.category.name, slug: v.category.slug } : null,
    isFeatured: v.is_featured ?? false,
    sourceType: v.source_type ?? null,
    description: v.description ?? v.excerpt ?? null,
  };
}

function mapPlaylist(p: RawPlaylist): PlaylistItem {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    href: localeless(p.canonical_path),
    description: p.description ?? null,
    cover: p.cover ?? null,
    isFeatured: p.is_featured ?? false,
    videosCount: p.videos_count ?? p.videos?.length ?? 0,
    videos: (p.videos ?? []).map(mapVideo),
  };
}

// جالب قائمة بطاقات موحّد (يخدم كلّ نقاط قوائم الفيديو) — فشل/فراغ ⇒ [].
async function fetchCardList(path: string, tags: string[]): Promise<VideoItem[]> {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}${path}`, { headers: env.internalHeaders, next: { revalidate: REVALIDATE, tags } });
    if (!res.ok) return [];
    const parsed = VideoListEnvelope.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.data ?? []).map(mapVideo);
  } catch {
    return [];
  }
}

// ─── الفيديوهات ────────────────────────────────────────────────

/** أحدث الفيديوهات (افتراضيّ -published_at). */
export const getLatestVideos = cache((limit = 6, locale = 'ar'): Promise<VideoItem[]> =>
  fetchCardList(`/api/v1/${enc(locale)}/videos?per_page=${limit}`, [videoFeedTag(locale)]),
);

/** الفيديوهات المميَّزة (is_featured؛ ≤50). */
export const getFeaturedVideos = cache((limit = 12, locale = 'ar'): Promise<VideoItem[]> =>
  fetchCardList(`/api/v1/${enc(locale)}/videos/featured?per_page=${limit}`, [videoFeedTag(locale)]),
);

/** الرائجة (موزونة بالتفاعل؛ ≤50). */
export const getTrendingVideos = cache((limit = 12, locale = 'ar'): Promise<VideoItem[]> =>
  fetchCardList(`/api/v1/${enc(locale)}/videos/trending?per_page=${limit}`, [videoFeedTag(locale)]),
);

/** الأكثر مشاهدة (sort=-views_count؛ ضمن allow-list السماح العامّ). */
export const getMostViewedVideos = cache((limit = 12, locale = 'ar'): Promise<VideoItem[]> =>
  fetchCardList(`/api/v1/${enc(locale)}/videos?per_page=${limit}&sort=-views_count`, [videoFeedTag(locale)]),
);

/** فيديوهات تصنيف بالـ slug (تصنيف نشِط فقط؛ غيره/فشل ⇒ []). */
export const getVideosByCategory = cache((slug: string, limit = 12, locale = 'ar'): Promise<VideoItem[]> =>
  fetchCardList(`/api/v1/${enc(locale)}/video-categories/${enc(slug)}?per_page=${limit}`, [
    videoFeedTag(locale),
    videoCategoryTag(locale, slug),
  ]),
);

/** فيديوهات ذات صلة بفيديو (نفس التصنيف ثمّ الأحدث؛ ≤24). */
export const getRelatedVideos = cache((slug: string, limit = 8, locale = 'ar'): Promise<VideoItem[]> =>
  fetchCardList(`/api/v1/${enc(locale)}/videos/${enc(slug)}/related?per_page=${limit}`, [videoFeedTag(locale)]),
);

/** تفاصيل فيديو واحد بالسلَغ **المجرَّد** (نقطة التفاصيل الموجودة؛ النقطة تقبل السلَغ لا id-slug). غير موجود/فشل ⇒ null. */
export const getVideo = cache(async (slug: string, locale = 'ar'): Promise<VideoItem | null> => {
  if (!env.apiBaseUrl) return null;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${enc(locale)}/videos/${enc(slug)}`, {
      headers: env.internalHeaders,
      // وسم العنصر وحده — تعديل فيديو آخر لا يبطل هذه الصفحة (رفّ «ذات صلة» يحمل وسم الخلاصة بنفسه).
      next: { revalidate: REVALIDATE, tags: [videoTag(locale, slug)] },
    });
    if (!res.ok) return null;
    const parsed = VideoDetailEnvelope.safeParse(await res.json());
    if (!parsed.success || !parsed.data.data) return null;
    return mapVideo(parsed.data.data);
  } catch {
    return null;
  }
});

// ─── قوائم التشغيل ─────────────────────────────────────────────

/** فهرس قوائم التشغيل العامّة (بلا فيديوهات؛ عدّاد + غلاف + is_featured) **مرتَّب بـsort_order** (ترتيب الإدارة). فشل/فراغ ⇒ []. */
export const getPlaylists = cache(async (limit = 12, locale = 'ar'): Promise<PlaylistItem[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${enc(locale)}/playlists?per_page=${limit}&sort=sort_order`, {
      headers: env.internalHeaders,
      // فهرس القوائم على وسم خلاصة الفيديو (أكشنات القوائم تُصدِره عبر fromVideoTags).
      next: { revalidate: REVALIDATE, tags: [videoFeedTag(locale)] },
    });
    if (!res.ok) return [];
    const parsed = PlaylistListEnvelope.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.data ?? []).map(mapPlaylist);
  } catch {
    return [];
  }
});

/** تفاصيل قائمة تشغيل بالـ slug (أعضاء مرتّبون بالـ position؛ غير موجودة/فشل ⇒ null). */
export const getPlaylist = cache(async (slug: string, locale = 'ar'): Promise<PlaylistItem | null> => {
  if (!env.apiBaseUrl) return null;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${enc(locale)}/playlists/${enc(slug)}`, {
      headers: env.internalHeaders,
      next: { revalidate: REVALIDATE, tags: [playlistTag(locale, slug)] },
    });
    if (!res.ok) return null;
    const parsed = PlaylistDetailEnvelope.safeParse(await res.json());
    if (!parsed.success) return null;
    return parsed.data.data ? mapPlaylist(parsed.data.data) : null;
  } catch {
    return null;
  }
});
