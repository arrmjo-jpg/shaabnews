import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// عنصر تغذية جاهز للعرض (view-model) — لا يتسرّب شكل الـAPI الخام إلى العارض.
export interface FeedItem {
  id: number;
  title: string;
  excerpt: string | null;
  href: string;
  image: string | null;
  imageAlt: string;
  category: string | null;
  categoryHref: string | null;
  author: { id: number | null; name: string; avatar: string | null; isWriter: boolean } | null;
  publishedAt: string | null;
  badge: { kind: 'live' | 'breaking'; label: string } | null;
}

// اسم متوافق مع المستهلك القديم (الهيرو).
export type HeroItem = FeedItem;

const CoverSchema = z
  .object({
    url: z.string().nullish(),
    medium: z.string().nullish(),
    thumb: z.string().nullish(),
    alt: z.string().nullish(),
  })
  .nullish();

export const ItemSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    subtitle: z.string().nullish(),
    excerpt: z.string().nullish(),
    canonical_path: z.string().nullish(),
    published_at: z.string().nullish(),
    is_breaking: z.boolean().nullish(),
    is_live: z.boolean().nullish(),
    primary_category: z.object({ name: z.string().nullish(), slug: z.string().nullish() }).nullish(),
    author: z
      .object({
        id: z.number().nullish(),
        name: z.string().nullish(),
        avatar: z.string().nullish(),
        is_writer: z.boolean().nullish(),
      })
      .nullish(),
    cover: CoverSchema,
  })
  .passthrough();

type Item = z.infer<typeof ItemSchema>;

const EnvelopeSchema = z.object({ data: z.array(ItemSchema).nullish() }).passthrough();

