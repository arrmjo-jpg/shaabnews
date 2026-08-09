'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

import type { EpaperIssue } from '@/lib/epaper';

import { MagazineWall } from './magazine-wall';

// بحث الأرشيف — ترشيح خفيف فوريّ على الأعداد المُحمَّلة (عنوان/رقم/تاريخ)، صفر باك إند.
// هذا هو نطاق البحث الوحيد المدعوم عمداً — لا بحث داخل نصّ الأعداد (أُزيل مع OCR).
export function ArchiveSearch({ issues }: { issues: EpaperIssue[] }) {
  const [q, setQ] = useState('');
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

  return (
    <div dir="rtl">
      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث برقم العدد أو العنوان أو التاريخ…"
          aria-label="بحث الأرشيف"
          className="h-11 w-full border border-border bg-surface ps-9 pe-3 text-fg outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>
      <MagazineWall issues={filtered} />
    </div>
  );
}
