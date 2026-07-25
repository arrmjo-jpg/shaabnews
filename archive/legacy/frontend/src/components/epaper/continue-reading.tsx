'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { EpaperIssue } from '@/lib/epaper';

import { ProgressState } from './progress-state';

// «تابع القراءة» — يظهر فقط إن كان المستخدم قد بدأ هذا العدد. يقرأ تقدّم القارئ القائم من
// نفس مفتاح التخزين المحليّ (epaper:state:{id} ⇒ { lastPage }) — صفر مصدر جديد، لا تلفيق.
export function ContinueReading({ issue }: { issue: EpaperIssue }) {
  const [lastPage, setLastPage] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`epaper:state:${issue.id}`);
      if (!raw) return;
      const data = JSON.parse(raw) as { lastPage?: unknown };
      const p = Number(data.lastPage);
      if (Number.isFinite(p) && p > 1) setLastPage(p);
    } catch {
      /* تخزين غير متاح — لا نعرض شيئاً */
    }
  }, [issue.id]);

  if (lastPage === null) return null;

  return (
    <section className="mt-6 border border-border bg-surface-2 p-4 sm:p-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-fg">تابع القراءة</p>
          <p className="text-xs text-muted">توقّفت عند الصفحة {lastPage}</p>
        </div>
        <Link
          href={`${issue.readHref}/p/${lastPage}`}
          className="inline-flex items-center justify-center bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
        >
          متابعة
        </Link>
      </div>
      <ProgressState value={lastPage} total={issue.pageCount} showLabel={false} className="mt-3" />
    </section>
  );
}
