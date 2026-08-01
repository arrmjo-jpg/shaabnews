import type { Metadata } from 'next';
import Link from 'next/link';

import { FeedBadge } from '@/components/home/featured-hero';
import { Container } from '@/components/layout/container';
import type { FeedItem } from '@/lib/feed';
import { getCategoryFeed } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// صفحة «اقتصاد» (هدف «عرض الكل») — أحدث مقالات تصنيف الاقتصاد.
// ISR = سقف أمان فقط؛ التحديث الفعليّ حدثيّ عبر category:{slug}/articles (نفس نمط category/[slug]).
export const revalidate = 36000;

export const metadata: Metadata = { title: 'اقتصاد' };

const ECONOMY_SLUG = 'اقتصاد-واعمال';

export default async function EconomyPage() {
  const items = await getCategoryFeed(ECONOMY_SLUG, 24);

  return (
    <Container className="py-8 sm:py-10">
      <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
        <span className="h-8 w-1 shrink-0 bg-primary" style={{ borderRadius: '9999px' }} aria-hidden />
        <h1 className="font-heading text-2xl font-extrabold text-fg sm:text-3xl">اقتصاد</h1>
      </div>

      {items.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-surface-2 px-6 py-20 text-center"
          style={{ borderRadius: '12px' }}
        >
          <h2 className="font-heading text-h3 font-bold text-fg">لا توجد أخبار اقتصاديّة بعد</h2>
          <p className="max-w-md text-sm text-muted">ستظهر هنا أحدث أخبار الاقتصاد فور نشرها.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <EconomyListCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

function EconomyListCard({ item }: { item: FeedItem }) {
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
