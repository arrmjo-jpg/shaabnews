import 'server-only';
import type { Metadata } from 'next';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// طبقة بيانات تفاصيل المقال — إعادة استخدام بحتة لنقطة التفاصيل الموجودة GET /{locale}/articles/{slug}
// (تطابق عمود slug المجرّد + تتبع 301 لسلَغ قديم تلقائيّاً عبر fetch). صفّ واحد للأنواع الثلاثة
// (news/live/opinion) — العارض يبدّل حسب `type`. الـ`seo` يُمرَّر **كما هو** (PublicSeoBuilder مصدر الحقيقة:
// structured_data/breadcrumbs/og/twitter/canonical/hreflang) — لا باني SEO جديد. فشل/غياب ⇒ null (لا تلفيق).

const REVALIDATE = 36000; // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر FrontendRevalidate::tags().
const enc = encodeURIComponent;

export type ArticleType = 'news' | 'opinion' | 'live';

export interface ArticleImage {
  url: string;
  thumb: string | null;
  medium: string | null;
  alt: string | null;
}

export interface ArticleDetail {
  id: number;
  type: ArticleType | string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  contentHtml: string;
  href: string; // canonicalArticlePath(id, publishedAt) → /news/dd/mm/yyyy/{id}
  publishedAt: string | null;
  viewsCount: number;
  isLive: boolean;
  eventStatus: string | null;
  /** SSoT: ناتج CommentGuard (إعدادات الموقع ∧ المقال) — قيمة واحدة، لا منطق إضافيّ بالواجهة. */
  commentsEnabled: boolean;
  flags: { breaking: boolean; featured: boolean; header: boolean; spotlight: boolean };
  author: { id: number | null; name: string; bio: string | null; avatar: string | null; isWriter: boolean } | null;
  primaryCategory: { name: string; slug: string } | null;
  secondaryCategories: { name: string; slug: string }[];
  cover: ArticleImage | null;
  gallery: ArticleImage[];
  tags: string[];
  seo: ArticleSeo | null;
}

// ─── Zod (مطابقة PublicArticleResource) ───
const ImageSchema = z
  .object({
    url: z.string(),
    thumb: z.string().nullish(),
    medium: z.string().nullish(),
    name: z.string().nullish(),
    alt: z.string().nullish(),
  })
  .passthrough();

const CatSchema = z.object({ name: z.string().nullish(), slug: z.string().nullish() }).passthrough();

// تسامح مع حقول المصفوفات: قد تعود من كاش الباك إند ككائن Collection مُسلسَل (`{__PHP_Incomplete_Class_Name…}`)
// بدل مصفوفة — لأنّ PublicArticleResource يعيد `whenLoaded(...->values())` (Collection لا array)، خلاف
// PublicLiveUpdateResource الذي يستخدم `->all()`. غير-مصفوفة/غياب ⇒ [] (لا نُسقِط المقال كلّه على حقل ثانويّ).
const looseArray = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(item));

// كتلة seo (PublicSeoBuilder) — تُمرَّر كما هي. og/twitter مُهيكلة للتحويل لـMetadata؛ structured_data/breadcrumbs خام للإصدار.
const SeoSchema = z
  .object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    keywords: z.string().nullish(),
    canonical_url: z.string().nullish(),
    robots: z.string().nullish(),
    image: z.string().nullish(),
    hreflang: z.array(z.object({ locale: z.string(), url: z.string() }).passthrough()).nullish(),
    og: z
      .object({
        type: z.string().nullish(),
        site_name: z.string().nullish(),
        locale: z.string().nullish(),
        title: z.string().nullish(),
        description: z.string().nullish(),
        url: z.string().nullish(),
        image: z.string().nullish(),
        image_width: z.number().nullish(),
        image_height: z.number().nullish(),
        article: z
          .object({
            published_time: z.string().nullish(),
            modified_time: z.string().nullish(),
            section: z.string().nullish(),
            tag: z.array(z.string()).nullish(),
            author: z.string().nullish(),
          })
          .passthrough()
          .nullish(),
      })
      .passthrough()
      .nullish(),
    twitter: z
      .object({
        card: z.string().nullish(),
        site: z.string().nullish(),
        creator: z.string().nullish(),
        title: z.string().nullish(),
        description: z.string().nullish(),
        image: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    structured_data: z.unknown().nullish(),
    breadcrumbs: z.unknown().nullish(),
  })
  .passthrough();

