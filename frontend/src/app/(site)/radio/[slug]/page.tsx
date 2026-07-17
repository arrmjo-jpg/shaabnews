import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BroadcastWatch } from '@/components/broadcast/broadcast-watch';
import { getBroadcast } from '@/lib/broadcast';
import { buildMetadata } from '@/lib/seo';

// صفحة محطّة راديو — /radio/{slug}. تعيد استخدام GET /api/v1/radio/{slug}.
// ISR = سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر broadcast:radio:{slug}.
export const revalidate = 36000;

// بدون هذه (حتى فارغة)، Next.js يُعامل مسارات dynamic params كـdynamic بالكامل دومًا (no-store)
// بصرف النظر عن revalidate أعلاه — تأكَّد تجريبيًا أثناء ISR Restoration (راجع articles/[idslug]).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBroadcast('radio', slug);
  if (!b) return buildMetadata({ title: 'محطات الراديو' });
  return buildMetadata({
    title: b.title,
    description: b.excerpt ?? b.description ?? undefined,
    path: b.href,
    image: b.shareImage ?? undefined,
    type: 'article',
  });
}

export default async function RadioBroadcastPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBroadcast('radio', slug);
  if (!b) notFound();
  return <BroadcastWatch broadcast={b} />;
}
