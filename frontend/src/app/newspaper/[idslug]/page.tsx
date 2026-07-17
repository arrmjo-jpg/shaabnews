import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { NewspaperReader } from '@/components/epaper/reader/newspaper-reader';
import { getEpapers, type EpaperIssue } from '@/lib/epaper';
import { buildMetadata } from '@/lib/seo';
import { getSiteSettings } from '@/lib/site-settings';

// القارئ الأصليّ (pdf.js) — خارج مجموعة (site) ⇒ صفحة غامرة بلا هيدر/فوتر الموقع. SEO عبر
// buildMetadata (عنوان/وصف/canonical/OG)، قابلة للفهرسة (العدد عامّ). بوّابة newspaper_enabled.
// ISR = سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر epaper-feed:{locale}.
export const revalidate = 36000;

// بدون هذه (حتى فارغة)، Next.js يُعامل مسارات dynamic params كـdynamic بالكامل دومًا (no-store)
// بصرف النظر عن revalidate أعلاه — تأكَّد تجريبيًا أثناء ISR Restoration (راجع articles/[idslug]).
export async function generateStaticParams() {
  return [];
}

async function resolveIssue(idslug: string): Promise<EpaperIssue | null> {
  const id = Number.parseInt(idslug, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  const issues = await getEpapers();
  return issues.find((i) => i.id === id) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ idslug: string }>;
}): Promise<Metadata> {
  const { idslug } = await params;
  const issue = await resolveIssue(idslug);
  if (!issue) return buildMetadata({ title: 'الجريدة الرقمية', path: '/epaper' });

  const description =
    issue.summary?.trim() ||
    `العدد ${issue.issueNumber}${issue.publicationDate ? ` — ${issue.publicationDate}` : ''} — الجريدة الرقمية`;

  return buildMetadata({
    title: issue.title,
    description,
    path: `/newspaper/${issue.id}-${issue.slug}`,
    image: issue.cover ?? undefined,
    type: 'article',
  });
}

export default async function NewspaperReaderPage({
  params,
}: {
  params: Promise<{ idslug: string }>;
}) {
  const settings = await getSiteSettings();
  if (!settings?.newspaper_enabled) notFound();

  const { idslug } = await params;
  const issue = await resolveIssue(idslug);
  if (!issue) notFound();

  return (
    <NewspaperReader
      src={`/api/epaper/${issue.id}`}
      storageId={String(issue.id)}
      title={issue.title}
      backHref="/epaper"
      downloadUrl={issue.downloadUrl}
    />
  );
}
