import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// طبقة بيانات الجريدة الرقمية — تعيد استخدام النقطة العامّة القائمة (صفر تغيير باك إند):
//   GET /api/v1/{locale}/epaper  → الأعداد المنشورة عامّة الوصول، الأحدث أوّلاً (≤60).
// server-only + React cache() (دمج طلبات الصفحة) + ISR + وسم كاش؛ أي فشل/فراغ ⇒ [] أو null (لا تلفيق).
// المظروف القياسيّ: { success, message, data }.
//
// ملاحظة صدق: المورد العامّ يكشف فقط { id, issue_number, title, subtitle, summary, slug,
// publication_date, page_count, canonical_path, pdf_url }. لا غلاف، ولا «نشرة/أبرز مختارات»
// منتقاة — تلك مصدرها تحريريّ غير موجود بعد، فتُعرَض بحالة فارغة صادقة (لا محتوى مُلفَّق).

const REVALIDATE = 36000; // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر FrontendRevalidate::tags().
const epaperFeedTag = (locale: string) => `epaper-feed:${locale}`;
const enc = encodeURIComponent;

export interface BriefPoint {
  title: string;
  why: string | null;
}
export interface HighlightItem {
  title: string;
  quote: string | null;
  page: number | null;
}
export interface InsideSection {
  label: string;
  lead: string | null;
  page: number | null;
}

// عدد رقميّ موحّد للواجهة.
export interface EpaperIssue {
  id: number;
  issueNumber: number;
  title: string;
  subtitle: string | null;
  summary: string | null;
  slug: string;
  publicationDate: string | null; // YYYY-MM-DD
  pageCount: number | null;
  readHref: string; // قارئ Blade pdf.js المسبوق باللغة: /{locale}/epaper/{id}-{slug}
  readerHref: string; // القارئ الأصليّ في Next (الجديد): /newspaper/{id}-{slug}
  downloadUrl: string | null;
  cover: string | null; // غلاف الصفحة 1 (conversions['cover']) أو null ⇒ بديل طباعيّ صادق
  briefPoints: BriefPoint[];
  highlights: HighlightItem[];
  insideThisIssue: InsideSection[];
}

const EpaperItemSchema = z
  .object({
    id: z.number(),
    issue_number: z.number(),
    title: z.string(),
    subtitle: z.string().nullish(),
    summary: z.string().nullish(),
    slug: z.string(),
    publication_date: z.string().nullish(),
    page_count: z.number().nullish(),
    canonical_path: z.string().nullish(),
    pdf_url: z.string().nullish(),
    cover_url: z.string().nullish(),
    brief_points: z.array(z.object({ title: z.string(), why: z.string().nullish() }).passthrough()).nullish(),
    highlights: z
      .array(z.object({ title: z.string(), quote: z.string().nullish(), page: z.number().nullish() }).passthrough())
      .nullish(),
    inside_this_issue: z
      .array(z.object({ label: z.string(), lead: z.string().nullish(), page: z.number().nullish() }).passthrough())
      .nullish(),
  })
  .passthrough();

const ListEnvelope = z.object({ data: z.array(EpaperItemSchema).nullish() }).passthrough();

type RawEpaper = z.infer<typeof EpaperItemSchema>;

function mapIssue(r: RawEpaper): EpaperIssue {
  return {
    id: r.id,
    issueNumber: r.issue_number,
    title: r.title,
    subtitle: r.subtitle ?? null,
    summary: r.summary ?? null,
    slug: r.slug,
    publicationDate: r.publication_date ?? null,
    pageCount: r.page_count ?? null,
    readHref: r.canonical_path ?? '#',
    readerHref: `/newspaper/${r.id}-${r.slug}`,
    // التحميل يمرّ بمسار التنزيل المخصّص (يفرض حفظ الملفّ كمرفق + يتحقّق من الاستحقاق + يسجّل
    // العدّاد) لا رابط الـPDF الخام الذي يفتحه المتصفّح داخل الصفحة. نفس‑الأصل عبر إعادة الكتابة.
    downloadUrl: r.canonical_path ? `${r.canonical_path}/download` : null,
    cover: r.cover_url ?? null,
    briefPoints: (r.brief_points ?? []).map((p) => ({ title: p.title, why: p.why ?? null })),
    highlights: (r.highlights ?? []).map((h) => ({ title: h.title, quote: h.quote ?? null, page: h.page ?? null })),
    insideThisIssue: (r.inside_this_issue ?? []).map((s) => ({ label: s.label, lead: s.lead ?? null, page: s.page ?? null })),
  };
}

/** كل الأعداد المنشورة العامّة، الأحدث أوّلاً. فشل/فراغ ⇒ []. */
export const getEpapers = cache(async (locale = 'ar'): Promise<EpaperIssue[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${enc(locale)}/epaper`, {
      headers: env.internalHeaders,
      next: { revalidate: REVALIDATE, tags: [epaperFeedTag(locale)] },
    });
    if (!res.ok) return [];
    const parsed = ListEnvelope.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.data ?? []).map(mapIssue);
  } catch {
    return [];
  }
});

/** أحدث عدد منشور (الأوّل) أو null. */
export const getLatestEpaper = cache(async (locale = 'ar'): Promise<EpaperIssue | null> => {
  const all = await getEpapers(locale);
  return all[0] ?? null;
});
