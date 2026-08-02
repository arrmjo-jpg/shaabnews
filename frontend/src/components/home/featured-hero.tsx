import Link from 'next/link';

import { Container } from '@/components/layout/container';
import type { FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

import { MobileHeroCarousel } from './mobile-hero-carousel';

// كتلة الهيرو (الأخبار المميّزة is_featured): كرت رئيسيّ كبير + شبكة 2×2 — خمس صور تبدو ملاصقة
// داخل كتلة واحدة بزوايا 15px مدوَّرة (الأربع الخارجية فقط، الحواف الداخلية بينها حادّة).
// **لا حاوية أمّ تقصّ (overflow:hidden) بعد الآن** — كانت موجودة على الصفّ الخارجي، لكنها تقصّ
// خطّ تمييز lead (نصفه المفروض يخرج خارج حدود الصورة، بلا أي سماحية ارتفاع لتفعل ذلك). البديل:
// كلّ كرت يحمل زوايا انحنائه الخاصّة بحسب موقعه الفعليّ في الشكل الجماعيّ (RTL: lead يمين، الشبكة
// يسار — auto-flow RTL يضع العنصر الأوّل أعلى-يمين، فأعلى-يسار، فأسفل-يمين، فأسفل-يسار)، فالمظهر
// النهائيّ مطابق تمامًا بكسل بكسل للسابق، لكن بلا قصّ. RSC · dir-aware · tokens · صور <img> لحارس
// أداء الهوم. نمط الرابط-المتراكب: رابط الخبر يغطّي الكرت؛ اسم القسم رابط مستقلّ فوقه.
// أصناف الزوايا معرَّفة بـglobals.css (.hero-corner-lead / .hero-corner-grid-1..3) — أسماء بلا
// "rounded" فيها عمدًا: قاعدة "Square design" العامّة تصفّر أيّ صنف يحتوي [class*='rounded']
// بـ!important، فصنف Tailwind القياسيّ (rounded-tl-[15px] مثلاً) كان سيُصفَّر رغم توليده الصحيح.
const GRID_CORNER_CLASSES = ['', 'hero-corner-grid-1', 'hero-corner-grid-2', 'hero-corner-grid-3'];

export function FeaturedHero({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return <FeaturedHeroEmpty />;

  const [lead, ...rest] = items;
  const grid = rest.slice(0, 4);

  return (
    <div className="py-6 sm:py-8">
      {/* الموبايل فقط: كاروسيل قابل للسحب بامتداد كامل الشاشة (بلا هوامش Container — عمدًا خارج
          الحاوية أدناه) — بطاقة واحدة كبيرة تعرض نفس الأخبار (lead + grid) كشرائح، بنمط
          خبرني.كوم/الجزيرة (تشغيل تلقائي + نقاط-تقدّم + أسهم + Ken Burns، بلا شبكة 2×2 ظاهرة على
          الموبايل إطلاقاً — راجع mobile-hero-carousel.tsx). سطح المكتب غير متأثر بتاتًا: التخطيط
          القديم أدناه (كرت رئيسي + شبكة) يبقى hidden لحد lg فقط، بلا أي تعديل على منطقه أو مظهره. */}
      <div className="lg:hidden">
        <MobileHeroCarousel items={items.slice(0, 5)} />
      </div>

      <Container className="hidden lg:block">
        <div className="flex transform-gpu flex-row will-change-transform">
          <div className="relative lg:w-1/2">
            <HeroCard item={lead} variant="lead" priority cornerClassName="hero-corner-lead" />
            <div className="featured-accent-marker" aria-hidden />
          </div>
          {grid.length > 0 && (
            <div className="grid grid-cols-2 lg:w-1/2">
              {grid.map((item, i) => (
                <HeroCard key={item.id} item={item} variant="grid" cornerClassName={GRID_CORNER_CLASSES[i]} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}

export function HeroCard({
  item,
  variant,
  priority = false,
  fixedHeight = true,
  cornerClassName = '',
}: {
  item: FeedItem;
  variant: 'lead' | 'grid';
  priority?: boolean;
  /** false ⇒ نسبة 16:9 ثابتة بكل العروض (يتناسب حجمها مع عرض أي حاوية) بدل الارتفاع الثابت
   * بالبكسل — مطلوب حين يكون عرض العمود متغيّرًا (مثل CategoryFeaturedGrid)، فالارتفاع الثابت
   * هناك يجعل الكرت يبدو ممطوطًا طوليًا إذا كان العمود أضيق ممّا صُمِّم له بالرئيسية. */
  fixedHeight?: boolean;
  /** زوايا الانحناء الخاصّة بموقع هذا الكرت في الشكل الجماعيّ — محسوبة في FeaturedHero
   * (لا حاوية أمّ تقصّ بعد الآن؛ كلّ كرت يحمل انحناءه بنفسه). فارغة = بلا انحناء (زاوية داخلية). */
  cornerClassName?: string;
}) {
  const isLead = variant === 'lead';

  return (
    // الجوّال: نسبة 16:9؛ سطح المكتب (fixedHeight): ارتفاع ثابت أطول (lead 400px، الصغير 200px).
    <div
      className={`hero-slider-item group relative block aspect-video transform-gpu overflow-hidden bg-surface-2 will-change-transform ${
        fixedHeight ? `lg:aspect-auto ${isLead ? 'lg:h-[400px]' : 'lg:h-[200px]'}` : ''
      } ${cornerClassName}`}
    >
      {/* رابط الخبر يغطّي الكرت كاملاً */}
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم (لا next/image)
        <img
          src={item.image}
          alt={item.imageAlt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="absolute inset-0 size-full transform-gpu object-fill transition-transform duration-700 ease-out will-change-transform [backface-visibility:hidden] group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <div className="absolute inset-0 size-full bg-surface-3" aria-hidden />
      )}

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
        aria-hidden
      />

      <FeedBadge badge={item.badge} />

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-start gap-1.5 sm:gap-2 ${
          isLead ? 'p-3 sm:p-4' : 'p-2 sm:p-3'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip name={item.category} href={item.categoryHref} />
          {item.publishedAt && (
            <time dateTime={item.publishedAt} className="text-caption font-medium text-white/85">
              {formatRelativeTime(item.publishedAt)}
            </time>
          )}
        </div>
        <h3
          className={`underline-offset-2 group-hover:underline group-has-[:focus-visible]:underline ${
            isLead
              ? 'line-clamp-3 font-heading text-base font-extrabold leading-tight text-white sm:text-lg'
              : 'line-clamp-2 font-heading text-sm font-extrabold leading-tight text-white'
          }`}
        >
          {item.title}
        </h3>
      </div>
    </div>
  );
}

// شارة عاجل/تغطية مباشرة (أعلى البداية) — من أعلام حقيقية فقط؛ لا تلتقط النقر (يمرّ لرابط الخبر).
export function FeedBadge({ badge }: { badge: FeedItem['badge'] }) {
  if (!badge) return null;
  return (
    <span className="pointer-events-none absolute start-2 top-2 z-20 inline-flex items-center gap-1.5 bg-primary px-2 py-1 text-caption font-bold text-primary-foreground">
      {badge.kind === 'live' && (
        <span className="avatar size-2 rounded-full bg-primary-foreground" aria-hidden />
      )}
      {badge.label}
    </span>
  );
}

// اسم القسم كشارة حمراء — رابط مستقلّ يفتح القسم (فوق رابط الخبر) إن توفّر slug.
export function CategoryChip({ name, href }: { name: string | null; href: string | null }) {
  if (!name) return null;
  const cls = 'bg-primary px-2 py-0.5 text-caption font-bold text-primary-foreground';
  if (href) {
    return (
      <Link href={href} className={`pointer-events-auto relative transition-colors hover:bg-primary/90 ${cls}`}>
        {name}
      </Link>
    );
  }
  return <span className={cls}>{name}</span>;
}

// حالة فارغة صادقة (عزل فشل الكتلة، لا تلفيق) — لا تُترك الصفحة فارغة.
function FeaturedHeroEmpty() {
  return (
    <Container className="py-6 sm:py-8">
      <div
        className="flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-surface-2 px-6 py-20 text-center"
        style={{ borderRadius: '15px' }}
      >
        <h2 className="font-heading text-h3 font-bold text-fg">لا توجد أخبار مميّزة بعد</h2>
        <p className="max-w-md text-sm text-muted">
          ستظهر هنا الأخبار المميّزة فور تفعيلها من لوحة التحرير.
        </p>
      </div>
    </Container>
  );
}
