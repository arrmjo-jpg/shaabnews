import Link from 'next/link';
import { Clock } from 'lucide-react';

import type { FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// صفّ خبر مُدمج: صورة مصغّرة + عنوان + تاريخ نسبيّ، رابط متراكب على كامل الصفّ.
// مصدر واحد يُعاد استخدامه في NewsTabs (الشريط الجانبيّ، compact) وتغذية القسم الرئيسية
// (CategoryLoadMoreFeed، feed — صورة أكبر + مقتطف، تناسبًا مع عرض عمود المحتوى الرئيسي).
export function NewsListItem({
  item,
  variant = 'compact',
  isFirst = false,
}: {
  item: FeedItem;
  variant?: 'compact' | 'feed';
  isFirst?: boolean;
}) {
  const isFeed = variant === 'feed';

  return (
    <Link
      href={item.href}
      className={`group flex items-start gap-4 transition-all duration-300 ${
        isFeed ? 'p-4 sm:p-5 hover:bg-surface-2/30' : 'p-3 hover:bg-surface-2'
      }`}
    >
      <div
        className={`relative shrink-0 overflow-hidden bg-surface-2 transition-transform duration-500 ease-out ${
          isFeed ? 'aspect-[16/10] w-24 sm:w-48' : 'aspect-[4/3] w-16'
        }`}
      >
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود (سياسة صور الواجهة)
          <img
            src={item.image}
            alt={item.imageAlt}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-102"
          />
        ) : (
          <div className="size-full bg-surface-3" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h4
          className={`font-heading leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-focus-visible:underline ${
            isFeed
              ? isFirst
                ? 'text-base font-black sm:text-lg lg:text-[22px] line-clamp-2'
                : 'text-base font-extrabold sm:text-lg lg:text-xl line-clamp-2'
              : 'text-sm font-bold line-clamp-2'
          }`}
        >
          {item.title}
        </h4>
        {isFeed && item.excerpt && (
          <p className="mt-2 hidden line-clamp-2 text-sm leading-relaxed text-muted sm:block">
            {item.excerpt}
          </p>
        )}
        {item.publishedAt && (
          isFeed ? (
            <span className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <time dateTime={item.publishedAt}>
                {formatRelativeTime(item.publishedAt)}
              </time>
            </span>
          ) : (
            <time
              dateTime={item.publishedAt}
              className="mt-1 block text-caption text-muted"
            >
              {formatRelativeTime(item.publishedAt)}
            </time>
          )
        )}
      </div>
    </Link>
  );
}
