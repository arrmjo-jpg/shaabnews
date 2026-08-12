import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { canonicalArticlePath } from './articles';
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
  author: { id: number | null; name: string; slug: string | null; avatar: string | null; isWriter: boolean } | null;
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
    published_at: z.string().nullish(),
    is_breaking: z.boolean().nullish(),
    is_live: z.boolean().nullish(),
    primary_category: z.object({ name: z.string().nullish(), slug: z.string().nullish() }).nullish(),
    author: z
      .object({
        id: z.number().nullish(),
        name: z.string().nullish(),
        slug: z.string().nullish(),
        avatar: z.string().nullish(),
        is_writer: z.boolean().nullish(),
      })
      .nullish(),
    cover: CoverSchema,
  })
  .passthrough();

type Item = z.infer<typeof ItemSchema>;

const EnvelopeSchema = z.object({ data: z.array(ItemSchema).nullish() }).passthrough();

// شارة الكرت من أعلام حقيقية فقط: تغطية مباشرة (live) تسبق عاجل (breaking)؛ غير ذلك ⇒ بلا شارة.
function toBadge(item: Item): FeedItem['badge'] {
  if (item.is_live) return { kind: 'live', label: 'تغطية مباشرة' };
  if (item.is_breaking) return { kind: 'breaking', label: 'عاجل' };
  return null;
}

// href المقال: يُحسَب دوماً من id/published_at (canonicalArticlePath) — لا يُقرأ من canonical_path
// القادم من الباك إند، لأنّه قد يعكس بيانات لم تُهاجَر بعد لسجلّات أقدم (راجع
// docs/architecture/CACHE-INVALIDATION.md — تدقيق روابط 2026-07-18). href القسم: سلسلة الأسلاف
// كاملة (getCategoryAncestry + categoryHref) مطابقةً لـCategory::canonicalPath (الباك إند) —
// مسار مفرد `/category/{slug}` وحده كان سينتج رابطاً يُعاد توجيهه دوماً بدل القانونيّ مباشرةً.
export async function mapItem(it: Item): Promise<FeedItem> {
  const slug = it.primary_category?.slug;
  const ancestry = slug ? await getCategoryAncestry(slug) : null;
  return {
    id: it.id,
    title: it.title,
    excerpt: (it.excerpt ?? it.subtitle ?? '').trim() || null,
    href: canonicalArticlePath(it.id, it.published_at ?? null),
    image: it.cover?.medium ?? it.cover?.url ?? null,
    imageAlt: it.cover?.alt ?? it.title,
    category: it.primary_category?.name ?? null,
    categoryHref:
      ancestry && ancestry.length > 0
        ? categoryHref(ancestry)
        : slug
          ? `/news/category/${encodeURIComponent(slug)}`
          : null,
    author: it.author?.name
      ? {
          id: typeof it.author.id === 'number' ? it.author.id : null,
          name: it.author.name,
          slug: it.author.slug ?? null,
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
      return Promise.all((parsed.data.data ?? []).map(mapItem));
    } catch {
      return [];
    }
  },
);

// كتلة الهيرو: الأخبار المميّزة (is_featured) — حدّ 5 (= hero(source:featured,limit:5)).
// ISR 36000s — سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر feed:hero (FrontendCacheTags::article).
export const getHeroFeed = (locale = 'ar') => fetchFeed('hero', 5, locale, 36000);

// كتلة «آخر المستجدات»: أخبار الهيدر (is_header) — حدّ 9 (كرت رئيسيّ + شبكة 8). ISR سقف أمان فقط.
export const getHeaderFeed = (locale = 'ar') => fetchFeed('header', 9, locale, 36000);

// شريط الأخبار العاجلة (is_breaking) — حدّ 10. ISR سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر feed:breaking.
export const getBreakingFeed = (locale = 'ar') => fetchFeed('breaking', 10, locale, 36000);

// صفحة «آخر المستجدات» /latest: أحدث الأخبار المنشورة — حدّ 30. ISR سقف أمان فقط؛ إبطال حدثيّ عبر feed:latest.
export const getLatestFeed = (locale = 'ar') => fetchFeed('latest', 30, locale, 36000);

