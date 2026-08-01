import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { getCategoryById, getCategoryFeed } from '@/lib/feed';

import { OpinionWritersCarousel } from './opinion-writers-carousel';

// قسم مقالات الرأي (بورتريه، أسفل نبض الشارع) — كاروسيل بطاقات: صورة + عنوان المقال + اسم الكاتب.
// **الـslug ديناميّ عبر prop** (لا ثابت داخل المكوّن). المصدر `getCategoryFeed(slug,12)` + العنوان من التصنيف.
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
  const items = await getCategoryFeed(category.slug, 12);
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

        <OpinionWritersCarousel items={items} />
      </Container>
    </section>
  );
}
