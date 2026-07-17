import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import type {
  BroadcastCard,
  BroadcastDetail,
  BroadcastKind,
  BroadcastPlayback,
  BroadcastSourceType,
  BroadcastStatus,
} from './broadcast-types';
import { env } from './env';

// طبقة بيانات البثّ — تعيد استخدام النقاط العامّة القائمة (صفر باك إند جديد):
//   GET /api/v1/{kind}          → قائمة بثّ النوع (live: scheduled|live · tv/radio: دليل دائم)
//   GET /api/v1/{kind}/{slug}   → تفاصيل + playback (source يُكشَف للـ live فقط)
// **بلا بادئة لغة** (نطاق البثّ عربيّ مستقلّ). server-only + cache() + ISR قصير (البثّ متغيّر)
// + null/[] عند أي فشل (لا تلفيق). أنواع: live (حدث) · tv (قناة) · radio (صوت).

const REVALIDATE = 36000; // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر FrontendRevalidate::tags() في كلّ انتقال حالة.
const feedTag = (kind: string) => `broadcast-feed:${kind}`;
const itemTag = (kind: string, slug: string) => `broadcast:${kind}:${slug}`;
const enc = encodeURIComponent;

export type {
  BroadcastCard,
  BroadcastDetail,
  BroadcastKind,
  BroadcastPlayback,
  BroadcastSourceType,
  BroadcastStatus,
} from './broadcast-types';

const CategorySchema = z.object({ id: z.number(), name: z.string(), slug: z.string() });

const CardSchema = z
  .object({
    id: z.number(),
    kind: z.string(),
    status: z.string(),
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().nullish(),
    description: z.string().nullish(),
    source_type: z.string(),
    is_featured: z.boolean().nullish(),
    viewer_count: z.number().nullish(),
    metrics: z.object({ likes: z.number().nullish(), dislikes: z.number().nullish() }).nullish(),
    scheduled_at: z.string().nullish(),
    started_at: z.string().nullish(),
    ended_at: z.string().nullish(),
    canonical_path: z.string().nullish(),
    share_image: z.string().nullish(),
    category: CategorySchema.nullish(),
  })
  .passthrough();

const PlaybackSchema = z
  .object({
    state: z.string(),
    source: z.object({ type: z.string(), url: z.string() }).nullish(),
    starts_at: z.string().nullish(),
    vod: z.object({ id: z.number(), slug: z.string(), canonical_path: z.string() }).nullish(),
  })
  .passthrough();

const DetailSchema = CardSchema.extend({ playback: PlaybackSchema.nullish() });

const ListEnvelope = z.object({ data: z.array(CardSchema).nullish() }).passthrough();
const ItemEnvelope = z.object({ data: DetailSchema.nullish() }).passthrough();

type RawCard = z.infer<typeof CardSchema>;
type RawDetail = z.infer<typeof DetailSchema>;

function mapCard(r: RawCard): BroadcastCard {
  return {
    id: r.id,
    kind: r.kind as BroadcastKind,
    status: r.status as BroadcastStatus,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt ?? null,
    description: r.description ?? null,
    sourceType: r.source_type as BroadcastSourceType,
    isFeatured: r.is_featured ?? false,
    viewerCount: r.viewer_count ?? 0,
    metrics: { likes: r.metrics?.likes ?? 0, dislikes: r.metrics?.dislikes ?? 0 },
    scheduledAt: r.scheduled_at ?? null,
    startedAt: r.started_at ?? null,
    endedAt: r.ended_at ?? null,
    href: r.canonical_path ?? '#',
    shareImage: r.share_image ?? null,
    category: r.category ?? null,
  };
}

function mapDetail(r: RawDetail): BroadcastDetail {
  const p = r.playback;
  return {
    ...mapCard(r),
    playback: {
      state: (p?.state ?? 'unavailable') as BroadcastPlayback['state'],
      source: p?.source ? { type: p.source.type as BroadcastSourceType, url: p.source.url } : null,
      startsAt: p?.starts_at ?? null,
      vod: p?.vod ? { id: p.vod.id, slug: p.vod.slug, href: p.vod.canonical_path } : null,
    },
  };
}

