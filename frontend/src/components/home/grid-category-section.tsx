import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// قسم تصنيف بشبكة بطاقات موحّدة (عربي دولي، …) — صورة 16:9 + عنوان + تاريخ نسبيّ، ٣ أعمدة (٦ بطاقات، صفّان).
// بطاقات متساوية بسيطة: لا كِكَر/لا ملخّص/لا قائمة (عكس editorial، الذي يضع مميّزَين + قائمة). **التصنيف بالـID
// الثابت** (مقاوم لإعادة التسمية) ⇒ الـslug/الاسم الحاليّان. Server Component، ISR 300s، خطّ الموقع، تصميم
// مربّع، `text-primary`، `<img>`، بلا بادئة لغة. لا مقالات ⇒ يُخفى (عزل فشل، لا تلفيق).
export async function GridCategorySection({
  categoryId,
  headingId,
  fallbackTitle,
}: {
  categoryId: number;
  headingId: string;
  fallbackTitle?: string;
}) {
  // **التصنيف بالـID الثابت** ⇒ الـslug/الاسم الحاليّان (مقاوم لإعادة التسمية). غير موجود/محذوف ⇒ يُخفى.
  const category = await getCategoryById(categoryId);
  if (!category) return null;
  const items = await getCategoryFeed(category.slug, 6);
  if (items.length === 0) return null;
  const title = category.name.trim() || fallbackTitle || category.slug.replace(/-/g, ' ');
  const moreHref = category.href;

  return (
    <section className="mt-6 bg-white sm:mt-8" dir="rtl" aria-labelledby={headingId}>
      <Container className="py-8 sm:py-10">
        {/* الترويسة — متّسقة مع بقيّة أقسام الهوم */}
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

        {/* شبكة بطاقات موحّدة — عمود ثمّ عمودان ثمّ ٣ أعمدة (٦ بطاقات = صفّان) */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <GridCard key={item.id} item={item} />
          ))}
        </div>
      </Container>
    </section>
  );
}

// بطاقة موحّدة — صورة 16:9 + عنوان + تاريخ نسبيّ. الرابط يغطّي البطاقة كاملةً (بلا روابط متداخلة).
function GridCard({ item }: { item: FeedItem }) {
  return (
    <Link href={item.href} className="group flex flex-col">
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
      <h3 className="mt-3 line-clamp-2 text-base font-bold leading-snug text-fg transition-colors group-hover:text-primary sm:text-lg">
        {item.title}
      </h3>
      {item.publishedAt && (
        <time dateTime={item.publishedAt} className="mt-2 block text-xs text-muted">
          {formatRelativeTime(item.publishedAt)}
        </time>
      )}
    </Link>
  );
}
