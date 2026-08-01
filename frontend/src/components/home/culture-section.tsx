import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { WeatherCard } from '@/components/weather/weather-card';
import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';
import { getGovernorateWeather } from '@/lib/weather';

// قسم «ثقافة وفن» — نفس تخطيط الرياضة الثلاثيّ (مرجع المستخدم): مميّز كبير (يمين 5/12) + قائمة مصغّرات
// (وسط 4/12، العنوان يمين/الصورة يسار) + **العمود الثالث (يسار 3/12) = ودجت حالة الطقس** (بدل مباريات
// الرياضة). **التصنيف بالـID الثابت** ⇒ slug/اسم حاليّان. Server Component، ISR 300s، خطّ الموقع، تصميم
// مربّع، `text-primary`. لا مقالات ⇒ يُخفى (عزل فشل، لا تلفيق).
export async function CultureSection({
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
  const items = await getCategoryFeed(category.slug, 5);
  if (items.length === 0) return null;
  const title = category.name.trim() || fallbackTitle || category.slug.replace(/-/g, ' ');
  const moreHref = category.href;

  const feature = items[0];
  const list = items.slice(1, 5);

  // بيانات SSR أوّليّة لبطاقة الطقس المضغوطة (عمّان، **الحاليّ فقط** — التوقّع الأسبوعيّ غير مطلوب في الهوم).
  // العميل يحدّث لأقرب محافظة حسب الموقع. نداء واحد بدل اثنين (لا جلب توقّع لا يُعرَض).
  const cur = await getGovernorateWeather('amman');
  const initialWeather = cur ? { govId: cur.govId, city: cur.city, current: cur } : null;

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

        {/* تخطيط ثلاثيّ: مميّز (يمين 5/12) + قائمة (وسط 4/12) + حالة الطقس (يسار 3/12) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* العمود 1: المقال المميّز */}
          {feature && (
            <article className="group relative flex flex-col lg:col-span-5">
              <Link href={feature.href} className="absolute inset-0 z-10" aria-label={feature.title} />
              <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
                {feature.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
                  <img
                    src={feature.image}
                    alt={feature.imageAlt}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
                  />
                ) : (
                  <div className="size-full bg-surface-3" aria-hidden />
                )}
              </div>
              <div className="featured-accent-marker" aria-hidden />
              <h3 className="mt-4 text-lg font-extrabold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline sm:text-xl">
                {feature.title}
              </h3>
              {feature.excerpt && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{feature.excerpt}</p>
              )}
            </article>
          )}

          {/* العمود 2: قائمة مصغّرات — العنوان يمين، الصورة يسار */}
          <div className="lg:col-span-4">
            <ul className="divide-y divide-border">
              {list.map((item) => (
                <CultureListItem key={item.id} item={item} />
              ))}
            </ul>
          </div>

          {/* العمود 3: بطاقة حالة الطقس الملوّنة (تحديد موقع + تنقّل محافظات) */}
          <aside className="lg:col-span-3" aria-label="حالة الطقس">
            <WeatherCard initial={initialWeather} compact />
          </aside>
        </div>
      </Container>
    </section>
  );
}

// عنصر قائمة — العنوان أوّلاً (⇒ يمين RTL) ثمّ المصغّرة (⇒ يسار). رابط متراكب يغطّي الصفّ.
function CultureListItem({ item }: { item: FeedItem }) {
  return (
    <li className="group relative py-3 first:pt-0 last:pb-0">
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />
      <div className="flex items-center gap-3">
        <h4 className="line-clamp-2 flex-1 text-sm font-bold leading-6 text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline">
          {item.title}
        </h4>
        <div className="relative h-20 w-28 shrink-0 overflow-hidden bg-surface-2">
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
      </div>
    </li>
  );
}
