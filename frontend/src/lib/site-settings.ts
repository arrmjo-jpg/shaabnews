import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// ── Backend Site Settings contract (GET /api/v1/site?locale=…) ──────────────────────────────
// Real fields the backend returns today + FORWARD-COMPAT optional SEO/analytics/verification fields.
// Optional fields are consumed automatically the moment the CMS starts returning them — zero
// frontend change, zero hardcoded values. `.passthrough()` keeps any extra backend keys.
const SocialSchema = z.record(z.string(), z.string());

// Header navigation menu from the CMS (categories flagged `show_in_header`, ordered).
// Parents may carry children → rendered as a dropdown.
export interface NavCategory {
  name: string;
  slug: string;
  children: { name: string; slug: string }[];
}

const NavCategorySchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    children: z.array(z.object({ name: z.string(), slug: z.string() }).passthrough()).default([]),
  })
  .passthrough();

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
// Every consumer (metadata, JSON-LD, manifest, analytics) shares ONE fetch.
export const getSiteSettings = cache(async (locale = 'ar'): Promise<SiteSettings | null> => {
  if (!env.apiBaseUrl) return null;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/site?locale=${encodeURIComponent(locale)}`, {
      next: { revalidate: 36000, tags: ['site-settings'] }, // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ.
    });
    if (!res.ok) return null;
    const parsed = EnvelopeSchema.safeParse(await res.json());
    return parsed.success ? (parsed.data.data ?? null) : null;
  } catch {
    return null;
  }
});

// Header navigation menu (DB-driven). Empty when the admin hasn't enabled any
// `show_in_header` category → callers fall back to the static nav.
export async function getNavCategories(locale = 'ar'): Promise<NavCategory[]> {
  const settings = await getSiteSettings(locale);
  return (settings?.nav_categories ?? []) as NavCategory[];
}

/** Social values that are absolute URLs (for schema.org sameAs / social rows). */
export function socialUrls(settings: SiteSettings | null): string[] {
  if (!settings?.social) return [];
  return Object.values(settings.social).filter((v) => /^https?:\/\//i.test(v));
}
