import Link from 'next/link';

import { EngagementBar } from '@/components/engagement/engagement-bar';
import { Container } from '@/components/layout/container';
import { getArticleMetrics } from '@/lib/engagement';
import type { FeedItem } from '@/lib/feed';
import { formatRelativeTime } from '@/lib/format';
import type { EngagementMetrics } from '@/lib/use-engagement';

import { CategoryChip } from './featured-hero';

// كتلة «الأكثر شيوعا» (الأكثر قراءة): شبكة مرقّمة 01..09 بعرض كامل (3×3 على الشاشات الكبيرة).
// خلفية القسم ناعمة (bg-surface-2)، البطاقات بيضاء **بلا زوايا مدوّرة**، وتحتها شريط تفاعل
// (إعجاب/عدم إعجاب للزائر + مشاركة + حفظ يتطلّب تسجيل الدخول). العدّادات SSR من عقد التفاعل الموحّد.
export async function TrendingSection({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return null;
  const list = items.slice(0, 9);
  const metrics = await Promise.all(list.map((it) => getArticleMetrics(it.id)));

  return (
    <section
      className="mt-6 bg-surface-2 py-8 sm:mt-8 sm:py-10"
      aria-labelledby="trending-heading"
    >
      <Container>
        {/* ترويسة القسم: شارة حمراء عموديّة + العنوان + «المزيد» → /trending */}
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="h-7 w-1 shrink-0 bg-primary" style={{ borderRadius: '9999px' }} aria-hidden />
            <h2 id="trending-heading" className="font-heading text-xl font-extrabold text-fg sm:text-2xl">
              الأكثر شيوعا
            </h2>
          </div>
          <Link
            href="/trending"
            className="flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-primary"
          >
            <span>المزيد</span>
            <ChevronStart className="size-4" />
          </Link>
        </div>

        {/* الشبكة المرقّمة: 9 أخبار بعرض كامل (3×3 على الشاشات الكبيرة) */}
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((item, i) => (
            <li key={item.id} className="h-full">
              <TrendingCard item={item} rank={i + 1} metrics={metrics[i]} />
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

// كرت رائج (مربّع الزوايا): محتوى (رقم + قسم + تاريخ + عنوان) ثمّ شريط تفاعل بحدّ علويّ.
// رابط الخبر يغطّي صفّ المحتوى فقط (لا الشريط)؛ اسم القسم رابط مستقلّ فوقه (z-20).
function TrendingCard({
  item,
  rank,
  metrics,
}: {
  item: FeedItem;
  rank: number;
  metrics: EngagementMetrics;
}) {
  return (
    <div className="group flex h-full flex-col border border-border bg-surface transition hover:border-primary/30 hover:shadow-sm">
      <div className="relative flex flex-1 items-start gap-3 p-3">
        <Link href={item.href} className="absolute inset-0 z-10" aria-label={item.title} />

        <span
          className="shrink-0 font-heading text-[2rem] font-black leading-none text-muted opacity-40 tabular-nums sm:text-[2.5rem]"
          aria-hidden
        >
          {String(rank).padStart(2, '0')}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-start">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryChip name={item.category} href={item.categoryHref} />
            {item.publishedAt && (
              <time dateTime={item.publishedAt} className="text-caption font-medium text-muted">
                {formatRelativeTime(item.publishedAt)}
              </time>
            )}
          </div>
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-fg underline-offset-2 transition-colors group-hover:text-primary group-hover:underline group-has-[:focus-visible]:underline sm:text-[15px]">
            {item.title}
          </h3>
        </div>
      </div>

      <EngagementBar
        type="article"
        id={item.id}
        href={item.href}
        title={item.title}
        initialMetrics={metrics}
        reactionStyle="thumbs"
        className="mt-auto border-t border-border px-3 py-1.5"
      />
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
