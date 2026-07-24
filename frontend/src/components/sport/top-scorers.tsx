'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ScorerCompetition } from '@/lib/sport/stats';

// ويدجت «الأهداف» — نمط 365 `entity-stats-widget`: ترويسة + تبويبات بطولات قابلة للتبديل + صفوف هدّافين
// (صورة اللاعب الدائريّة + الاسم + المركز·الفريق + عدد الأهداف). المصدر = 365 `web/stats` (إقليميّ).
// تبويبات بلا هدّافين مُستبعَدة خادميّاً (لا تبويب فارغ). هويّة الموقع: مربّع + RTL؛ الصور فقط `.avatar`.
export function TopScorers({ comps }: { comps: ScorerCompetition[] }) {
  const [active, setActive] = useState(0);
  if (!comps.length) return null;
  const i = Math.min(active, comps.length - 1);
  const cur = comps[i];

  return (
    <section dir="rtl" className="flex flex-col border border-border bg-surface" aria-labelledby="top-scorers-heading">
      <div className="border-b border-border px-4 py-2.5">
        <h2 id="top-scorers-heading" className="text-sm font-extrabold text-fg">
          الأهداف
        </h2>
      </div>

      {comps.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
          {comps.map((c, k) => (
            <button
              key={c.competitionId}
              type="button"
              onClick={() => setActive(k)}
              aria-current={k === i ? 'true' : undefined}
              className={
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[13px] font-bold transition-colors ' +
                (k === i ? 'bg-primary text-white' : 'text-muted hover:bg-surface-2 hover:text-fg')
              }
            >
              {c.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- شعار 365 من CDN
                <img src={c.logo} alt="" loading="lazy" className="avatar size-5 object-contain" />
              )}
              {c.competitionName}
            </button>
          ))}
        </div>
      )}

      <ul className="flex-1">
        {cur.scorers.map((s) => (
          <li key={s.id} className="border-b border-border last:border-b-0">
            <Link
              href={`/sport/player/${s.id}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
            >
              <span className="avatar size-10 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- صورة لاعب 365 من CDN
                  <img src={s.image} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-fg">{s.name}</div>
                {(s.position || s.team) && (
                  <div className="truncate text-xs text-muted">{[s.position, s.team].filter(Boolean).join(' · ')}</div>
                )}
              </div>
              <div className="shrink-0 text-center">
                <div className="text-lg font-extrabold tabular-nums text-fg">{s.goals}</div>
                <div className="text-[10px] text-muted">أهداف</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* عرض الكل → صفحة البطولة (تبويب الإحصائيات الكامل) للبطولة النشطة */}
      <Link
        href={`/sport/competition/${cur.competitionId}?tab=stats`}
        className="flex items-center justify-center gap-1 border-t border-border px-4 py-2.5 text-[13px] font-bold text-primary transition-colors hover:bg-surface-2"
      >
        عرض الكل
      </Link>
    </section>
  );
}
