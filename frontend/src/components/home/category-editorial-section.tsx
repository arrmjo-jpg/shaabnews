import { ChevronLeft, Clock } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// قسم تصنيف تحريريّ مُعاد الاستخدام (شؤون برلمانية، نبض الشارع، …) — كتل متتابعة في الهوم.
// نمط الكتلة: getCategoryFeed(slug,6) ⇒ مقالان مميّزان (صورة 16:9 + قسم + عنوان + تاريخ) + قائمة 4
// (مصغّرة 110×70) في شبكة 3 أعمدة RTL بفواصل لوجيّة. **يتكيّف مع قلّة المقالات**: لا قائمة ⇒ عمودان
// فقط (لا عمود فارغ). Server Component، ISR 300s، خطّ الجزيرة، تصميم مربّع، `text-primary`. لا مقالات ⇒ يُخفى.
export async function EditorialCategorySection({
  categoryId,
  headingId,
  fallbackTitle,
}: {
  categoryId: number;
  headingId: string;
  fallbackTitle?: string;
}) {
  // **التصنيف بالـID الثابت** ⇒ الـslug/الاسم الحاليّان (مقاوم لإعادة تسمية الإدارة). غير موجود/محذوف ⇒ يُخفى.
  const category = await getCategoryById(categoryId);
  if (!category) return null;
  const items = await getCategoryFeed(category.slug, 6);
  if (items.length === 0) return null;
  const title = category.name.trim() || fallbackTitle || category.slug.replace(/-/g, ' ');

  const features = items.slice(0, 2);
  const list = items.slice(2, 6);
  const hasList = list.length > 0;
  const moreHref = category.href;

  return (
    <section className="mt-6 bg-white sm:mt-8" dir="rtl" aria-labelledby={headingId}>
      <Container className="py-8 sm:py-10">
        {/* الترويسة */}
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1.5 shrink-0 bg-primary" aria-hidden />
            <h2 id={headingId} className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              <Link href={moreHref} className="transition-colors hover:text-primary">
                {title}
              </Link>
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

        {/* الشبكة: مقالان مميّزان + قائمة — أو عمودان فقط عند قلّة المقالات (لا عمود فارغ) */}
        {hasList ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-0">
            {features[0] && <FeatureArticle item={features[0]} className="lg:pe-6" />}
            {features[1] && (
              <FeatureArticle item={features[1]} className="lg:border-s lg:border-border lg:px-6" />
            )}
            <div className="lg:border-s lg:border-border lg:ps-6">
              <ul className="divide-y divide-border">
                {list.map((item) => (
                  <ListItem key={item.id} item={item} />
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {features.map((item) => (
              <FeatureArticle key={item.id} item={item} />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

// مقال مميّز — صورة 16:9 + قسم + عنوان + تاريخ. رابط متراكب يغطّي البطاقة (القسم رابط مستقلّ z-20).
function FeatureArticle({ item, className = '' }: { item: FeedItem; className?: string }) {
  return (
    <article className={`group relative flex flex-col ${className}`}>
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
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
      <div className="featured-accent-marker" aria-hidden />

      <div className="pt-4">
        <CategoryLabel item={item} />
        <h3 className="mt-1.5 text-base font-bold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline sm:text-lg">
          {item.title}
        </h3>
        {item.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{item.excerpt}</p>
        )}
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

// عنصر قائمة — صورة مصغّرة 110×70 + عنوان + قسم.
function ListItem({ item }: { item: FeedItem }) {
  return (
    <li className="group relative py-4 first:pt-0 last:pb-0">
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />
      <div className="flex items-start gap-3">
        <div className="relative h-[70px] w-[110px] shrink-0 overflow-hidden bg-surface-2">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
            <img
              src={item.image}
              alt={item.imageAlt}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="size-full bg-surface-3" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-sm font-bold leading-6 text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline">
            {item.title}
          </h4>
          <div className="mt-1">
            <CategoryLabel item={item} small />
          </div>
        </div>
      </div>
    </li>
  );
}

// شارة القسم (أحمر) — رابط مستقلّ فوق الرابط المتراكب.
function CategoryLabel({ item, small = false }: { item: FeedItem; small?: boolean }) {
  if (!item.category) return null;
  const cls = `font-extrabold text-primary ${small ? 'text-[10px]' : 'text-xs'}`;
  return item.categoryHref ? (
    <Link href={item.categoryHref} className={`relative z-20 ${cls} hover:underline`}>
      {item.category}
    </Link>
  ) : (
    <span className={cls}>{item.category}</span>
  );
}
