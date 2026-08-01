import Link from 'next/link';

import { TodayMatches } from '@/components/home/today-matches';
import { Container } from '@/components/layout/container';
import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';
import { todayAmman } from '@/lib/sport/day';
import { getSportsHomeBarDays } from '@/lib/sports-home-bar';

// قسم «الرياضة» — تخطيط ثلاثيّ الأعمدة (مرجع المستخدم): مقال مميّز كبير (يمين، صورة 16:9 + عنوان + ملخّص)
// + قائمة مصغّرات (وسط، **العنوان يمين/الصورة يسار** كالمرجع، عكس editorial) + **عمود ثالث «الدوريات
// العربية»** — بطولات مختارة يدويًّا من لوحة الإدارة (Sports Home Bar، مستقلّة تمامًا عن شريط
// المباريات العام) بدل الفلتر الثابت السابق على اسم دولة البطولة (طلب المستخدم 2026-07-20).
// **التصنيف بالـID الثابت** ⇒ slug/اسم حاليّان. Server Component، ISR 300s، خطّ الموقع، تصميم مربّع،
// `text-primary` (المرجع أزرق؛ اعتُمد أحمر الموقع للاتّساق مع الأقسام). لا مقالات ⇒ يُخفى (عزل فشل، لا تلفيق).
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
  // مباريات الدوريات العربية لأربعة أيّام (أمس/اليوم/غداً/بعد غد) — جلب واحد فقط من Sports Home Bar
  // (مُكاش 60s عبر tag 'sports-home-bar')، تقسيم/تجميع محليّ داخل getSportsHomeBarDays، تبدّلها
  // تبويبات client بلا BFF. عزل فشل: [] ⇒ «لا مباريات».
  const today = todayAmman();
  const [items, matchDays] = await Promise.all([getCategoryFeed(category.slug, 5), getSportsHomeBarDays(today)]);
  if (items.length === 0) return null;
  const title = category.name.trim() || fallbackTitle || category.slug.replace(/-/g, ' ');
  const moreHref = category.href;

  const feature = items[0];
  const list = items.slice(1, 5);

  return (
    <div className="homepage-feed-container mt-6 sm:mt-8" dir="rtl">
      <Container>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* العمود الأول: قسم الرياضة بالخلفية العريضة */}
          <div className="lg:col-span-9">
            <section
              className="card-collection-flat card-collection-flat--with-image branded-collection-card"
              aria-labelledby={headingId}
            >
              {/* صورة الخلفية والعنوان المتراكب */}
              <div className="card-collection-flat__background-image">
                <div className="responsive-image responsive-image--disableIntrinsicHeight relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم */}
                  <img
                    className="card-collection-flat__image object-cover"
                    loading="lazy"
                    src="/FC26-Branding-4-1780989337.webp"
                    alt={title}
                    aria-hidden="true"
                  />
                </div>
                <Link className="card-collection-flat__title-link" href={moreHref}>
                  <h2 id={headingId} className="card-collection-flat__title-header card-collection-flat__title">
                    <span className="card-collection-flat__title-wrapper">{title}</span>
                  </h2>
                </Link>
              </div>

              {/* شبكة المقالات: المقال الترويجي الكبير + 4 مقالات مصغرة */}
              <div className="ccf-container ccf-container--section-top-grid">
                <ul className="featured-articles-list">
                  {/* المقال المميز الرئيسي */}
                  {feature && (
                    <li className="featured-articles-list__item">
                      <article className="gc u-clickable-card gc--type-post gc--with-image group">
                        <div className="gc__content flex flex-col justify-between">
                          <div>
                            {/* تصنيف المقال كتاج ملون */}
                            <div className="mb-1.5 flex">
                              <span className="bg-gradient-to-r from-[#c8102e] via-[#1a365d] to-[#00a859] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide rounded-[3px]">
                                {feature.category || title}
                              </span>
                            </div>
                            <h3 className="gc__title font-extrabold text-fg transition-colors group-hover:text-primary">
                              <Link href={feature.href} className="u-clickable-card__link">
                                {feature.title}
                              </Link>
                            </h3>
                            {feature.excerpt && (
                              <div className="gc__body-wrap">
                                <p className="gc__excerpt line-clamp-3">{feature.excerpt}</p>
                              </div>
                            )}
                          </div>
                          <footer className="gc__footer mt-3">
                            <div className="gc__meta text-muted text-xs">
                              <div className="gc__date gc__date--published">
                                <div className="gc__date__date">
                                  <div className="date-simple">
                                    <span className="screen-reader-text">نشر في {formatSimpleDate(feature.publishedAt)}</span>
                                    <span aria-hidden="true">{formatSimpleDate(feature.publishedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </footer>
                        </div>
                        {/* .gc إذا كان flex-direction:column-reverse (تأكّدت عبر DevTools) — ترتيب DOM
                            معكوس بصريًّا، فالعلامة توضع هنا (قبل الصورة بترتيب DOM) لتظهر بعدها بصريًّا.
                            sports-feature-marker: تصحيح فجوة flex gap:12px على .gc — راجع globals.css. */}
                        <div className="featured-accent-marker sports-feature-marker" aria-hidden />
                        <div className="gc__image-wrap u-clickable-card__exclude relative overflow-hidden">
                          <Link href={feature.href} className="u-clickable-card__link block size-full" tabIndex={-1}>
                            <div className="article-card__image-wrap article-card__featured-image size-full" tabIndex={-1}>
                              <div className="responsive-image size-full">
                                {feature.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
                                  <img
                                    className="article-card__image gc__image size-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    loading="eager"
                                    src={feature.image}
                                    alt={feature.imageAlt || feature.title}
                                  />
                                ) : (
                                  <div className="size-full bg-surface-3" />
                                )}
                              </div>
                            </div>
                          </Link>
                        </div>
                      </article>
                    </li>
                  )}

                  {/* المقالات المصغرة الأربعة */}
                  {list.map((item) => (
                    <li key={item.id} className="featured-articles-list__item">
                      <article className="gc u-clickable-card gc--type-post gc--with-image group">
                        <div className="gc__content flex flex-col justify-between">
                          <div>
                            {/* تصنيف المقال كتاج ملون */}
                            <div className="mb-1.5 flex">
                              <span className="bg-gradient-to-r from-[#c8102e] via-[#1a365d] to-[#00a859] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide rounded-[3px]">
                                {item.category || title}
                              </span>
                            </div>
                            <h3 className="gc__title font-bold text-fg transition-colors group-hover:text-primary">
                              <Link href={item.href} className="u-clickable-card__link">
                                {item.title}
                              </Link>
                            </h3>
                          </div>
                          <footer className="gc__footer mt-2">
                            <div className="gc__meta text-muted text-xs">
                              <div className="gc__date gc__date--published">
                                <div className="gc__date__date">
                                  <div className="date-simple">
                                    <span className="screen-reader-text">نشر في {formatSimpleDate(item.publishedAt)}</span>
                                    <span aria-hidden="true">{formatSimpleDate(item.publishedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </footer>
                        </div>
                        <div className="gc__image-wrap u-clickable-card__exclude relative overflow-hidden">
                          <Link href={item.href} className="u-clickable-card__link block size-full" tabIndex={-1}>
                            <div className="article-card__image-wrap article-card__featured-image size-full" tabIndex={-1}>
                              <div className="responsive-image size-full">
                                {item.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
                                  <img
                                    className="article-card__image gc__image size-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    loading="lazy"
                                    src={item.image}
                                    alt={item.imageAlt || item.title}
                                  />
                                ) : (
                                  <div className="size-full bg-surface-3" />
                                )}
                              </div>
                            </div>
                          </Link>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </div>

              {/* فوتر البطاقة لرابط المزيد */}
              <footer className="card-collection-flat__footer">
                <Link
                  className="card-collection-flat__more-link text-primary transition-colors hover:text-fg"
                  aria-label={`المزيد - ${title}`}
                  href={moreHref}
                >
                  المزيد
                </Link>
              </footer>
            </section>
          </div>

          {/* العمود الثاني: جدول الرياضة (مباريات الدوريات العربية) */}
          <aside className="lg:relative lg:col-span-3" aria-label="مباريات الدوريات العربية">
            <TodayMatches days={matchDays} initial={1} />
          </aside>
        </div>
      </Container>
    </div>
  );
}

function formatSimpleDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

