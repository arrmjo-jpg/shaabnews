import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';
import { categoryHref, getCategoryAncestry } from './feed';

// ── Backend Site Settings contract (GET /api/v1/site?locale=…) ──────────────────────────────
// Real fields the backend returns today + FORWARD-COMPAT optional SEO/analytics/verification fields.
// Optional fields are consumed automatically the moment the CMS starts returning them — zero
// frontend change, zero hardcoded values. `.passthrough()` keeps any extra backend keys.
const SocialSchema = z.record(z.string(), z.string());

// Header navigation menu from the CMS (categories flagged `show_in_header`, ordered).
// Parents may carry children → rendered as a dropdown. `href` is pre-resolved server-side
// (full ancestry path, mirrors Category::canonicalPath) so client components (MainNav) never
// need to build category URLs themselves.
export interface NavCategory {
  name: string;
  slug: string;
  href: string;
  children: { name: string; slug: string; href: string }[];
}

const NavCategorySchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    children: z.array(z.object({ name: z.string(), slug: z.string() }).passthrough()).default([]),
  })
  .passthrough();

// Phase 2.1 — حقول ثيم الرياضة + شعاراها فقط (لا feature flags/defaults، لا مستهلك فعليّ
// لها اليوم — تُضاف حين تحتاجها مرحلة لاحقة فعليّة، لا استباقًا). راجع SportSettings.php
// وSiteController::settings() للحقول المطابقة تمامًا.
export interface SportPublicSettings {
  primary_color: string | null;
  secondary_color: string | null;
  default_theme: string | null;
  allow_theme_switch: boolean | null;
  theme_cookie: string | null;
  logo_light: string | null;
  logo_dark: string | null;
}

// لا .passthrough() هنا خلافاً للمخطط الأعلى (فلسفة forward-compat موثَّقة صراحةً هناك) —
// sport عقد Backend↔Frontend صغير ومحدَّد، لا استجابة عامة؛ نفس اتفاقية analytics/verification
// أدناه (partial() فقط). حقل غير مُعرَّف يُسقَط بصمت بدل أن يُمرَّر ويظهر في التطبيق دون تنبّه أحد.
const SportPublicSettingsSchema = z
  .object({
    primary_color: z.string().nullish(),
    secondary_color: z.string().nullish(),
    default_theme: z.string().nullish(),
    allow_theme_switch: z.boolean().nullish(),
    theme_cookie: z.string().nullish(),
    logo_light: z.string().nullish(),
    logo_dark: z.string().nullish(),
  })
  .partial();

const SiteSettingsSchema = z
  .object({
    site_name: z.string().default(''),
    description: z.string().nullish(),
    copyright: z.string().nullish(),
    cookie_policy: z.string().nullish(),
    phone: z.string().nullish(),
    email: z.string().nullish(),
    latitude: z.string().nullish(),
    longitude: z.string().nullish(),
    logo_light: z.string().nullish(),
    logo_dark: z.string().nullish(),
    favicon: z.string().nullish(),
    social: SocialSchema.nullish(),
    nav_categories: z.array(NavCategorySchema).nullish(),
    // بوّابة الجريدة الرقمية (تظهر في شريط الأقسام فقط عند التفعيل).
    newspaper_enabled: z.boolean().nullish(),
    sport: SportPublicSettingsSchema.nullish(),

    // ── Forward-compat (absent today; rendered only when present) ──
    meta_title: z.string().nullish(),
    meta_description: z.string().nullish(),
    keywords: z.union([z.string(), z.array(z.string())]).nullish(),
    og_image: z.string().nullish(),
    apple_touch_icon: z.string().nullish(),
    analytics: z
      .object({
        google_analytics_id: z.string().nullish(),
        gtm_id: z.string().nullish(),
        meta_pixel_id: z.string().nullish(),
        snapchat_pixel_id: z.string().nullish(),
        tiktok_pixel_id: z.string().nullish(),
      })
      .partial()
      .nullish(),
    verification: z
      .object({
        google: z.string().nullish(),
        bing: z.string().nullish(),
        facebook_domain: z.string().nullish(),
        other: z.record(z.string(), z.string()).nullish(),
      })
      .partial()
      .nullish(),
  })
  .passthrough();

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