// كتلة «الأكثر شيوعا»: الأكثر قراءة (مشاهدات مُتتبَّعة، بلا نافذة 7 أيام الضيّقة) — المطابق الدلاليّ
// لـ«الأكثر شيوعا/الأكثر قراءة». endpoint مستقلّ بمُعامل per_page (ليس /feed/{kind})، لكنّه يعيد نفس
// مغلّف {data:[…]} ومورد القائمة ⇒ إعادة استخدام EnvelopeSchema/mapItem. ISR 300s؛ أي فشل ⇒ [] (عزل الكتلة).
// (الرائج /articles/trending متاح أيضاً لكن نافذته 7 أيام تُفرغه إن لم يوجد محتوى حديث.)
export const getMostReadFeed = cache(async (locale = 'ar', limit = 6): Promise<FeedItem[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(
      `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/articles/most-read?per_page=${limit}`,
      { headers: env.internalHeaders, next: { revalidate: 36000, tags: ['articles', 'feed:most_read'] } }, // ISR — سقف أمان فقط.
    );
    if (!res.ok) return [];
    const parsed = EnvelopeSchema.safeParse(await res.json());
    if (!parsed.success) return [];
    return Promise.all((parsed.data.data ?? []).map(mapItem));
  } catch {
    return [];
  }
});

// تصنيف بالـ**ID الثابت** — الـslug والاسم الحاليّان. الـID لا يتغيّر؛ الـslug يتغيّر بإعادة التسمية من
// الإدارة ⇒ مرجعة الأقسام بالـID تمنع كسر الرئيسيّة (نبض الشارع→نبض البلد). الباك إند لا يدعم
// `/categories/{id}` ولا `filter[category_id]` (slug فقط)، فنفهرس شجرة `/categories` مرّةً (مُكاش، ISR
// 300s) بالـID ونحلّ منها الـslug/الاسم الحاليّين لتمريرهما لـ`getCategoryFeed`/العنوان.
// نظام تصميم الأقسام (Section Design System) — يقرأه SectionRenderer لاختيار
// مكوّن التخطيط المناسب. غياب appearance بالكامل ⇒ التصميم الافتراضي القديم
// (توافق خلفي مع أقسام لم تُهيَّأ بعد).
export interface CategoryAppearance {
  layout: 'default' | 'hero' | 'magazine' | 'featured';
  show_title: boolean;
  banner: { url: string | null; height: string; overlay: boolean; position: string };
  border: { enabled: boolean; width: number; radius: number; color: string };
}

export interface CategoryRef {
  id: number;
  name: string;
  slug: string;
  href: string;
  description?: string;
  appearance?: CategoryAppearance;
}

function readAppearance(raw: unknown): CategoryAppearance | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = raw as Record<string, unknown>;
  const banner = (a.banner ?? {}) as Record<string, unknown>;
  const border = (a.border ?? {}) as Record<string, unknown>;
  return {
    layout: typeof a.layout === 'string' ? (a.layout as CategoryAppearance['layout']) : 'default',
    show_title: typeof a.show_title === 'boolean' ? a.show_title : true,
    banner: {
      url: typeof banner.url === 'string' ? banner.url : null,
      height: typeof banner.height === 'string' ? banner.height : 'md',
      overlay: typeof banner.overlay === 'boolean' ? banner.overlay : true,
      position: typeof banner.position === 'string' ? banner.position : 'center',
    },
    border: {
      enabled: typeof border.enabled === 'boolean' ? border.enabled : false,
      width: typeof border.width === 'number' ? border.width : 2,
      radius: typeof border.radius === 'number' ? border.radius : 0,
      color: typeof border.color === 'string' ? border.color : '#E5E7EB',
    },
  };
}

interface RawCategoryNode {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  icon?: unknown;
  appearance?: unknown;
  children?: unknown;
}

