import 'server-only';
import { z } from 'zod';

import { apiFetch } from './auth';
import { ItemSchema, mapItem, type FeedItem } from './feed';
import { ReelSchema, mapReel, type ReelItem } from './reels';
import { VideoSchema, mapVideo, type VideoItem } from './videos';

// طبقة بيانات **نشاط المستخدم العامّة** — المصدر الوحيد لكلّ نشاطات الحساب فوق User Activity API
// (`GET /account/activity`). تخدم liked/saved الآن، وأيّ نشاط مستقبليّ (history/continue/…) بتمرير
// سلسلة activity فقط — **دون APIs/Views جديدة لكلّ ميزة**. تعيد استخدام مابرز العرض الموجودة
// (mapItem/mapVideo/mapReel) ⇒ **صفر تكرار منطق تحويل**. per-user عبر apiFetch (Bearer، no-store).

export type ActivityKind = 'liked' | 'saved'; // مستقبلاً: | 'history' | 'continue'
export type ActivityContentType = 'article' | 'video' | 'reel';
export type ActivityTab = 'all' | ActivityContentType;

// عنصر نشاط موحّد (تمييز بالنوع) — يحمل نفس view-model البطاقة الموجودة لكلّ نوع.
export type ActivityItem =
  | { contentType: 'article'; data: FeedItem }
  | { contentType: 'video'; data: VideoItem }
  | { contentType: 'reel'; data: ReelItem };

export interface ActivityPage {
  items: ActivityItem[];
  pagination: { currentPage: number; totalPages: number; total: number };
}

const EnvelopeSchema = z
  .object({
    data: z.array(z.object({ content_type: z.string(), item: z.unknown() })).nullish(),
    meta: z
      .object({
        pagination: z
          .object({
            total: z.number().nullish(),
            current_page: z.number().nullish(),
            total_pages: z.number().nullish(),
          })
          .nullish(),
      })
      .nullish(),
  })
  .passthrough();

const EMPTY: ActivityPage = { items: [], pagination: { currentPage: 1, totalPages: 1, total: 0 } };

export async function getMyActivity(
  activity: ActivityKind,
  contentType: ActivityTab,
  page = 1,
): Promise<ActivityPage> {
  const qs = new URLSearchParams({ activity, page: String(page) });
  if (contentType !== 'all') qs.set('content_type', contentType);

  const res = await apiFetch(`/api/v1/account/activity?${qs.toString()}`);
  if (!res?.ok) return EMPTY;

  const parsed = EnvelopeSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return EMPTY;

  const items: ActivityItem[] = [];
  for (const row of parsed.data.data ?? []) {
    const mapped = await mapRow(row.content_type, row.item);
    if (mapped) items.push(mapped);
  }

  const p = parsed.data.meta?.pagination;
  return {
    items,
    pagination: {
      currentPage: p?.current_page ?? page,
      totalPages: p?.total_pages ?? 1,
      total: p?.total ?? items.length,
    },
  };
}

// يربط عنصر الاستجابة بـ view-model عبر **المابر الموجود** لكلّ نوع (لا تكرار، لا بطاقة جديدة).
async function mapRow(contentType: string, item: unknown): Promise<ActivityItem | null> {
  if (contentType === 'article') {
    const p = ItemSchema.safeParse(item);
    return p.success ? { contentType: 'article', data: await mapItem(p.data) } : null;
  }
  if (contentType === 'video') {
    const p = VideoSchema.safeParse(item);
    return p.success ? { contentType: 'video', data: mapVideo(p.data) } : null;
  }
  if (contentType === 'reel') {
    const p = ReelSchema.safeParse(item);
    return p.success ? { contentType: 'reel', data: mapReel(p.data) } : null;
  }
  return null;
}
