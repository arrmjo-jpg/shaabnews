import { ChevronLeft, Clock } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { getCategoryById, getCategoryFeed, type FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

// قسم «حوادث» — شريط بطاقات بأسلوب «خبر وصورة»: صورة 16:9 + بطاقة بيضاء عائمة متراكبة على أسفل
// الصورة (ظلّ ناعم يرفعها) تحوي العنوان + كِكَر القسم الأحمر + التاريخ + سهم «للأمام». **التصنيف بالـID
// الثابت** (مقاوم لإعادة تسمية الإدارة) ⇒ الـslug/الاسم الحاليّان. سطح المكتب: شبكة 4 أعمدة (٨ بطاقات،
// صفّان)؛ الجوّال: كروسل CSS scroll-snap (سحب باللمس، بلا JS — اتّساقاً مع بقيّة أقسام الهوم الخادميّة).
// Server Component، ISR 300s، خطّ الموقع، تصميم مربّع، `text-primary`. لا مقالات ⇒ يُخفى (عزل فشل، لا تلفيق).
export async function IncidentsSection({
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
  const items = await getCategoryFeed(category.slug, 8);
  if (items.length === 0) return null;
  const title = category.name.trim() || fallbackTitle || category.slug.replace(/-/g, ' ');
  const moreHref = category.href;

  return (
    <section className="mt-6 bg-white sm:mt-8" dir="rtl" aria-labelledby={headingId}>
      <Container className="py-8 sm:py-10">
        {/* الترويسة — شريط أحمر + عنوان + «عرض الكل» (متّسقة مع بقيّة أقسام الهوم) */}
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

        {/* الجوّال: كروسل أفقي بـscroll-snap (سحب لمسيّ بلا JS)؛ pb يتّسع لظلّ البطاقة العائمة */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 sm:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <div key={item.id} className="w-[72%] shrink-0 snap-start">
              <IncidentCard item={item} />
            </div>
          ))}
        </div>

        {/* سطح المكتب: شبكة بطاقات — عمودان ثمّ ٤ أعمدة (صفّان) */}
        <div className="hidden gap-x-6 gap-y-9 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <IncidentCard key={item.id} item={item} />
          ))}
        </div>
      </Container>
    </section>
  );
}

// بطاقة حادثة — صورة 16:9 + بطاقة بيضاء عائمة متراكبة (-mt) بظلّ ناعم يرفعها فوق الصورة. رابط متراكب
// يغطّي البطاقة كلّها؛ كِكَر القسم رابط مستقلّ (z-20). السهم على اليسار = «للأمام» في RTL (zauto، زخرفيّ).
function IncidentCard({ item }: { item: FeedItem }) {
  return (
    <article className="group relative flex flex-col">
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

      {/* البطاقة العائمة — relative + -mt تتراكب على أسفل الصورة (zauto: تُرسَم فوق الصورة بترتيب DOM،
          وتحت الرابط المتراكب z-10 لتُنقَر كاملةً؛ بلا z-index صريح كي لا تحبس z-20 الكِكَر) */}
      <div className="relative -mt-9 mx-4 bg-white px-4 py-3 shadow-[0_8px_22px_rgba(2,6,23,0.08)]">
        <h3 className="line-clamp-3 min-h-[60px] pe-8 text-sm font-bold leading-snug text-fg transition-colors group-hover:text-primary">
          {item.title}
        </h3>
        <div className="mt-1">
          <IncidentCategory item={item} />
        </div>
        {item.publishedAt && (
          <span className="mt-1 flex items-center gap-1 text-xs text-muted">
            <Clock className="size-3 shrink-0" aria-hidden />
            <time dateTime={item.publishedAt}>{formatRelativeTime(item.publishedAt)}</time>
          </span>
        )}
        <ChevronLeft
          className="absolute end-3 top-1/2 size-6 -translate-y-1/2 text-muted transition-colors group-hover:text-primary"
          aria-hidden
        />
      </div>
    </article>
  );
}

// كِكَر القسم (أحمر) — رابط مستقلّ فوق الرابط المتراكب (z-20).
function IncidentCategory({ item }: { item: FeedItem }) {
  if (!item.category) return null;
  const cls = 'text-xs font-extrabold text-primary';
  return item.categoryHref ? (
    <Link href={item.categoryHref} className={`relative z-20 ${cls} hover:underline`}>
      {item.category}
    </Link>
  ) : (
    <span className={cls}>{item.category}</span>
  );
}
