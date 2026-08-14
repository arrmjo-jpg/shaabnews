import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { getAseTicker } from '@/lib/ase-market';
import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';
import { getLatestGold } from '@/lib/gold';
import { aseMarketStatus } from '@/lib/market';

import { AseMarketBar } from './ase-market-bar';
import { EconomyCard } from './economy-card';
import { GoldWidget } from './gold-widget';

// تصنيف الاقتصاد بالـ**ID الثابت** (الـslug قد يتغيّر بالإدارة فيكسر القسم — يُحلّ ID→slug حاليّ وقت التشغيل).
const ECONOMY_CATEGORY_ID = 2;

// قسم الاقتصاد (منصّة ماليّة فاخرة) — 3 طبقات: تيكر السوق + ترويسة (اقتصاد + حالة السوق) + شبكة
// (4 مقالات + ويدجت ذهب). ثيم أحمر عميق، RTL، خطّ الموقع (الجزيرة)، أيقونات Lucide. ISR 300s. صفر تلفيق.
export async function EconomySection() {
  const category = await getCategoryById(ECONOMY_CATEGORY_ID);
  const [gold, articles, aseTicker] = await Promise.all([
    getLatestGold(),
    category ? getCategoryFeed(category.slug, 4) : Promise.resolve<FeedItem[]>([]),
    getAseTicker(),
  ]);

  // لا مقالات اقتصاد ولا ذهب ⇒ أخفِ القسم كاملاً (عزل فشل، لا حشو).
  if (articles.length === 0 && !gold) return null;

  // رابط القسم من شجرة الأقسام الحقيقيّة لا مسارًا مثبَّتًا. كان /economy — وهي صفحة الهبوط
  // الاقتصاديّة، لا قسم «اقتصاد» (ID 2، slug 'اقتصاد-واعمال') الذي تُجلب منه مقالات هذه الشبكة
  // فعلًا في السطر أعلاه؛ فكان العنوان يقود إلى مكان غير القسم الذي يعنونه. category.href يبنيه
  // categoryHref من سلسلة الأسلاف (feed.ts:247) ⇒ /news/category/اقتصاد-واعمال، وهو نفس ما تعرضه
  // الإدارة. مطابق لنمط moreHref في بقيّة أقسام الرئيسية. قسم محذوف (null) ⇒ /economy بدل رابط مكسور.
  const moreHref = category?.href ?? '/economy';

  const market = aseMarketStatus();

  return (
    <section
      className="mt-6 text-white sm:mt-8"
      dir="rtl"
      aria-labelledby="economy-heading"
      style={{ backgroundColor: '#a30b13' }}
    >
      <Container className="py-8 sm:py-10">
        {/* شريط بورصة عمّان (ضمن حاوية الاقتصاد، أعلى القسم) — المصدر الرسميّ ticker_feeds */}
        <AseMarketBar items={aseTicker} />

        {/* الطبقة 2 — الترويسة */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="h-8 w-1.5 shrink-0 bg-white" style={{ borderRadius: '9999px' }} aria-hidden />
              <h2 id="economy-heading" className="font-heading text-3xl font-extrabold sm:text-4xl">
                <Link href={moreHref} className="transition-opacity hover:opacity-80">
                  اقتصاد
                </Link>
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ps-4 text-sm">
              <span className="flex items-center gap-1.5 font-bold">
                <span
                  className={`size-2 shrink-0 ${market.open ? 'animate-pulse bg-emerald-400' : 'bg-white/50'}`}
                  style={{ borderRadius: '9999px' }}
                  aria-hidden
                />
                {market.label}
              </span>
              <span className="text-white/30" aria-hidden>
                •
              </span>
              <span className="text-white/70">مؤشّر سوق عمّان المالي</span>
            </div>
          </div>

          <Link
            href={moreHref}
            className="flex w-fit items-center gap-1 border border-white/40 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
            style={{ borderRadius: '9999px' }}
          >
            عرض الكل
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        </div>

        {/* الطبقة 3 — الشبكة: 4 مقالات + ويدجت الذهب */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {articles.slice(0, 4).map((item) => (
            <EconomyCard key={item.id} item={item} />
          ))}
          {/* الموبايل: عرض كامل (col-span-2)؛ من md = خانة واحدة كبديل البطاقة الخامسة */}
          <GoldWidget gold={gold} className="col-span-2 md:col-span-1" />
        </div>
      </Container>
    </section>
  );
}
