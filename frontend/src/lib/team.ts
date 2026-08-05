import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// فريق العمل (عام) — `GET /api/v1/team` (قائمة مُجمّعة حسب department) و`GET /api/v1/team/{slug}`
// (تفاصيل + حمولة SEO كاملة من TeamMemberSeoBuilder). نطاق عربيّ أحادي: بلا بادئة {locale}
// (راجع routes/api/v1/public.php). النشِطون فقط (الباك إند يُصفّي status=active).

const AvatarSchema = z
  .object({
    url: z.string(),
    thumb: z.string().nullish(),
    medium: z.string().nullish(),
  })
  .nullish();

export interface TeamAvatar {
  url: string;
  thumb: string | null;
  medium: string | null;
}

function mapAvatar(a: z.infer<typeof AvatarSchema>): TeamAvatar | null {
  if (!a) return null;
  return { url: a.url, thumb: a.thumb ?? null, medium: a.medium ?? null };
}

// ─── قائمة (مُجمّعة حسب القسم) ──────────────────────────────────────────────

const CardSchema = z.object({
  id: z.number(),
  name: z.string(),
  job_title: z.string().nullish(),
  department: z.string().nullish(),
  slug: z.string(),
  avatar: AvatarSchema,
  social_links: z.record(z.string(), z.string()).nullish(),
  canonical_path: z.string(),
});

const GroupSchema = z.object({
  department: z.string().nullish(),
  members: z.array(CardSchema),
});

const ListEnvelope = z.object({ data: z.array(GroupSchema).nullish() }).passthrough();

export interface TeamMemberCard {
  id: number;
  name: string;
  jobTitle: string | null;
  department: string | null;
  slug: string;
  avatar: TeamAvatar | null;
  social: Record<string, string>;
  href: string;
}

export interface TeamGroup {
  department: string | null;
  members: TeamMemberCard[];
}

function mapCard(c: z.infer<typeof CardSchema>): TeamMemberCard {
  return {
    id: c.id,
    name: c.name,
    jobTitle: c.job_title ?? null,
    department: c.department ?? null,
    slug: c.slug,
    avatar: mapAvatar(c.avatar),
    social: c.social_links ?? {},
    href: c.canonical_path,
  };
}

/** قائمة أعضاء الفريق النشِطين مُجمّعة حسب القسم — بطاقات خفيفة (صورة/اسم/مسمّى وظيفيّ). */
export const getTeamGroups = cache(async (): Promise<TeamGroup[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/team`, {
      next: { revalidate: 3600, tags: ['team'] },
    });
    if (!res.ok) return [];
    const parsed = ListEnvelope.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.data ?? []).map((g) => ({
      department: g.department ?? null,
      members: g.members.map(mapCard),
    }));
  } catch {
    return [];
  }
});

// ─── تفاصيل عضو ─────────────────────────────────────────────────────────────
// حمولة seo كاملة من TeamMemberSeoBuilder (الباك إند) — تُستهلَك كما هي في generateMetadata +
// JSON-LD (Person + BreadcrumbList) بدل إعادة بنائها هنا (لا تكرار منطق SEO).

const SeoSchema = z.object({
  title: z.string(),
  description: z.string().nullish(),
  keywords: z.string().nullish(),
  canonical_url: z.string(),
  robots: z.string().nullish(),
  image: z.string().nullish(),
  og: z.record(z.string(), z.unknown()).nullish(),
  twitter: z.record(z.string(), z.unknown()).nullish(),
  structured_data: z.record(z.string(), z.unknown()).nullish(),
  breadcrumbs: z.record(z.string(), z.unknown()).nullish(),
});

const DetailSchema = z.object({
  id: z.number(),
  name: z.string(),
  job_title: z.string().nullish(),
  department: z.string().nullish(),
  slug: z.string(),
  bio_html: z.string().nullish(),
  avatar: AvatarSchema,
  social_links: z.record(z.string(), z.string()).nullish(),
  canonical_path: z.string(),
  seo: SeoSchema,
});

const DetailEnvelope = z.object({ data: DetailSchema.nullish() }).passthrough();

export interface TeamMemberSeo {
  title: string;
  description: string | null;
  keywords: string | null;
  canonicalUrl: string;
  robots: string | null;
  image: string | null;
  structuredData: Record<string, unknown> | null;
  breadcrumbs: Record<string, unknown> | null;
}

export interface TeamMemberDetail {
  id: number;
  name: string;
  jobTitle: string | null;
  department: string | null;
  slug: string;
  bioHtml: string | null;
  avatar: TeamAvatar | null;
  social: Record<string, string>;
  href: string;
  seo: TeamMemberSeo;
}

function mapDetail(d: z.infer<typeof DetailSchema>): TeamMemberDetail {
  return {
    id: d.id,
    name: d.name,
    jobTitle: d.job_title ?? null,
    department: d.department ?? null,
    slug: d.slug,
    bioHtml: d.bio_html?.trim() || null,
    avatar: mapAvatar(d.avatar),
    social: d.social_links ?? {},
    href: d.canonical_path,
    seo: {
      title: d.seo.title,
      description: d.seo.description ?? null,
      keywords: d.seo.keywords ?? null,
      canonicalUrl: d.seo.canonical_url,
      robots: d.seo.robots ?? null,
      image: d.seo.image ?? null,
      structuredData: (d.seo.structured_data as Record<string, unknown> | null) ?? null,
      breadcrumbs: (d.seo.breadcrumbs as Record<string, unknown> | null) ?? null,
    },
  };
}

export interface TeamMemberResolution {
  member: TeamMemberDetail | null;
  /** مسار /team/{slug} الجديد إن كان الـslug المطلوب قديمًا (الباك إند يردّ 301 عبر
   * TeamMemberRedirectResolver) — الصفحة تستدعي permanentRedirect() به. */
  redirectTo: string | null;
}

/**
 * تفاصيل عضو نشِط بالـslug (+ حمولة SEO كاملة) — مع احترام تحويل 301 للـslug القديم
 * (redirect:'manual' لقراءة ترويسة Location بدل اتّباعها بصمت، وإلا يُعرَض المحتوى الصحيح
 * على رابط غير قانونيّ دون تصحيحه SEO-يًّا). لا تطابق نهائيّ ولا تحويل ⇒ member:null.
 */
export const getTeamMemberOrRedirect = cache(async (slug: string): Promise<TeamMemberResolution> => {
  const empty: TeamMemberResolution = { member: null, redirectTo: null };
  if (!env.apiBaseUrl || !slug) return empty;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/team/${encodeURIComponent(slug)}`, {
      redirect: 'manual',
      next: { revalidate: 3600, tags: ['team', `team:${slug}`] },
    });

    if (res.status === 301 || res.status === 308) {
      const location = res.headers.get('location');
      if (!location) return empty;
      try {
        const newSlug = new URL(location).pathname.replace(/^\/api\/v1\/team\//, '');
        return newSlug ? { member: null, redirectTo: `/team/${encodeURIComponent(newSlug)}` } : empty;
      } catch {
        return empty;
      }
    }

    if (!res.ok) return empty;
    const parsed = DetailEnvelope.safeParse(await res.json());
    const d = parsed.success ? parsed.data.data : null;
    return d ? { member: mapDetail(d), redirectTo: null } : empty;
  } catch {
    return empty;
  }
});
