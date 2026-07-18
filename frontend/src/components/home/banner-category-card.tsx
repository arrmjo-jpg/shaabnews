import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { getCategoryById, getCategoryFeed } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// ثلاثة أقسام متجاورة (منوعات/تكنولوجيا/وظائف) — صفّ `lg:grid-cols-3`. **بطاقة تحريريّة نظيفة** (اختيار المستخدم
// بدل البانر الأحمر القديم): ترويسة (شارة عنوان حمراء + عرض الكل) + مقال مميّز (صورة 16:9 كاملة العرض + عنوان
// + تاريخ) + ٣ عناوين قائمة بفواصل + «المزيد». **التصنيف بالـID الثابت**، Server Component، ISR 300s، خطّ الموقع،
// تصميم مربّع، `text-primary`. متّسقة مع باقي أقسام الهوم. لا مقالات ⇒ تُخفى (عزل فشل).

interface CardConfig {
  categoryId: number;
  headingId: string;
  fallbackTitle?: string;
}

export function BannerTripleSection({ items }: { items: CardConfig[] }) {
  return (
    <section className="mt-6 bg-white sm:mt-8" dir="rtl">
      <Container className="py-8 sm:py-10">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {items.map((cfg) => (
            <BannerCategoryCard key={cfg.headingId} {...cfg} />
          ))}
        </div>
      </Container>
    </section>
  );
}

async function BannerCategoryCard({ categoryId, headingId, fallbackTitle }: CardConfig) {
  const category = await getCategoryById(categoryId);
  if (!category) return null;
  const items = await getCategoryFeed(category.slug, 4);
  if (items.length === 0) return null;
  const title = category.name.trim() || fallbackTitle || category.slug.replace(/-/g, ' ');
  const moreHref = category.href;

  const feature = items[0];
  const list = items.slice(1, 4);

  return (
    <article className="flex h-full flex-col" aria-labelledby={headingId}>
      {/* الترويسة — شارة عنوان حمراء + عرض الكل (متّسقة مع أقسام الهوم) */}
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-2">
        <h3 id={headingId} className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight md:text-2xl">
          <span className="h-7 w-1.5 shrink-0 bg-primary" aria-hidden />
          <Link href={moreHref} className="text-fg transition-colors hover:text-primary">
            {title}
          </Link>
        </h3>
        <Link
          href={moreHref}
          className="flex shrink-0 items-center gap-1 text-xs font-bold text-muted transition-colors hover:text-primary"
        >
          عرض الكل
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      </div>

      {/* المقال المميّز — صورة 16:9 كاملة العرض + عنوان + تاريخ (رابط متراكب) */}
      {feature && (
        <div className="group relative">
          <Link href={feature.href} className="absolute inset-0 z-10" aria-label={feature.title} />
          <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
            {feature.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
              <img
                src={feature.image}
                alt={feature.imageAlt}
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
              />
            ) : (
              <div className="size-full bg-surface-3" aria-hidden />
            )}
          </div>
          <h4 className="mt-3 line-clamp-2 text-base font-bold leading-snug text-fg transition-colors group-hover:text-primary sm:text-lg">
            {feature.title}
          </h4>
          {feature.publishedAt && (
            <time dateTime={feature.publishedAt} className="mt-1 block text-xs text-muted">
              {formatRelativeTime(feature.publishedAt)}
            </time>
          )}
        </div>
      )}

      {/* ٣ عناوين قائمة بفواصل */}
      {list.length > 0 && (
        <ul className="mt-3 flex-1">
          {list.map((item) => (
            <li key={item.id} className="group relative border-t border-border py-2.5">
              <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-fg transition-colors group-hover:text-primary">
                {item.title}
              </p>
              {item.publishedAt && (
                <time dateTime={item.publishedAt} className="mt-1 block text-[11px] text-muted">
                  {formatRelativeTime(item.publishedAt)}
                </time>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* المزيد */}
      <Link
        href={moreHref}
        className="mt-3 inline-block text-sm font-bold text-primary transition-colors hover:underline"
      >
        المزيد
      </Link>
    </article>
  );
}
