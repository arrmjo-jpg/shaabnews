import type { Metadata } from 'next';
import Link from 'next/link';

import { FeedBadge } from '@/components/home/featured-hero';
import { Container } from '@/components/layout/container';
import type { FeedItem } from '@/lib/feed';
import { getMostReadFeed } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// صفحة «الأكثر شيوعا» — المقالات الرائجة (تفاعل موزون، نافذة 7 أيام). ISR = سقف أمان فقط؛ إبطال حدثيّ عبر feed:most_read.
export const revalidate = 36000;

export const metadata: Metadata = { title: 'الأكثر شيوعا' };

export default async function TrendingPage() {
  const items = await getMostReadFeed('ar', 30);

  return (
    <Container className="py-8 sm:py-10">
      {/* ترويسة الصفحة: شارة حمراء عموديّة + العنوان */}
      <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
        <span className="h-8 w-1 shrink-0 bg-primary" style={{ borderRadius: '9999px' }} aria-hidden />
        <h1 className="font-heading text-2xl font-extrabold text-fg sm:text-3xl">الأكثر شيوعا</h1>
      </div>

      {items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-surface-2 px-6 py-20 text-center"
          style={{ borderRadius: '12px' }}
        >
          <h2 className="font-heading text-h3 font-bold text-fg">لا يوجد محتوى رائج بعد</h2>
          <p className="max-w-md text-sm text-muted">ستظهر هنا الأخبار الأكثر تفاعلاً.</p>
        </div>
      ) : (
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <li key={item.id}>
              <TrendingCard item={item} rank={i + 1} />
            </li>
          ))}
        </ol>
      )}
    </Container>
  );
}

// كرت رائج (صورة أعلى + رقم ترتيب): صورة + شارة + رقم + قسم رابط حمراء + عنوان + تاريخ نسبيّ.
// نمط الرابط-المتراكب: رابط الخبر يغطّي الكرت؛ اسم القسم رابط مستقلّ فوقه (يفتح القسم لا الخبر).
function TrendingCard({ item, rank }: { item: FeedItem; rank: number }) {
  return (
    <div className="group relative">
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

      <div
        className="relative aspect-video transform-gpu overflow-hidden bg-surface-2 will-change-transform"
        style={{ borderRadius: '12px' }}
      >
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الواجهة
          <img
            src={item.image}
            alt={item.imageAlt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full transform-gpu object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="absolute inset-0 size-full bg-surface-3" aria-hidden />
        )}

        {/* رقم الترتيب — شارة بداية أعلى الصورة */}
        <span
          className="absolute top-2 z-20 flex min-w-7 items-center justify-center bg-primary px-2 py-0.5 text-sm font-black text-primary-foreground tabular-nums"
          style={{ insetInlineStart: '0.5rem', borderRadius: '8px' }}
          aria-hidden
        >
          {String(rank).padStart(2, '0')}
        </span>
      </div>

      <FeedBadge badge={item.badge} />

      <div className="mt-3 flex flex-col items-start gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {item.category &&
            (item.categoryHref ? (
              <Link
                href={item.categoryHref}
                className="relative z-20 w-fit text-caption font-extrabold text-primary hover:underline"
              >
                {item.category}
              </Link>
            ) : (
              <span className="text-caption font-extrabold text-primary">{item.category}</span>
            ))}
          {item.publishedAt && (
            <time dateTime={item.publishedAt} className="text-caption font-medium text-muted">
              {formatRelativeTime(item.publishedAt)}
            </time>
          )}
        </div>
        <h3 className="line-clamp-3 font-heading text-base font-bold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline sm:text-lg">
          {item.title}
        </h3>
      </div>
    </div>
  );
}