export type ArticleSeo = z.infer<typeof SeoSchema>;

const ArticleSchema = z
  .object({
    id: z.number(),
    type: z.string(),
    title: z.string(),
    subtitle: z.string().nullish(),
    excerpt: z.string().nullish(),
    content_html: z.string().nullish(),
    published_at: z.string().nullish(),
    views_count: z.number().nullish(),
    is_live: z.boolean().nullish(),
    event_status: z.string().nullish(),
    comments_enabled: z.boolean().nullish(),
    flags: z
      .object({
        breaking: z.boolean().nullish(),
        featured: z.boolean().nullish(),
        header: z.boolean().nullish(),
        spotlight: z.boolean().nullish(),
      })
      .passthrough()
      .nullish(),
    author: z
      .object({
        id: z.number().nullish(),
        name: z.string().nullish(),
        bio: z.string().nullish(),
        avatar: z.string().nullish(),
        is_writer: z.boolean().nullish(),
      })
      .passthrough()
      .nullish(),
    primary_category: CatSchema.nullish(),
    secondary_categories: looseArray(CatSchema),
    tags: looseArray(z.string()),
    media: z
      .object({
        cover: ImageSchema.nullish(),
        gallery: looseArray(ImageSchema),
        video: looseArray(z.object({ url: z.string().nullish(), mime: z.string().nullish() }).passthrough()),
      })
      .passthrough()
      .nullish(),
    seo: SeoSchema.nullish(),
  })
  .passthrough();

type RawArticle = z.infer<typeof ArticleSchema>;
const ArticleEnvelope = z.object({ data: ArticleSchema.nullish() }).passthrough();

