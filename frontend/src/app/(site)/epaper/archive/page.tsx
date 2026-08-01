import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArchiveSearch } from '@/components/epaper/archive-search';
import { SavedPages } from '@/components/epaper/saved-pages';
import { Container } from '@/components/layout/container';
import { getEpapers } from '@/lib/epaper';
import { buildMetadata } from '@/lib/seo';
import { getSiteSettings, resolveNewspaperGate } from '@/lib/site-settings';

// أرشيف الجريدة الرقمية — جدار الأغلفة (بحث/ترشيح) + محفوظاتي. قابل للفهرسة (الأرشيف فقط).
// 404 فقط عند تعطيل مؤكَّد (resolveNewspaperGate === 'disabled')؛ راجع epaper/page.tsx.
// ISR = سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر epaper-feed:{locale}.
export const revalidate = 36000;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'أرشيف الجريدة الرقمية', path: '/epaper/archive' });
}

export default async function EpaperArchivePage() {
  const settings = await getSiteSettings();
  if (resolveNewspaperGate(settings) === 'disabled') notFound();

  const issues = await getEpapers();

  return (
    <Container className="py-8 md:py-12">
      <header className="mb-8" dir="rtl">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">أرشيف الجريدة الرقمية</h1>
        <p className="mt-2 text-sm text-muted">كل الأعداد المنشورة — الأحدث أوّلاً.</p>
      </header>

      <ArchiveSearch issues={issues} />
      <SavedPages issues={issues} />
    </Container>
  );
}
