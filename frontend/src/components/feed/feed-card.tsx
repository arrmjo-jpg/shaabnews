import Link from 'next/link';

import { FeedBadge } from '@/components/home/featured-hero';
import type { FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// كرت تغذية (نمط /latest): صورة 16:9 أعلى + شارة + قسم رابط حمراء + عنوان + تاريخ نسبيّ.
// **مصدر واحد** يُعاد استخدامه في /latest و /category — لا تكرار منطق. نمط الرابط المتراكب:
// رابط الخبر يغطّي الكرت؛ اسم القسم رابط مستقلّ فوقه (يفتح القسم لا الخبر).
export function FeedCard({ item }: { item: FeedItem }) {
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