// نزع بادئة اللغة من canonical_path، ثمّ تطبيع مسار المقال القانوني من الباك إند (Article::canonicalPath،
// وفق ADR A3.6): /article/{id} (بالمفرد، بلا slug) → مسار الواجهة الفعليّ /articles/{id} (بالجمع؛
// صفحة /articles/[idslug] تقبل id مجرّداً أو id-slug). بلا هذا التطبيع تُصبح روابط كلّ مقال معطوبة.
function localeless(path: string | null | undefined): string {
  if (!path) return '#';
  const stripped = path.replace(/^\/[a-z]{2}(?=\/)/, '');
  if (!stripped) return '#';
  return stripped.replace(/^\/article\//, '/articles/');
}

// شارة الكرت من أعلام حقيقية فقط: تغطية مباشرة (live) تسبق عاجل (breaking)؛ غير ذلك ⇒ بلا شارة.
function toBadge(item: Item): FeedItem['badge'] {
  if (item.is_live) return { kind: 'live', label: 'تغطية مباشرة' };
  if (item.is_breaking) return { kind: 'breaking', label: 'عاجل' };
  return null;
}

export function mapItem(it: Item): FeedItem {
  const slug = it.primary_category?.slug;
  return {
    id: it.id,
    title: it.title,
    excerpt: (it.excerpt ?? it.subtitle ?? '').trim() || null,
    href: localeless(it.canonical_path),
    image: it.cover?.medium ?? it.cover?.url ?? null,
    imageAlt: it.cover?.alt ?? it.title,
    category: it.primary_category?.name ?? null,
    categoryHref: slug ? `/category/${encodeURIComponent(slug)}` : null,
    author: it.author?.name
      ? {
          id: typeof it.author.id === 'number' ? it.author.id : null,
          name: it.author.name,
          avatar: it.author.avatar ?? null,
          isWriter: !!it.author.is_writer,
        }
      : null,
    publishedAt: it.published_at ?? null,
    badge: toBadge(it),
  };
}

// مُحلّل تغذية عامّ (resolver) قابل للكاش: زون (hero/header/breaking/editors_pick/latest) + حدّ + TTL.
// نقيّ، ISR + tags؛ أي فشل/فراغ ⇒ [] (عزل فشل الكتلة، لا تلفيق بيانات).
const fetchFeed = cache(
  async (kind: string, limit: number, locale: string, revalidate: number): Promise<FeedItem[]> => {
    if (!env.apiBaseUrl) return [];
    try {
      const res = await fetch(
        `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/feed/${kind}?limit=${limit}`,
        { headers: env.internalHeaders, next: { revalidate, tags: ['articles', `feed:${kind}`] } },
      );
      if (!res.ok) return [];
      const parsed = EnvelopeSchema.safeParse(await res.json());
      if (!parsed.success) return [];
      return (parsed.data.data ?? []).map(mapItem);
    } catch {
      return [];
    }
  },
);

// كتلة الهيرو: الأخبار المميّزة (is_featured) — حدّ 5 (= hero(source:featured,limit:5))، ISR 300s.
export const getHeroFeed = (locale = 'ar') => fetchFeed('hero', 5, locale, 300);

// كتلة «آخر المستجدات»: أخبار الهيدر (is_header) — حدّ 9 (كرت رئيسيّ + شبكة 8)، ISR 300s.
export const getHeaderFeed = (locale = 'ar') => fetchFeed('header', 9, locale, 300);

// شريط الأخبار العاجلة (is_breaking) — حدّ 10، ISR 60s (عاجل = تحديث أسرع).
export const getBreakingFeed = (locale = 'ar') => fetchFeed('breaking', 10, locale, 60);

// صفحة «آخر المستجدات» /latest: أحدث الأخبار المنشورة — حدّ 30، ISR 60s (أحدث = تحديث أسرع).
export const getLatestFeed = (locale = 'ar') => fetchFeed('latest', 30, locale, 60);

// كتلة «الأكثر شيوعا»: الأكثر قراءة (مشاهدات مُتتبَّعة، بلا نافذة 7 أيام الضيّقة) — المطابق الدلاليّ
// لـ«الأكثر شيوعا/الأكثر قراءة». endpoint مستقلّ بمُعامل per_page (ليس /feed/{kind})، لكنّه يعيد نفس
// مغلّف {data:[…]} ومورد القائمة ⇒ إعادة استخدام EnvelopeSchema/mapItem. ISR 300s؛ أي فشل ⇒ [] (عزل الكتلة).
// (الرائج /articles/trending متاح أيضاً لكن نافذته 7 أيام تُفرغه إن لم يوجد محتوى حديث.)
export const getMostReadFeed = cache(async (locale = 'ar', limit = 6): Promise<FeedItem[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(
      `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/articles/most-read?per_page=${limit}`,
      { headers: env.internalHeaders, next: { revalidate: 300, tags: ['articles', 'feed:most_read'] } },
    );
    if (!res.ok) return [];
    const parsed = EnvelopeSchema.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.data ?? []).map(mapItem);
  } catch {
    return [];
  }
});

// تصنيف بالـ**ID الثابت** — الـslug والاسم الحاليّان. الـID لا يتغيّر؛ الـslug يتغيّر بإعادة التسمية من
// الإدارة ⇒ مرجعة الأقسام بالـID تمنع كسر الرئيسيّة (نبض الشارع→نبض البلد). الباك إند لا يدعم
// `/categories/{id}` ولا `filter[category_id]` (slug فقط)، فنفهرس شجرة `/categories` مرّةً (مُكاش، ISR
// 300s) بالـID ونحلّ منها الـslug/الاسم الحاليّين لتمريرهما لـ`getCategoryFeed`/العنوان.
export interface CategoryRef {
  id: number;
  name: string;
  slug: string;
}

