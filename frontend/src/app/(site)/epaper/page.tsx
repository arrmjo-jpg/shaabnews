import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EpaperGridViewer } from '@/components/epaper/epaper-grid-viewer';
import { Container } from '@/components/layout/container';
import { getEpapers } from '@/lib/epaper';
import { buildMetadata } from '@/lib/seo';
import { getSiteSettings, resolveNewspaperGate } from '@/lib/site-settings';

// «الجريدة الرقمية» — جدار الأعداد (أغلفة + مشاركة + تحميل + بحث برقم/تاريخ). نقر عدد ⇒ يفتح
// بنمط الرأي (PDF مضمَّن في العارض). بوّابة المنتج newspaper_enabled — 404 فقط عند تعطيل مؤكَّد
// (resolveNewspaperGate === 'disabled')؛ حالة غير معروفة (فشل جلب الإعدادات) لا تُغلِق الصفحة.
// ISR = سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر epaper-feed:{locale}.
export const revalidate = 36000;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'الجريدة الرقمية', path: '/epaper' });
}

export default async function EpaperPage() {
  const settings = await getSiteSettings();
  if (resolveNewspaperGate(settings) === 'disabled') notFound();

  const issues = await getEpapers();

  return (
    <Container className="py-8 md:py-12">
      <header className="mb-8 text-center" dir="rtl">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          الجريدة الرقمية
        </h1>
        <p className="mt-2 text-sm text-muted">كل الأعداد — اختر عدداً لقراءته كاملاً.</p>
      </header>

      {issues.length > 0 ? (
        <EpaperGridViewer issues={issues} />
      ) : (
        <div className="mx-auto flex max-w-md flex-col items-center justify-center border border-dashed border-border bg-surface-2 px-6 py-20 text-center">
          <p className="text-sm text-muted">لا توجد أعداد منشورة بعد.</p>
        </div>
      )}
    </Container>
  );
}