// مطابق حرفيّاً لـ Article::canonicalPath() (PHP) — بما في ذلك المنطقة الزمنية
// (Asia/Amman، config('app.timezone')). ضروريّ: published_at القادم من الـAPI
// UTC (toISOString())، بينما الباك إند يُنسِّق بالتوقيت المحليّ؛ استخدام UTC هنا
// كان سينتج تاريخاً مختلفاً قرب منتصف الليل ويُسبِّب حلقة إعادة توجيه كاذبة.
export function canonicalArticleDateParts(publishedAtIso: string): { dd: string; mm: string; yyyy: string } {
  const date = new Date(publishedAtIso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Amman',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';

  return { dd: get('day'), mm: get('month'), yyyy: get('year') };
}

/**
 * يبني /news/dd/mm/yyyy/{id} — مرآة Article::canonicalPath() الحرفيّة. بلا شرطة
 * مائلة زائدة (قرار صريح: Next.js يحذفها تلقائياً بإعادة توجيه 308 قبل وصول
 * الطلب لكود الصفحة، فإبقاؤها في القيمة "القانونية" كانت ستُنتج قفزة توجيه
 * مزدوجة لا يراها أحد فعلياً — راجع docs/architecture/CACHE-INVALIDATION.md §12).
 */
export function canonicalArticlePath(id: number, publishedAtIso: string | null): string {
  if (!publishedAtIso) return `/news/00/00/0000/${id}`;
  const { dd, mm, yyyy } = canonicalArticleDateParts(publishedAtIso);

  return `/news/${dd}/${mm}/${yyyy}/${id}`;
}

function mapImage(i: z.infer<typeof ImageSchema> | null | undefined): ArticleImage | null {
  if (!i?.url) return null;
  return { url: i.url, thumb: i.thumb ?? null, medium: i.medium ?? null, alt: i.alt ?? null };
}

function mapArticle(a: RawArticle): ArticleDetail {
  return {
    id: a.id,
    type: a.type,
    title: a.title,
    subtitle: a.subtitle ?? null,
    excerpt: a.excerpt ?? null,
    contentHtml: a.content_html ?? '',
    href: canonicalArticlePath(a.id, a.published_at ?? null),
    publishedAt: a.published_at ?? null,
    viewsCount: a.views_count ?? 0,
    isLive: a.is_live ?? false,
    eventStatus: a.event_status ?? null,
    commentsEnabled: a.comments_enabled ?? false,
    flags: {
      breaking: a.flags?.breaking ?? false,
      featured: a.flags?.featured ?? false,
      header: a.flags?.header ?? false,
      spotlight: a.flags?.spotlight ?? false,
    },
    author: a.author?.name
      ? {
          id: typeof a.author.id === 'number' ? a.author.id : null,
          name: a.author.name,
          bio: a.author.bio ?? null,
          avatar: a.author.avatar ?? null,
          isWriter: !!a.author.is_writer,
        }
      : null,
    primaryCategory:
      a.primary_category?.name && a.primary_category.slug
        ? { name: a.primary_category.name, slug: a.primary_category.slug }
        : null,
    secondaryCategories: (a.secondary_categories ?? [])
      .filter((c): c is { name: string; slug: string } => Boolean(c.name) && Boolean(c.slug))
      .map((c) => ({ name: c.name, slug: c.slug })),
    cover: mapImage(a.media?.cover),
    gallery: (a.media?.gallery ?? []).map(mapImage).filter((x): x is ArticleImage => x !== null),
    tags: a.tags ?? [],
    seo: a.seo ?? null,
  };
}

/**
 * تفاصيل مقال بمُعرِّف مجرّد. **يجب أن يكون `slug` رقم المقال (id) دائماً في كل
 * استدعاء جديد** (2026-07-18) — الوسم `article:{slug}` أدناه يطابق حرفياً
 * `article:{id}` الذي يُصدره الباك إند الآن (FrontendCacheTags::article())؛ تمرير
 * سلَغ نصّي حقيقيّ هنا يُنتج وسماً لن يُبطِله أي تحديث (نفس عطل الكاش الذي أصلحناه
 * — راجع docs/architecture/CACHE-INVALIDATION.md). النقطة الخلفية لا تزال تقبل
 * سلَغاً قديماً احتياطياً (301) لكن هذا لا يُستهلَك من الواجهة بعد الآن.
 */
export const getArticle = cache(async (slug: string, locale = 'ar'): Promise<ArticleDetail | null> => {
  if (!env.apiBaseUrl) return null;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${enc(locale)}/articles/${enc(slug)}`, {
      headers: env.internalHeaders,
      next: { revalidate: REVALIDATE, tags: ['articles', `article:${slug}`] },
    });
    if (!res.ok) return null;
    const parsed = ArticleEnvelope.safeParse(await res.json());
    if (!parsed.success || !parsed.data.data) return null;
    return mapArticle(parsed.data.data);
  } catch {
    return null;
  }
});

// ─── التغطية الحيّة (type=live) — الخطّ الزمنيّ من نقطة live-updates الموجودة (ETag/304؛ مُصمَّمة للـpolling) ───
export interface LiveUpdateItem {
  id: number;
  title: string | null;
  contentHtml: string;
  isPinned: boolean;
  isBreaking: boolean;
  happenedAt: string | null;
  authorName: string | null;
  gallery: ArticleImage[];
}

const LiveUpdateSchema = z
  .object({
    id: z.number(),
    title: z.string().nullish(),
    content_html: z.string().nullish(),
    is_pinned: z.boolean().nullish(),
    is_breaking: z.boolean().nullish(),
    happened_at: z.string().nullish(),
    author: z.object({ name: z.string().nullish() }).passthrough().nullish(),
    media: z.object({ gallery: z.array(ImageSchema).nullish() }).passthrough().nullish(),
  })
  .passthrough();

const LiveListEnvelope = z.object({ data: z.array(LiveUpdateSchema).nullish() }).passthrough();

function mapLiveUpdate(u: z.infer<typeof LiveUpdateSchema>): LiveUpdateItem {
  return {
    id: u.id,
    title: u.title ?? null,
    contentHtml: u.content_html ?? '',
    isPinned: u.is_pinned ?? false,
    isBreaking: u.is_breaking ?? false,
    happenedAt: u.happened_at ?? null,
    authorName: u.author?.name ?? null,
    gallery: (u.media?.gallery ?? []).map(mapImage).filter((x): x is ArticleImage => x !== null),
  };
}

/** الخطّ الزمنيّ للتغطية الحيّة (SSR الأوّليّ؛ التحديث الفوريّ عبر poller العميل). فشل/غياب ⇒ []. */
export const getLiveUpdates = cache(async (slug: string, locale = 'ar'): Promise<LiveUpdateItem[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${enc(locale)}/articles/${enc(slug)}/live-updates?per_page=40`, {
      headers: env.internalHeaders,
      next: { revalidate: REVALIDATE, tags: ['live_updates', `live:${slug}`] },
    });
    if (!res.ok) return [];
    const parsed = LiveListEnvelope.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.data ?? []).map(mapLiveUpdate);
  } catch {
    return [];
  }
});