const fetchCategoryIndex = cache(async (locale: string): Promise<Map<number, CategoryRef>> => {
  const index = new Map<number, CategoryRef>();
  if (!env.apiBaseUrl) return index;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/categories`, {
      headers: env.internalHeaders,
      next: { revalidate: 300, tags: ['categories'] },
    });
    if (!res.ok) return index;
    const json: unknown = await res.json();
    const root = (json as { data?: unknown }).data;
    if (!Array.isArray(root)) return index;
    const walk = (nodes: unknown[]): void => {
      for (const raw of nodes) {
        const n = raw as { id?: unknown; name?: unknown; slug?: unknown; children?: unknown };
        if (typeof n.id === 'number' && typeof n.slug === 'string' && n.slug) {
          index.set(n.id, { id: n.id, name: typeof n.name === 'string' ? n.name : '', slug: n.slug });
        }
        if (Array.isArray(n.children)) walk(n.children);
      }
    };
    walk(root);
    return index;
  } catch {
    return index;
  }
});

// تصنيف بالـID (مقاوم لإعادة التسمية). غير موجود/محذوف ⇒ null.
export const getCategoryById = cache(
  async (id: number, locale = 'ar'): Promise<CategoryRef | null> => (await fetchCategoryIndex(locale)).get(id) ?? null,
);

// تصنيف بالـslug (من رابط /category/[slug]) — لحلّ الاسم والتحقّق من وجود القسم. غير موجود ⇒ null.
// يعيد استخدام فهرس الأقسام المُكاش (fetchCategoryIndex) — لا طلب إضافيّ.
export const getCategoryBySlug = cache(async (slug: string, locale = 'ar'): Promise<CategoryRef | null> => {
  for (const ref of (await fetchCategoryIndex(locale)).values()) {
    if (ref.slug === slug) return ref;
  }

  return null;
});

// مقالات تصنيف محدّد (slug) — قائمة المقالات العامّة بمرشّح allow-list `filter[category]`.
// نفس مغلّف {data:[…]} ومورد القائمة ⇒ إعادة استخدام mapItem. ISR 300s؛ فشل ⇒ [] (عزل الكتلة).
export const getCategoryFeed = cache(
  async (slug: string, limit = 4, locale = 'ar'): Promise<FeedItem[]> => {
    if (!env.apiBaseUrl) return [];
    try {
      const qs = new URLSearchParams({ per_page: String(limit), sort: '-published_at' });
      qs.set('filter[category]', slug);
      const res = await fetch(
        `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/articles?${qs.toString()}`,
        { headers: env.internalHeaders, next: { revalidate: 300, tags: ['articles', `category:${slug}`] } },
      );
      if (!res.ok) return [];
      const parsed = EnvelopeSchema.safeParse(await res.json());
      if (!parsed.success) return [];
      return (parsed.data.data ?? []).map(mapItem);
    } catch {
      return [];
    }
  },
);

// ─── صفحة قسم مُرقَّمة (/category/[slug]) — عناصر القسم + بيانات الترقيم (total/total_pages) ───
// نفس نقطة القائمة (filter[category]) لكن بوضع offset (يعيد meta.pagination). فشل/غياب ⇒ نتيجة فارغة.
export interface CategoryPageResult {
  items: FeedItem[];
  total: number;
  page: number;
  totalPages: number;
}

const PaginatedEnvelope = z
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

export const getCategoryPage = cache(
  async (slug: string, page = 1, perPage = 18, locale = 'ar'): Promise<CategoryPageResult> => {
    const empty: CategoryPageResult = { items: [], total: 0, page, totalPages: 0 };
    if (!env.apiBaseUrl) return empty;
    try {
      const qs = new URLSearchParams({
        per_page: String(perPage),
        page: String(Math.max(1, page)),
        sort: '-published_at',
      });
      qs.set('filter[category]', slug);
      const res = await fetch(
        `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/articles?${qs.toString()}`,
        { headers: env.internalHeaders, next: { revalidate: 300, tags: ['articles', `category:${slug}`] } },
      );
      if (!res.ok) return empty;
      const parsed = PaginatedEnvelope.safeParse(await res.json());
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
