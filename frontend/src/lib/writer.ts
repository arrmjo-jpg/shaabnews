import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';
import { ItemSchema, mapItem, type FeedItem } from './feed';

// بروفيل الكاتب العامّ — `GET /{locale}/writers/{id}` (الباك إند يبوّبه بـ is_writer نشِط؛ غيره ⇒ 404).
// حقول آمنة للنشر فقط: الاسم/الصورة/النبذة/روابط السوشيل/عدد المقالات. فشل/404 ⇒ null.
const WriterSchema = z
  .object({
    data: z
      .object({
        id: z.number(),
        name: z.string(),
        slug: z.string().nullish(),
        avatar: z.string().nullish(),
        bio: z.string().nullish(),
        social_links: z.record(z.string(), z.string()).nullish(),
        articles_count: z.number().nullish(),
        last_activity_at: z.string().nullish(),
      })
      .nullish(),
  })
  .passthrough();

export interface WriterProfile {
  id: number;
  name: string;
  // مصدر الحقيقة الوحيد: User::getSlugAttribute() بالباك إند (SlugGenerator::makeWithFallback) —
  // لا حساب سلَغ بالواجهة أبداً. فارغ فقط إن غاب الحقل من استجابة قديمة مخزَّنة مؤقتاً.
  slug: string;
  avatar: string | null;
  bio: string | null;
  social: Record<string, string>;
  articlesCount: number;
  lastActivityAt: string | null;
}

export const getWriterProfile = cache(async (id: number, locale = 'ar'): Promise<WriterProfile | null> => {
  if (!env.apiBaseUrl || !Number.isFinite(id)) return null;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/writers/${id}`, {
      next: { revalidate: 36000, tags: ['writers', `writer:${id}`] }, // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ.
    });
    if (!res.ok) return null;
    const parsed = WriterSchema.safeParse(await res.json());
    const d = parsed.success ? parsed.data.data : null;
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      slug: d.slug ?? '',
      avatar: d.avatar ?? null,
      bio: d.bio?.trim() || null,
      social: d.social_links ?? {},
      articlesCount: d.articles_count ?? 0,
      lastActivityAt: d.last_activity_at ?? null,
    };
  } catch {
    return null;
  }
});

// صفحة مقالات كاتب — `GET /{locale}/writers/{id}/articles` (wrapper خفيف حول
// ListPublicArticlesAction، انظر WriterArticlesController بالباك إند) — نفس مغلّف الترقيم
// {data, meta.pagination} المستخدَم بـgetCategoryPage (lib/feed.ts)، لذا نعيد استخدام
// ItemSchema/mapItem/FeedItem منه بدل تكرار التحليل.
export interface WriterPageResult {
  items: FeedItem[];
  total: number;
  page: number;
  totalPages: number;
}

const WriterArticlesEnvelope = z
  .object({
    data: z.array(ItemSchema).nullish(),
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

export const getWriterArticles = cache(
  async (id: number, page = 1, perPage = 18, locale = 'ar'): Promise<WriterPageResult> => {
    const empty: WriterPageResult = { items: [], total: 0, page, totalPages: 0 };
    if (!env.apiBaseUrl || !Number.isFinite(id)) return empty;
    try {
      // sort مُمرَّر صراحةً (رغم أنّ الباك إند يطبّق نفس القيمة افتراضياً عبر defaultSort('-published_at')
      // في ListPublicArticlesAction) — مطابقةً لاختيار getCategoryPage الصريح نفسه، حتى لا يعتمد
      // ترتيب صفحة الكاتب على افتراضٍ ضمنيّ قد يتغيّر مستقبلاً بمعزل عن صفحة القسم.
      const qs = new URLSearchParams({
        per_page: String(perPage),
        page: String(Math.max(1, page)),
        sort: '-published_at',
      });
      const res = await fetch(
        `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/writers/${id}/articles?${qs.toString()}`,
        {
          headers: env.internalHeaders,
          next: { revalidate: 36000, tags: ['articles', `writer:${id}`] }, // ISR — سقف أمان فقط.
        },
      );
      if (!res.ok) return empty;
      const parsed = WriterArticlesEnvelope.safeParse(await res.json());
      if (!parsed.success) return empty;
      const items = await Promise.all((parsed.data.data ?? []).map(mapItem));
      const pg = parsed.data.meta?.pagination;
      return {
        items,
        total: pg?.total ?? items.length,
        page: pg?.current_page ?? page,
        totalPages: pg?.total_pages ?? 1,
      };
    } catch {
      return empty;
    }
  },
);
