import Link from 'next/link';

import { Container } from '@/components/layout/container';
import type { FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';

import { CategoryChip, FeedBadge } from './featured-hero';

// كتلة «آخر المستجدات» (أخبار is_header): كرت رئيسيّ بتراكب صورة + شبكة كروت بيضاء أفقيّة.
// نمط الرابط-المتراكب: رابط الخبر يغطّي الكرت؛ اسم القسم رابط مستقلّ فوقه (يفتح القسم لا الخبر).
export function LatestUpdates({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return null;

  const [lead, ...rest] = items;
  const grid = rest.slice(0, 8);

  return (
    <section className="mt-6 sm:mt-8" aria-labelledby="latest-updates-heading">
      <Container>
        {/* ترويسة القسم: شارة حمراء عموديّة + العنوان + «عرض الكل» → /latest */}
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span
              className="h-7 w-1 shrink-0 bg-primary"
              style={{ borderRadius: '9999px' }}
              aria-hidden
            />
            <h2
              id="latest-updates-heading"
              className="font-heading text-xl font-extrabold text-fg sm:text-2xl"
            >
              آخر المستجدات
            </h2>
          </div>
          <Link
            href="/latest"
            className="flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-primary"
          >
            <span>عرض الكل</span>
            <ChevronStart className="size-4" />
          </Link>
        </div>

        {/* كرت رئيسيّ + شبكة — ارتفاع ثابت متطابق على سطح المكتب (md) */}
        <div className="flex flex-col gap-4 md:h-[440px] md:flex-row md:gap-6">
          <div className="relative md:h-full md:w-[42%]">
            <LeadCard item={lead} />
            <div className="featured-accent-marker" aria-hidden />
          </div>
          {grid.length > 0 && (
            <ul className="grid flex-1 grid-cols-1 gap-2 md:h-full md:grid-cols-2 md:grid-rows-4 md:gap-3">
              {grid.map((item) => (
                <li key={item.id} className="md:h-full">
                  <ListCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}

// الكرت الرئيسيّ: صورة كبيرة + تدرّج + شارة (تغطية مباشرة/عاجل) + قسم حمراء + عنوان + تاريخ نسبيّ.
function LeadCard({ item }: { item: FeedItem }) {
  return (
    <div
      className="group relative block aspect-[16/10] transform-gpu overflow-hidden bg-surface-2 will-change-transform md:aspect-auto md:h-full"
      style={{ borderRadius: '12px' }}
    >
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم (لا next/image)
        <img
          src={item.image}
          alt={item.imageAlt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full transform-gpu object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <div className="absolute inset-0 size-full bg-surface-3" aria-hidden />
      )}

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
        aria-hidden
      />

      <FeedBadge badge={item.badge} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-start gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip name={item.category} href={item.categoryHref} />
          {item.publishedAt && (
            <time dateTime={item.publishedAt} className="text-caption font-medium text-white/85">
              {formatRelativeTime(item.publishedAt)}
            </time>
          )}
        </div>
        <h3 className="line-clamp-3 font-heading text-lg font-extrabold leading-tight text-white underline-offset-2 group-hover:underline group-has-[:focus-visible]:underline sm:text-xl">
          {item.title}
        </h3>
      </div>
    </div>
  );
}

// كرت القائمة: صورة مربّعة (بداية) + عنوان + اسم القسم بالأحمر (رابط مستقلّ) — كرت أبيض بحدّ.
function ListCard({ item }: { item: FeedItem }) {
  return (
    <div
      className="group relative flex h-full items-center gap-3 border border-border bg-surface p-2 transition hover:border-primary/30 hover:shadow-sm"
      style={{ borderRadius: '10px' }}
    >
      <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

      <div
        className="relative size-[84px] shrink-0 overflow-hidden bg-surface-2"
        style={{ borderRadius: '8px' }}
      >
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- <img> مقصود: حارس أداء الهوم
          <img
            src={item.image}
            alt={item.imageAlt}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full bg-surface-3" aria-hidden />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 text-start">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline sm:text-[15px]">
          {item.title}
        </h3>
        {item.category &&
          (item.categoryHref ? (
            <Link
              href={item.categoryHref}
              className="relative z-20 w-fit text-caption font-extrabold text-primary hover:underline"
            >
              {item.category}
            </Link>
          ) : (
            <span className="text-caption font-extrabold text-primary">{item.category}</span>
          ))}
      </div>
    </div>
  );
}

// شيفرون يشير لجهة القراءة-للأمام (يسار في RTL) — أيقونة مضمّنة (لا تبعيّة).
function ChevronStart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 19l-7-7 7-7" />
    </svg>
  );
}
