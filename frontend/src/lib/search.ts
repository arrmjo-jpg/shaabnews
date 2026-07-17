import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';
import { type FeedItem, ItemSchema, mapItem } from './feed';

// نتيجة بحث الأخبار (view-model) — عناصر جاهزة للعرض + ترقيم.
export interface SearchResult {
  items: FeedItem[];
  total: number;
  page: number;
  totalPages: number;
}

// مغلّف قائمة المقالات: data[] + meta.pagination (وضع offset في ListPublicArticlesAction).
const SearchEnvelope = z
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

// بحث الأخبار عبر مرشّح allow-list `filter[q]` (Scout/Meilisearch في الباك إند، متن كامل + تسامح
// أخطاء). يعيد استخدام ItemSchema/mapItem من feed.ts (صفر تكرار). فشل/غياب/خطأ ⇒ نتيجة فارغة
// (تدهور رشيق — يطابق تدهور الباك إند عند تعطّل المحرّك). ISR قصير لتخفيف ضغط الاستعلامات المتكرّرة.
export const searchArticles = cache(
  async (query: string, page = 1, locale = 'ar', perPage = 20): Promise<SearchResult> => {
    const q = query.trim();
    const empty: SearchResult = { items: [], total: 0, page, totalPages: 0 };
    if (!env.apiBaseUrl || q === '') return empty;
    try {
      // بلا sort: يُبقي الباك‑إند ترتيب صلة Meilisearch (العنوان أوّلًا) بدل التاريخ.
      const qs = new URLSearchParams({
        per_page: String(perPage),
        page: String(Math.max(1, page)),
      });
      qs.set('filter[q]', q);
      const res = await fetch(
        `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/articles?${qs.toString()}`,
        { headers: env.internalHeaders, next: { revalidate: 36000, tags: ['articles', 'search'] } }, // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ.
      );
      if (!res.ok) return empty;
      const parsed = SearchEnvelope.safeParse(await res.json());
      if (!parsed.success) return empty;
      const items = (parsed.data.data ?? []).map(mapItem);
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