// طبقة جلب/تحليل خام واحدة مُكاشة (React cache()) — يشترك فيها fetchCategoryIndex (فهرسة
// مسطّحة بالـID) وgetCategoryAncestry (سلسلة الأسلاف)، فيبقى طلب الشبكة واحداً لكل locale/عرض
// بدل تكراره لكل مستهلك (cache() يُميّز بهوية الدالة لا الرابط، فدالتان منفصلتان لنفس الرابط
// لن تتشاركا الكاش).
const fetchCategoryTree = cache(async (locale: string): Promise<RawCategoryNode[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/categories`, {
      headers: env.internalHeaders,
      next: { revalidate: 36000, tags: ['categories'] }, // ISR — سقف أمان فقط.
    });
    if (!res.ok) return [];
    const json: unknown = await res.json();
    const root = (json as { data?: unknown }).data;
    return Array.isArray(root) ? (root as RawCategoryNode[]) : [];
  } catch {
    return [];
  }
});

// href كلّ عقدة يُحسَب أثناء النزول عبر سلسلة أسلافها المتراكمة (لا بحث DFS منفصل لكل عقدة
// كما في getCategoryAncestry) — نفس صيغة categoryHref(ancestry) أدناه، فمصدر واحد للمسار.
const fetchCategoryIndex = cache(async (locale: string): Promise<Map<number, CategoryRef>> => {
  const index = new Map<number, CategoryRef>();
  const walk = (nodes: RawCategoryNode[], ancestry: CategoryAncestor[]): void => {
    for (const n of nodes) {
      let nextAncestry = ancestry;
      if (typeof n.id === 'number' && typeof n.slug === 'string' && n.slug) {
        nextAncestry = [...ancestry, { id: n.id, name: typeof n.name === 'string' ? n.name : '', slug: n.slug }];
        index.set(n.id, {
          id: n.id,
          name: typeof n.name === 'string' ? n.name : '',
          slug: n.slug,
          href: categoryHref(nextAncestry),
          description: typeof n.description === 'string' ? n.description : undefined,
          appearance: readAppearance(n.appearance),
        });
      }
      if (Array.isArray(n.children)) walk(n.children as RawCategoryNode[], nextAncestry);
    }
  };
  walk(await fetchCategoryTree(locale), []);
  return index;
});

// سلسلة أسلاف قسم بالـslug (جذر ⇐ ... ⇐ الأب المباشر ⇐ القسم نفسه) — DFS بمكدّس مسار على
// نفس الشجرة المُكاشة أعلاه (لا طلب إضافي). قسم خارج شجرة /categories (له مقالات لكن غير
// مُصنَّف فيها) ⇐ null — المستهلك يتراجع لعرض مسار من مستوى واحد بدل الفشل الكامل.
export interface CategoryAncestor {
  id: number;
  name: string;
  slug: string;
}

export const getCategoryAncestry = cache(
  async (slug: string, locale = 'ar'): Promise<CategoryAncestor[] | null> => {
    const tree = await fetchCategoryTree(locale);
    const find = (nodes: RawCategoryNode[], path: CategoryAncestor[]): CategoryAncestor[] | null => {
      for (const n of nodes) {
        if (typeof n.id !== 'number' || typeof n.slug !== 'string' || !n.slug) continue;
        const next = [...path, { id: n.id, name: typeof n.name === 'string' ? n.name : '', slug: n.slug }];
        if (n.slug === slug) return next;
        if (Array.isArray(n.children)) {
          const found = find(n.children as RawCategoryNode[], next);
          if (found) return found;
        }
      }
      return null;
    };
    return find(tree, []);
  },
);

/**
 * يبني /news/category/{...} من سلسلة أسلاف كاملة (جذر ⇐ ... ⇐ القسم نفسه) —
 * مرآة Category::canonicalPath() (PHP). مصدر واحد لكل رابط قسم في الواجهة
 * (2026-07-18) بدل بناء يدويّ مسطّح `/category/${slug}` مبعثر في عدّة مكوّنات.
 */
export function categoryHref(ancestry: Pick<CategoryAncestor, 'slug'>[]): string {
  if (ancestry.length === 0) return '#';

  // encodeURIComponent لكل مقطع على حدة (لا للمسار كاملاً — كان سيُرمِّز "/" الفاصلة
  // نفسها). ضروريّ: slugs عربية خام في ترويسة Location (permanentRedirect) تُسقِط
  // الخادم بـ ERR_INVALID_CHAR — Node.js يرفض أي حرف غير ASCII في ترويسات HTTP.
  return '/news/category/' + ancestry.map((a) => encodeURIComponent(a.slug)).join('/');
}

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

// عقدة فرعيّة من شجرة الأقسام الحقيقيّة (لا SportMenuItem) — href كلّ عقدة محسوب من سلسلة
// أسلافها الفعليّة (نفس categoryHref المستخدَم في كل مكان آخر)، children تُحلّ تكراريًّا بلا حدّ
// عمق مفترَض. تصحيح Sprint 1.7 (بند 4): قائمة الرياضة "الأقسام" تعرض الآن شجرة CMS الحقيقيّة
// (لا SportMenuItem المُقفَل/الفارغ) — لا تصنيف يُخترَع، لا تجاهل لأبناء أي مستوى.
export interface CategoryTreeNode {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  href: string;
  children: CategoryTreeNode[];
}

// شجرة أبناء تصنيف جذر بعينه (بالـID، مقاوم لإعادة التسمية) — DFS واحد على fetchCategoryTree
// المُكاشة أصلاً (لا طلب شبكة إضافيّ). التصنيف الجذر نفسه غير موجود ⇒ []، لا تلفيق. أب غير موجود
// ضمن العودة ⇒ استُبعِد بصمت هو وفرعه بالكامل (نفس سياسة sport-primary-nav.tsx القديمة).
export const getCategorySubtree = cache(
  async (rootId: number, locale = 'ar'): Promise<CategoryTreeNode[]> => {
    const tree = await fetchCategoryTree(locale);

    const toNode = (n: RawCategoryNode, ancestry: CategoryAncestor[]): CategoryTreeNode | null => {
      if (typeof n.id !== 'number' || typeof n.slug !== 'string' || !n.slug) return null;
      const nextAncestry = [...ancestry, { id: n.id, name: typeof n.name === 'string' ? n.name : '', slug: n.slug }];
      const children = Array.isArray(n.children)
        ? (n.children as RawCategoryNode[])
            .map((c) => toNode(c, nextAncestry))
            .filter((c): c is CategoryTreeNode => c !== null)
        : [];
      return {
        id: n.id,
        name: typeof n.name === 'string' ? n.name : '',
        slug: n.slug,
        icon: typeof n.icon === 'string' ? n.icon : null,
        href: categoryHref(nextAncestry),
        children,
      };
    };

    const findRoot = (nodes: RawCategoryNode[], ancestry: CategoryAncestor[]): CategoryTreeNode[] => {
      for (const n of nodes) {
        if (n.id === rootId) return toNode(n, ancestry)?.children ?? [];
        if (typeof n.id === 'number' && typeof n.slug === 'string' && n.slug && Array.isArray(n.children)) {
          const found = findRoot(n.children as RawCategoryNode[], [
            ...ancestry,
            { id: n.id, name: typeof n.name === 'string' ? n.name : '', slug: n.slug },
          ]);
          if (found.length > 0) return found;
        }
      }
      return [];
    };

    return findRoot(tree, []);
  },
);

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
        {
          headers: env.internalHeaders,
          // 'homepage-sections' تشخيصي/علاجي مؤقت (2026-08-12): إبطال احتياطي إضافي لأقسام
          // الرئيسية (9 مستهلكين لهذه الدالة) — لا يستبدل category:{slug}، يُزال إن ثبت
          // أن category:{slug} وحده كافٍ بعد التحقيق.
          next: { revalidate: 36000, tags: ['articles', `category:${slug}`, 'homepage-sections'] }, // ISR — سقف أمان فقط.
        },
      );
      if (!res.ok) return [];
      const parsed = EnvelopeSchema.safeParse(await res.json());
      if (!parsed.success) return [];
      return Promise.all((parsed.data.data ?? []).map(mapItem));
    } catch {
      return [];
    }
  },
);

// شبكة المقالات المميّزة (is_featured) داخل قسم محدّد — كرت رئيسي + شبكة صغيرة أعلى صفحة
// القسم، مستقلة عن التغذية الزمنية أدناه (CategoryFeaturedGrid). نفس مغلّف {data:[…]}/mapItem؛
// فشل/فراغ ⇒ [] (عزل الكتلة، لا محتوى ملفَّق).
export const getCategoryFeaturedGrid = cache(
  async (slug: string, limit = 5, locale = 'ar'): Promise<FeedItem[]> => {
    if (!env.apiBaseUrl) return [];
    try {
      const qs = new URLSearchParams({ per_page: String(limit), sort: '-published_at' });
      qs.set('filter[category]', slug);
      qs.set('filter[is_featured]', '1');
      const res = await fetch(
        `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/articles?${qs.toString()}`,
        { headers: env.internalHeaders, next: { revalidate: 36000, tags: ['articles', `category:${slug}`] } }, // ISR — سقف أمان فقط.
      );
      if (!res.ok) return [];
      const parsed = EnvelopeSchema.safeParse(await res.json());
      if (!parsed.success) return [];
      return Promise.all((parsed.data.data ?? []).map(mapItem));
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
        { headers: env.internalHeaders, next: { revalidate: 36000, tags: ['articles', `category:${slug}`] } }, // ISR — سقف أمان فقط.
      );
      if (!res.ok) return empty;
      const parsed = PaginatedEnvelope.safeParse(await res.json());
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