const EnvelopeSchema = z.object({ data: SiteSettingsSchema.nullish() }).passthrough();

// Cached + deduped per request (React cache) + Next data cache (tag-revalidatable).
// Every consumer (metadata, JSON-LD, manifest, analytics) shares ONE fetch — this is the single
// place that owns settings freshness; pages/layout never configure their own revalidate for this.
// 300s (لا 36000s سابقاً): مطابق CacheTtl::SHORT في الباك إند لنفس البيانات — عند فشل وسم
// site-settings في الوصول لصفحة مُولَّدة وقت البناء (raw fetch لم يُنفَّذ إطلاقاً لغياب
// API_BASE_URL وقت `docker build`، فلا وسم يُسجَّل ليُبطِله revalidateTag لاحقاً)، أقصى مدّة
// بقاء حالة خاطئة هي 5 دقائق بدل 10 ساعات — سقف أمان واقعي، لا يعتمد فقط على وسم قد لا يصل.
export const getSiteSettings = cache(async (locale = 'ar'): Promise<SiteSettings | null> => {
  if (!env.apiBaseUrl) return null;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/site?locale=${encodeURIComponent(locale)}`, {
      next: { revalidate: 300, tags: ['site-settings'] },
    });
    if (!res.ok) return null;
    const parsed = EnvelopeSchema.safeParse(await res.json());
    return parsed.success ? (parsed.data.data ?? null) : null;
  } catch {
    return null;
  }
});

// بوّابة الجريدة الرقمية — مصدر تفسير واحد بدل تكرار `!settings?.newspaper_enabled` (يخلط بين
// «معطّلة» و«غير معروفة») في كل مستهلك على حدة. null (فشل الجلب: بناء بلا API، شبكة، استجابة
// غير صالحة) أو الحقل نفسه غائب ⇐ 'unknown' — قرار الوصول (notFound) يُبنى فقط على 'disabled'
// المؤكَّدة، لا على الغياب؛ عرض التنقّل (الرابط بالهيدر) يبقى حرّاً باختيار سياسته الخاصة تجاه
// 'unknown' (اليوم: إخفاء، سلوك موجود لم يتغيّر).
export type NewspaperGateState = 'enabled' | 'disabled' | 'unknown';

export function resolveNewspaperGate(settings: SiteSettings | null): NewspaperGateState {
  if (!settings || settings.newspaper_enabled == null) return 'unknown';
  return settings.newspaper_enabled ? 'enabled' : 'disabled';
}

// مسار قسم كامل من slug — يحلّ سلسلة الأسلاف الحقيقيّة (getCategoryAncestry، لا يفترض
// أنّ تجميع قوائم التنقّل يطابق شجرة /categories الفعليّة) ثمّ يبنيها بـcategoryHref.
// ancestry فارغة (قسم خارج الشجرة) ⇒ ارتداد بمسار مفرد /news/category/{slug}.
async function resolveCategoryHref(slug: string, locale: string): Promise<string> {
  const ancestry = await getCategoryAncestry(slug, locale);
  return ancestry && ancestry.length > 0 ? categoryHref(ancestry) : `/news/category/${encodeURIComponent(slug)}`;
}

// Header navigation menu (DB-driven). Empty when the admin hasn't enabled any
// `show_in_header` category → callers fall back to the static nav.
export async function getNavCategories(locale = 'ar'): Promise<NavCategory[]> {
  const settings = await getSiteSettings(locale);
  const raw = settings?.nav_categories ?? [];
  return Promise.all(
    raw.map(async (cat) => ({
      name: cat.name,
      slug: cat.slug,
      href: await resolveCategoryHref(cat.slug, locale),
      children: await Promise.all(
        cat.children.map(async (child) => ({
          name: child.name,
          slug: child.slug,
          href: await resolveCategoryHref(child.slug, locale),
        })),
      ),
    })),
  );
}

/** Social values that are absolute URLs (for schema.org sameAs / social rows). */
export function socialUrls(settings: SiteSettings | null): string[] {
  if (!settings?.social) return [];
  return Object.values(settings.social).filter((v) => /^https?:\/\//i.test(v));
}
