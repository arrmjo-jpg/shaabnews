import type { Metadata } from 'next';

import { FeedCard } from '@/components/feed/feed-card';
import { Container } from '@/components/layout/container';
import { getLatestFeed } from '@/lib/feed';

// صفحة «آخر المستجدات» — أحدث الأخبار المنشورة. ISR = سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر feed:latest.
export const revalidate = 36000;

export const metadata: Metadata = { title: 'آخر المستجدات' };

export default async function LatestPage() {
  const items = await getLatestFeed();

  return (
    <Container className="py-8 sm:py-10">
      {/* ترويسة الصفحة: شارة حمراء عموديّة + العنوان */}
      <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
        <span className="h-8 w-1 shrink-0 bg-primary" style={{ borderRadius: '9999px' }} aria-hidden />
        <h1 className="font-heading text-2xl font-extrabold text-fg sm:text-3xl">آخر المستجدات</h1>
      </div>

      {items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-surface-2 px-6 py-20 text-center"
          style={{ borderRadius: '12px' }}
        >
          <h2 className="font-heading text-h3 font-bold text-fg">لا توجد أخبار بعد</h2>
          <p className="max-w-md text-sm text-muted">ستظهر هنا أحدث الأخبار فور نشرها.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <FeedCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
