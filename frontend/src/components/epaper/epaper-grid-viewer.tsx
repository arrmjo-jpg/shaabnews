'use client';

import { Download, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { EpaperIssue } from '@/lib/epaper';

import { ShareControl } from './share-control';

// جدار الأعداد (أغلفة + مشاركة + تحميل) + بحث برقم/عنوان/تاريخ. نقر الغلاف ⇒ ينتقل إلى القارئ
// الأصليّ (pdf.js) في صفحة مخصّصة `/newspaper/{id}-{slug}` (لا تحميل مباشر، لا iframe). لا تلفيق.
function fmtDate(date: string | null): string {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(date));
  } catch {
    return date;
  }
}

const PAGE_SIZE = 12;

export function EpaperGridViewer({ issues }: { issues: EpaperIssue[] }) {
  const [q, setQ] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const t = q.trim();
  const filtered =
    t === ''
      ? issues
      : issues.filter(
          (i) =>
            i.title.includes(t) ||
            (i.subtitle ?? '').includes(t) ||
            String(i.issueNumber).includes(t) ||
            (i.publicationDate ?? '').includes(t),
        );
  // البحث يُعيد ضبط عدد العناصر المعروضة كي لا يبقى المستخدم عالقاً على صفحة
  // فرعية من نتائج بحث جديدة قد تكون أقصر من visibleCount السابق.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [t]);
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div dir="rtl">
      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث برقم العدد أو العنوان أو التاريخ…"
          aria-label="بحث الأعداد"
          className="h-11 w-full border border-border bg-surface ps-9 pe-3 text-fg outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-border bg-surface-2 px-6 py-16 text-center">
          <p className="text-sm text-muted">لا توجد أعداد مطابقة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((issue) => {
            const dateLabel = fmtDate(issue.publicationDate);
            return (
              <article key={issue.id} className="group flex flex-col">
                <Link
                  href={issue.readerHref}
                  aria-label={`افتح العدد ${issue.issueNumber}`}
                  className="relative flex aspect-[1/1.414] flex-col justify-between border border-border bg-surface-2 p-4 text-start transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-fg group-hover:shadow-lg motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                >
                  {issue.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- غلاف العدد (جدار: تحميل كسول)
                    <img src={issue.cover} alt={issue.title} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">عدد #{issue.issueNumber}</span>
                      <span className="line-clamp-4 text-base font-black leading-snug text-fg">{issue.title}</span>
                      <span className="text-[11px] font-medium text-muted">{dateLabel}</span>
                    </>
                  )}
                </Link>

                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="min-w-0 text-xs text-muted">
                    #{issue.issueNumber}
                    {dateLabel ? ` · ${dateLabel}` : ''}
                    {issue.pageCount ? ` · ${issue.pageCount} ص` : ''}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {issue.downloadUrl ? (
                      <a
                        href={issue.downloadUrl}
                        aria-label="تحميل العدد"
                        title="تحميل"
                        className="inline-flex size-9 items-center justify-center border border-border text-fg transition hover:bg-surface-2"
                      >
                        <Download className="size-4" aria-hidden />
                      </a>
                    ) : null}
                    <ShareControl title={issue.title} href={issue.readerHref} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="h-11 border border-border bg-surface px-6 text-sm font-bold text-fg transition-colors hover:bg-surface-2"
          >
            تحميل المزيد
          </button>
        </div>
      )}
    </div>
  );
}