// تقدير وقت القراءة من المتن (لا يوفّره الـAPI) — عدّ كلمات نصّيّ ÷ 200 ك/د (أدنى دقيقة). تقدير عرض حقيقيّ، لا تلفيق.
export function readingMinutes(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return Math.max(1, Math.round(text.split(' ').length / 200));
}

// محوّل تمريريّ: كتلة `seo` من الـAPI ⇒ Next Metadata. **لا منطق SEO جديد** — تمرير قيم PublicSeoBuilder كما هي.
export function articleSeoToMetadata(article: ArticleDetail, fallbackCanonical: string): Metadata {
  const seo = article.seo;
  if (!seo) return { title: article.title };

  const canonical = seo.canonical_url ?? fallbackCanonical;
  const og = seo.og ?? undefined;
  const tw = seo.twitter ?? undefined;
  const ogImages = og?.image
    ? [{ url: og.image, width: og.image_width ?? undefined, height: og.image_height ?? undefined }]
    : undefined;
  const languages: Record<string, string> = {};
  for (const h of seo.hreflang ?? []) languages[h.locale] = h.url;

  return {
    title: seo.title ?? article.title,
    description: seo.description ?? undefined,
    keywords: seo.keywords ?? undefined,
    alternates: { canonical, languages: Object.keys(languages).length > 0 ? languages : undefined },
    robots: seo.robots ?? undefined,
    openGraph: og
      ? {
          type: 'article',
          siteName: og.site_name ?? undefined,
          locale: og.locale ?? undefined,
          title: og.title ?? undefined,
          description: og.description ?? undefined,
          url: og.url ?? canonical,
          images: ogImages,
          publishedTime: og.article?.published_time ?? undefined,
          modifiedTime: og.article?.modified_time ?? undefined,
          section: og.article?.section ?? undefined,
          tags: og.article?.tag ?? undefined,
          authors: og.article?.author ? [og.article.author] : undefined,
        }
      : undefined,
    twitter: tw
      ? {
          card: (tw.card as 'summary' | 'summary_large_image' | undefined) ?? 'summary_large_image',
          site: tw.site ?? undefined,
          creator: tw.creator ?? undefined,
          title: tw.title ?? undefined,
          description: tw.description ?? undefined,
          images: tw.image ? [tw.image] : undefined,
        }
      : undefined,
  };
}
