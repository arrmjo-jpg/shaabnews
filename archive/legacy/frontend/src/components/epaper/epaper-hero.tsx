import Link from 'next/link';
import { Download } from 'lucide-react';

import type { EpaperIssue } from '@/lib/epaper';

// هيرو «عدد اليوم» — التاريخ كطقس + رقم العدد + العنوان + ملخّص + فعلان.
// لا غلاف في المصدر بعد ⇒ بديل طباعيّ صادق (مُركَّب من بيانات العدد، لا صورة مُلفَّقة).
function formatArabicDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  } catch {
    return date;
  }
}

export function EpaperHero({ issue }: { issue: EpaperIssue }) {
  const dateLabel = formatArabicDate(issue.publicationDate);

  return (
    <section className="grid gap-6 sm:grid-cols-[minmax(0,300px)_1fr] sm:gap-8" dir="rtl">
      {/* بديل الغلاف الطباعيّ (نسبة A-series) — يُستبدَل بالغلاف الحقيقيّ لاحقاً */}
      <div className="relative flex aspect-[1/1.414] w-full flex-col justify-between border border-border bg-surface-2 p-5">
        {issue.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- غلاف العدد (LCP: تحميل فوريّ عالي الأولويّة)
          <img
            src={issue.cover}
            alt={issue.title}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">عدد #{issue.issueNumber}</span>
            <span className="text-2xl font-black leading-snug text-fg">{issue.title}</span>
            <span className="text-xs font-medium text-muted">{dateLabel ?? ''}</span>
          </>
        )}
      </div>

      {/* الميتا + الأفعال */}
      <div className="flex flex-col justify-center">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-muted">
          {dateLabel ? <span>{dateLabel}</span> : null}
          <span aria-hidden>·</span>
          <span>عدد #{issue.issueNumber}</span>
          {issue.pageCount ? (
            <>
              <span aria-hidden>·</span>
              <span>{issue.pageCount} صفحة</span>
            </>
          ) : null}
        </div>

        <h2 className="mt-2 text-2xl font-black leading-tight text-fg sm:text-3xl">{issue.title}</h2>
        {issue.subtitle ? <p className="mt-1 text-lg font-bold text-fg/80">{issue.subtitle}</p> : null}
        {issue.summary ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{issue.summary}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={issue.readHref}
            className="inline-flex items-center justify-center bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            ابدأ القراءة
          </Link>
          {issue.downloadUrl ? (
            <a
              href={issue.downloadUrl}
              className="inline-flex items-center gap-2 border border-border px-5 py-2.5 text-sm font-bold text-fg transition hover:bg-surface-2"
            >
              <Download className="size-4" aria-hidden />
              تحميل العدد
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
