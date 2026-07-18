import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { TodayMatches, type MatchDay } from '@/components/home/today-matches';
import { Container } from '@/components/layout/container';
import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';
import { shiftYmd, todayAmman } from '@/lib/sport/day';
import { getArabMatchesByCompetition } from '@/lib/sport/games';

// قسم «الرياضة» — تخطيط ثلاثيّ الأعمدة (مرجع المستخدم): مقال مميّز كبير (يمين، صورة 16:9 + عنوان + ملخّص)
// + قائمة مصغّرات (وسط، **العنوان يمين/الصورة يسار** كالمرجع، عكس editorial) + **عمود ثالث محجوز
// «مباريات اليوم»** (placeholder، يُستبدَل لاحقاً بودجت 365scores — انظر sport-engine memory). **التصنيف
// بالـID الثابت** ⇒ slug/اسم حاليّان. Server Component، ISR 300s، خطّ الموقع، تصميم مربّع، `text-primary`
// (المرجع أزرق؛ اعتُمد أحمر الموقع للاتّساق مع الأقسام). لا مقالات ⇒ يُخفى (عزل فشل، لا تلفيق).
export async function SportsSection({
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

  // قائمة المقالات وأيّام المباريات مستقلّتان ⇒ جلب متوازٍ (لا تتابع category→feed→matches) لتقليل زمن القسم.
  // مباريات الدوريات العربية لأربعة أيّام (أمس/اليوم/غداً/بعد غد) — جلب خادميّ مسبق (مُكاش 60s عبر
  // unstable_cache داخل getArabMatchesByCompetition)، تبدّلها تبويبات client بلا BFF. عزل فشل: [] ⇒ «لا مباريات».
  const today = todayAmman();
  const [items, matchDays] = await Promise.all([
    getCategoryFeed(category.slug, 5),
    Promise.all(
      (
        [
          [-1, 'أمس'],
          [0, 'اليوم'],
          [1, 'غداً'],
          [2, 'بعد غد'],
        ] as const
      ).map(async ([offset, label]): Promise<MatchDay> => {
        const date = shiftYmd(today, offset);
        return { key: date, label, groups: await getArabMatchesByCompetition(date) };
      }),
    ),
  ]);
  if (items.length === 0) return null;
  const title = category.name.trim() || fallbackTitle || category.slug.replace(/-/g, ' ');
  const moreHref = category.href;

  const feature = items[0];
  const list = items.slice(1, 5);

  return (
    <section className="mt-6 bg-white sm:mt-8" dir="rtl" aria-labelledby={headingId}>
      <Container className="py-8 sm:py-10">
        {/* الترويسة — متّسقة مع بقيّة أقسام الهوم (شريط أحمر + عرض الكل) */}
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

        {/* تخطيط ثلاثيّ: مميّز (يمين 5/12) + قائمة (وسط 4/12) + «مباريات اليوم» (يسار 3/12 — محجوز) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* العمود 1: المقال المميّز — صورة + عنوان + ملخّص (رابط متراكب) */}
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
              <h3 className="mt-4 text-lg font-extrabold leading-snug text-fg transition-colors group-hover:text-primary sm:text-xl">
                {feature.title}
              </h3>
              {feature.excerpt && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{feature.excerpt}</p>
              )}
            </article>
          )}

          {/* العمود 2: قائمة مصغّرات — العنوان يمين، الصورة يسار (مطابق المرجع) */}
          <div className="lg:col-span-4">
            <ul className="divide-y divide-border">
              {list.map((item) => (
                <SportsListItem key={item.id} item={item} />
              ))}
            </ul>
          </div>

          {/* العمود 3: «الدوريات العربية» — مباريات 365Scores، تبويبات أمس/اليوم/غداً/بعد غد (تبديل لحظيّ).
              lg:relative ⇒ حاوية الصندوق المطلق؛ العمود يتمدّد لارتفاع الصفّ (= القسم) والصندوق يملؤه. */}
          <aside className="lg:relative lg:col-span-3" aria-label="مباريات الدوريات العربية">
            <TodayMatches days={matchDays} initial={1} />
          </aside>
        </div>
      </Container>
    </section>
  );
}

// عنصر قائمة رياضة — العنوان أوّلاً (⇒ يمين في RTL) ثمّ الصورة المصغّرة (⇒ يسار)، مطابقاً للمرجع. رابط متراكب يغطّي الصفّ.
function SportsListItem({ item }: { item: FeedItem }) {
  return (
    <li className="group relative py-3 first:pt-0 last:pb-0">
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />
      <div className="flex items-center gap-3">
        <h4 className="line-clamp-2 flex-1 text-sm font-bold leading-6 text-fg transition-colors group-hover:text-primary">
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
