import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// ── Public Static Pages — يعيد استخدام نقطتي النظام القائم:
//   • القائمة (تنقّل/فوتر): GET /{locale}/pages?placement=header|footer
//   • التفاصيل (القراءة)  : GET /{locale}/pages/{slug}  (منشورة فقط؛ تتبع 301 لسلَغ قديم عبر fetch).
// لا API/CMS جديد. أي فشل/شكل غير صالح ⇒ [] أو null (لا تلفيق) فيُخفي القسم أو يُعيد 404.

// نزع بادئة اللغة (الواجهة العامة بلا /ar|/en) — مطابق لـ articles/feed (دالّة محليّة، لا تصدير عابر).
function localeless(path: string | null | undefined): string {
  if (!path) return '#';
  return path.replace(/^\/[a-z]{2}(?=\/)/, '') || '#';
}

// ── عقد القائمة (تنقّل/فوتر) ──
const StaticPageSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    slug: z.string(),
    canonical_path: z.string(),
  })
  .passthrough();

export type StaticPage = z.infer<typeof StaticPageSchema> & { href: string };

const EnvelopeSchema = z.object({ data: z.array(StaticPageSchema).nullish() }).passthrough();

export type PagePlacement = 'header' | 'footer';

// Cached + deduped per request (React cache) + Next data cache (tag-revalidatable).
// `href` بلا بادئة لغة (يطابق روابط المقالات/الفيديو ويُصلح روابط الفوتر/الهيدر).
export const getStaticPages = cache(
  async (placement: PagePlacement, locale = 'ar'): Promise<StaticPage[]> => {
    if (!env.apiBaseUrl) return [];
    try {
      const res = await fetch(
        `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/pages?placement=${placement}`,
        // وسم القاموس الموحَّد (يطابق FrontendCacheTags::page حرفيًّا) — إبطال حدثيّ من الباك إند.
        { next: { revalidate: 36000, tags: [`page-feed:${locale}`] } }, // ISR — سقف أمان فقط.
      );
      if (!res.ok) return [];
      const parsed = EnvelopeSchema.safeParse(await res.json());
      if (!parsed.success) return [];
      return (parsed.data.data ?? []).map((p) => ({ ...p, href: localeless(p.canonical_path) }));
    } catch {
      return [];
    }
  },
);

// ── عقد التفاصيل (PublicPageResource) ──
const PageDetailSchema = z
  .object({
    id: z.number(),
    locale: z.string(),
    title: z.string(),
    slug: z.string(),
    content_html: z.string().nullish(),
    template: z.string().nullish(),
    seo: z
      .object({
        title: z.string().nullish(),
        description: z.string().nullish(),
        keywords: z.string().nullish(),
        canonical_url: z.string().nullish(),
        robots: z.string().nullish(),
      })
      .nullish(),
    canonical_path: z.string(),
    published_at: z.string().nullish(),
    updated_at: z.string().nullish(),
  })
  .passthrough();

const DetailEnvelope = z.object({ data: PageDetailSchema.nullish() }).passthrough();

export interface StaticPageDetail {
  id: number;
  locale: string;
  title: string;
  slug: string;
  contentHtml: string;
  template: string | null;
  href: string;
  seo: {
    title: string | null;
    description: string | null;
    keywords: string | null;
    canonicalUrl: string | null;
    robots: string | null;
  };
  publishedAt: string | null;
  updatedAt: string | null;
}

export const getStaticPage = cache(
  async (slug: string, locale = 'ar'): Promise<StaticPageDetail | null> => {
    if (!env.apiBaseUrl) return null;
    try {
      const res = await fetch(
        `${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/pages/${encodeURIComponent(slug)}`,
        // وسم تفاصيل الصفحة (قاموس موحَّد) — تعديل الصفحة يبطل صفحتها فقط.
        { next: { revalidate: 36000, tags: [`page:${locale}:${slug}`] } }, // ISR — سقف أمان فقط.
      );
      if (!res.ok) return null;
      const parsed = DetailEnvelope.safeParse(await res.json());
      if (!parsed.success || !parsed.data.data) return null;
      const p = parsed.data.data;
      return {
        id: p.id,
        locale: p.locale,
        title: p.title,
        slug: p.slug,
        contentHtml: p.content_html ?? '',
        template: p.template ?? null,
        href: localeless(p.canonical_path),
        seo: {
          title: p.seo?.title ?? null,
          description: p.seo?.description ?? null,
          keywords: p.seo?.keywords ?? null,
          canonicalUrl: p.seo?.canonical_url ?? null,
          robots: p.seo?.robots ?? null,
        },
        publishedAt: p.published_at ?? null,
        updatedAt: p.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },
);

// ── تقسيم FAQ (template=faq): سؤال (h2) + جواب (HTML التالي حتى الـh2 التالي). يُغذّي
//    الأكورديون (details) + FAQPage JSON-LD. تحويل خادميّ مُقيَّد على محتوى مُعقَّم. ──
export interface FaqItem {
  question: string;
  answerHtml: string;
}

export function splitFaq(html: string): FaqItem[] {
  const parts = html.split(/(<h2(?:\s[^>]*)?>[\s\S]*?<\/h2>)/gi).filter((s) => s.trim() !== '');
  const items: FaqItem[] = [];
  for (let k = 0; k < parts.length; k += 1) {
    const match = parts[k].match(/^<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>$/i);
    if (!match) continue;
    const question = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const next = parts[k + 1];
    const answerHtml = next && !/^<h2/i.test(next) ? next : '';
    if (question) items.push({ question, answerHtml });
  }
  return items;
}
