import { Clock } from 'lucide-react';
import Link from 'next/link';

import type { FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// بطاقة مقال اقتصاد (الطبقة 3): صورة كبيرة + قسم + تاريخ + عنوان — لا مقتطف/كاتب. بيضاء فوق الأحمر.
// نمط الرابط-المتراكب: رابط الخبر يغطّي البطاقة؛ القسم رابط مستقلّ فوقه (z-20).
export function EconomyCard({ item }: { item: FeedItem }) {
  return (
    <article
      className="group relative flex flex-col overflow-hidden bg-white shadow-sm transition-shadow hover:shadow-xl"
      style={{ borderRadius: '14px' }}
    >
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
          <img
            src={item.image}
            alt={item.imageAlt}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="size-full bg-surface-3" aria-hidden />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold">
          {item.category &&
            (item.categoryHref ? (
              <Link href={item.categoryHref} className="relative z-20 text-primary hover:underline">
                {item.category}
              </Link>
            ) : (
              <span className="text-primary">{item.category}</span>
            ))}
          {item.publishedAt && (
            <span className="flex items-center gap-1 text-muted">
              <Clock className="size-3" aria-hidden />
              <time dateTime={item.publishedAt}>{formatRelativeTime(item.publishedAt)}</time>
            </span>
          )}
        </div>
        <h3 className="line-clamp-3 text-sm font-bold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline">
          {item.title}
        </h3>
      </div>
    </article>
  );
}
