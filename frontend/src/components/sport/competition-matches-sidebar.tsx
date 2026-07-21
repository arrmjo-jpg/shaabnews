'use client';

import { useState } from 'react';
import { MatchRow } from '@/components/sport/match-row';
import type { MatchGroupSummary } from '@/lib/sport/domain/entities';

// الشريط الجانبيّ لصفحة البطولة (نمط 365) — ٣ تبويبات: كل المباريات / نتائج / جدول المباريات. «كل المباريات»
// يبدأ بأقسام معنونة: مباريات اليوم ← جدول المباريات ← النتائج الأخيرة (ترتيب 365). كلّ مباراة مُجمَّعة
// بالمجموعة+الجولة بعنوان وتاريخ، وكلّ صفّ MatchRow رابط لصفحة المباراة. مربوط ببطولة الصفحة الحاليّة.
const TABS = [
  { id: 'all', label: 'كل المباريات' },
  { id: 'results', label: 'نتائج' },
  { id: 'fixtures', label: 'جدول المباريات' },
] as const;

interface Section {
  title: string | null;
  groups: MatchGroupSummary[];
}

export function CompetitionMatchesSidebar({
  today,
  upcoming,
  recent,
  fixtures,
  results,
}: {
  today: MatchGroupSummary[];
  upcoming: MatchGroupSummary[];
  recent: MatchGroupSummary[];
  fixtures: MatchGroupSummary[];
  results: MatchGroupSummary[];
}) {
  const [tab, setTab] = useState<string>('all');

  const sections: Section[] =
    tab === 'results'
      ? [{ title: null, groups: results }]
      : tab === 'fixtures'
        ? [{ title: null, groups: fixtures }]
        : (
            [
              { title: 'مباريات اليوم', groups: today },
              { title: 'جدول المباريات', groups: upcoming },
              { title: 'النتائج الأخيرة', groups: recent },
            ] as Section[]
          ).filter((s) => s.groups.length > 0);

  const empty = sections.every((s) => s.groups.length === 0);

  return (
    <section dir="rtl" className="border border-border bg-white">
      <div className="flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'true' : undefined}
            className={
              'flex-1 border-b-2 px-2 py-2.5 text-center text-xs font-bold transition-colors ' +
              (tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-fg')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="p-6 text-center text-xs text-muted">لا مباريات متاحة.</div>
      ) : (
        <div className="max-h-[78vh] overflow-y-auto">
          {sections.map((s, si) => (
            <div key={s.title ?? `s-${si}`}>
              {s.title && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="h-px flex-1 bg-border" aria-hidden />
                  <span className="text-xs font-extrabold text-fg">{s.title}</span>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                </div>
              )}
              {s.groups.map((g, gi) => (
                <div key={`${g.label}-${gi}`}>
                  <div className="flex items-center justify-between gap-2 border-y border-border bg-surface-2 px-3 py-1.5">
                    <span className="truncate text-[11px] font-bold text-muted">{g.label}</span>
                    {g.date && <span className="shrink-0 text-[10px] text-muted">{formatDay(g.date)}</span>}
                  </div>
                  {g.matches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      timeZone: 'Asia/Amman',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}
