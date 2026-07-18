import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';

// قسم مقالات الرأي (بورتريه، أسفل نبض الشارع) — صفّ بطاقات: صورة + عنوان المقال + اسم الكاتب.
// **الـslug ديناميّ عبر prop** (لا ثابت داخل المكوّن). المصدر `getCategoryFeed(slug,6)` + العنوان من التصنيف.
// **ملاحظة بيانات:** هذا الباك إند ينسب كلّ مقالات الرأي لكاتب عامّ واحد («كتاب الموقع») بلا كُتّاب أفراد ⇒
// الصورة = **غلاف المقال** (متمايز) لا صورة كاتب واحدة مكرّرة؛ حين تتوفّر صور كُتّاب يُبدَّل لـauthor.avatar.
// صفر تلفيق: لا مقالات ⇒ يُخفى.
export async function OpinionWritersSection({
  categoryId,
  headingId,
  fallbackTitle,
}: {
  categoryId: number;
  headingId: string;
  fallbackTitle?: string;
}) {
  // **التصنيف بالـID الثابت** ⇒ الـslug/الاسم الحاليّان (مقاوم لإعادة التسمية). غير موجود ⇒ يُخفى.
  const category = await getCategoryById(categoryId);
  if (!category) return null;
  const items = await getCategoryFeed(category.slug, 6);
  if (items.length === 0) return null;
  const title = category.name.trim() || fallbackTitle || category.slug.replace(/-/g, ' ');
  const moreHref = category.href;

  return (
    <section className="mt-6 bg-white sm:mt-8" dir="rtl" aria-labelledby={headingId}>
      <Container className="py-8 sm:py-10">
        {/* الترويسة — خطّ سفليّ أحمر (لون الموقع) + عنوان داكن */}
        <div className="mb-6 flex items-center justify-between gap-4 border-b-2 border-primary pb-3">
          <h2 id={headingId} className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            <Link href={moreHref} className="transition-colors hover:text-primary">
              {title}
            </Link>
          </h2>
          <Link
            href={moreHref}
            className="flex shrink-0 items-center gap-1 text-sm font-bold text-muted transition-colors hover:text-primary"
          >
            عرض الكل
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        </div>

        {/* صفّ الكُتّاب — 3 على الجوّال، 6 على سطح المكتب (صفّ واحد كالمرجع) */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 lg:grid-cols-6">
          {items.map((item) => (
            <WriterCard key={item.id} item={item} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function WriterCard({ item }: { item: FeedItem }) {
  // الصورة: غلاف المقال (متمايز) ثمّ صورة الكاتب احتياطاً.
  const photo = item.image ?? item.author?.avatar ?? null;
  const author = item.author;
  // اسم الكاتب يفتح بروفيله **فقط إن كان كاتباً مفعّلاً** (id + isWriter)؛ غير المفعّل/المدير ⇒ نصّ.
  const writerHref = author?.isWriter && author.id ? `/writer/${author.id}` : null;

  return (
    <div className="flex flex-col items-center text-center">
      {/* رابط المقال — يغطّي الصورة والعنوان فقط (ليس اسم الكاتب) */}
      <Link href={item.href} className="group block w-full">
        <div className="aspect-[4/5] w-full overflow-hidden bg-surface-2" style={{ borderRadius: '12px' }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
            <img
              src={photo}
              alt={item.imageAlt}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="size-full bg-surface-3" aria-hidden />
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-fg transition-colors group-hover:text-primary">
          {item.title}
        </h3>
      </Link>

      {/* اسم الكاتب — رابط بروفيل مستقلّ (كاتب مفعّل) أو نصّ (غيره) */}
      {author?.name &&
        (writerHref ? (
          <Link href={writerHref} className="mt-1 text-xs font-bold text-primary hover:underline">
            {author.name}
          </Link>
        ) : (
          <span className="mt-1 text-xs text-muted">{author.name}</span>
        ))}
    </div>
  );
}