// per_page مرتفع (الأقصى المسموح) بدل الافتراضيّ (15): نجلب البثّ/القنوات كاملةً لتعرضها الصفحة
// مع كشف تدريجيّ (تمرير/«تحميل المزيد») بدل قصّ ثابت. الباك إند يحدّه بـperformance.pagination.max.
const FEED_PER_PAGE = 100;

async function fetchList(kind: BroadcastKind): Promise<BroadcastCard[]> {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${enc(kind)}?per_page=${FEED_PER_PAGE}`, {
      headers: env.internalHeaders,
      next: { revalidate: REVALIDATE, tags: [feedTag(kind)] },
    });
    if (!res.ok) return [];
    const parsed = ListEnvelope.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.data ?? []).map(mapCard);
  } catch {
    return [];
  }
}

/** بثّ نوع live (scheduled|live)، الأحدث ترتيباً. فشل/فراغ ⇒ []. */
export const getLiveKindFeed = cache((): Promise<BroadcastCard[]> => fetchList('live'));

/** قنوات/محطّات دائمة (tv|radio). */
export const getChannels = cache((kind: 'tv' | 'radio'): Promise<BroadcastCard[]> => fetchList(kind));

/** البثوث المباشرة الآن (status=live) فقط — للهيدر/الهوم. */
export const getLiveNow = cache(async (): Promise<BroadcastCard[]> => {
  const feed = await getLiveKindFeed();
  return feed.filter((b) => b.status === 'live');
});

/** أقرب بثّ مجدوَل قادم (status=scheduled) أو null. */
export const getNextUpcoming = cache(async (): Promise<BroadcastCard | null> => {
  const feed = await getLiveKindFeed();
  const upcoming = feed
    .filter((b) => b.status === 'scheduled' && b.scheduledAt)
    .sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));
  return upcoming[0] ?? null;
});

/**
 * تفاصيل بثّ بالنوع + slug (مع playback). 404 حقيقيّ ⇒ null فوراً؛ أمّا فشل الشبكة/5xx العابر
 * (شائع على خادم dev الخلفيّ أحاديّ الخيط تحت ضغط جلب SSR المتزامن) فيُعاد حتى 3 محاولات قبل
 * إرجاع null — مرونة تجعل الصفحة تُحمَّل بثبات (وتفيد الإنتاج أيضاً).
 */
export const getBroadcast = cache(async (kind: BroadcastKind, slug: string): Promise<BroadcastDetail | null> => {
  if (!env.apiBaseUrl) return null;
  // Next يمرّر `slug` مُرمَّزاً مسبقاً (percent-encoded)؛ نُطبّعه إلى ترميزٍ واحد فلا يتضاعف
  // (%25D8… ⇒ 404). decode ثمّ encode يعمل سواء وصل مُرمَّزاً أو خامّاً.
  let safeSlug: string;
  try {
    safeSlug = encodeURIComponent(decodeURIComponent(slug));
  } catch {
    safeSlug = encodeURIComponent(slug);
  }
  const url = `${env.apiBaseUrl}/api/v1/${enc(kind)}/${safeSlug}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: env.internalHeaders,
        next: { revalidate: REVALIDATE, tags: [itemTag(kind, slug)] },
        signal: AbortSignal.timeout(6000), // مهلة لكلّ محاولة — لا تعليق على خادم بطيء
      });
      if (res.status === 404) return null; // غير موجود فعلاً
      if (!res.ok) throw new Error(`status ${res.status}`); // عابر ⇒ محاولة أخرى
      const parsed = ItemEnvelope.safeParse(await res.json());
      if (!parsed.success || !parsed.data.data) return null;
      return mapDetail(parsed.data.data);
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
});
