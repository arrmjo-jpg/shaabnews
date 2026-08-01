import { ChevronLeft, Clock } from 'lucide-react';
import Link from 'next/link';

import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// كتلة «أخبار رياضية» في العمود العريض لـ/sport — المصدر = **إدارتنا** (آخر ٦ مقالات من قسم الرياضة)، لا 365.
// إعادة استخدام طبقة الجلب (getCategoryById بالـID الثابت + getCategoryFeed sorted -published_at) ونمط بطاقة الهوم.
// التصنيف بالـID الثابت (مقاوم لإعادة التسمية). لا مقالات/تصنيف محذوف ⇒ يُخفى (لا تلفيق). ISR 300s. هويّة الموقع.
const SPORTS_CATEGORY_ID = 4;

export async function SportNews({ headingId = 'sport-news-heading' }: { headingId?: string }) {
  const category = await getCategoryById(SPORTS_CATEGORY_ID);
  if (!category) return null;
  const items = await getCategoryFeed(category.slug, 6);
  if (items.length === 0) return null;
  const moreHref = category.href;

  return (
    <section dir="rtl" aria-labelledby={headingId}>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1.5 shrink-0 bg-primary" aria-hidden />
          <h2 id={headingId} className="text-lg font-extrabold text-fg sm:text-xl">
            أخبار رياضية
          </h2>
        </div>
        <Link
          href={moreHref}
          className="flex shrink-0 items-center gap-1 text-sm font-bold text-muted transition-colors hover:text-primary"
        >
          عرض الكل
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

// بطاقة خبر — صورة 16:9 + قسم + عنوان + تاريخ. رابط متراكب يغطّي البطاقة (القسم رابط مستقلّ z-20).
function NewsCard({ item }: { item: FeedItem }) {
  return (
    <article className="group relative flex flex-col">
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود (اتّساق مع كتل الهوم)
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

      <div className="pt-3">
        {item.category &&
          (item.categoryHref ? (
            <Link href={item.categoryHref} className="relative z-20 text-xs font-extrabold text-primary hover:underline">
              {item.category}
            </Link>
          ) : (
            <span className="text-xs font-extrabold text-primary">{item.category}</span>
          ))}
        <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline sm:text-base">
          {item.title}
        </h3>
        {item.publishedAt && (
          <span className="mt-2 flex items-center gap-1 text-xs text-muted">
            <Clock className="size-3 shrink-0" aria-hidden />
            <time dateTime={item.publishedAt}>{formatRelativeTime(item.publishedAt)}</time>
          </span>
        )}
      </div>
    </article>
  );
}
