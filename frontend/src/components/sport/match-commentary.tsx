'use client';

import { ArrowDownUp } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { FootballIcon } from '@/components/sport/sport-icons';
import type { CommentaryEntry, CommentaryEventType, CommentaryPlayerRef, CommentaryStageGroup } from '@/lib/sport/domain/entities';

// «مجريات» (نمط 365 matchEventsModule) — فلتر (عرض الكل/الأبرز) + أشواط (عنوان + نتيجة) + خطّ زمنيّ ثنائيّ الجانب
// (المضيف يمين، الضيف يسار، الدقيقة وسط). التبديل يُظهر اللاعب الداخل (عريض) والخارج (باهت). كلّ لاعب رابطٌ لملفّه.
// بيانات حقيقيّة من `game.events`/`stages` (لا تلفيق).
type Mode = 'all' | 'highlights';

export function MatchCommentary({ stages }: { stages: CommentaryStageGroup[] }) {
  const [mode, setMode] = useState<Mode>('all');
  const view = stages
    .map((s) => ({ ...s, events: mode === 'all' ? s.events : s.events.filter((e) => e.major) }))
    .filter((s) => s.events.length > 0);

  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-extrabold text-fg">مجريات</h2>
      </div>
      <div className="flex gap-2 border-b border-border px-4 py-2.5">
        <FilterBtn active={mode === 'all'} onClick={() => setMode('all')}>
          عرض الكل
        </FilterBtn>
        <FilterBtn active={mode === 'highlights'} onClick={() => setMode('highlights')}>
          الأبرز
        </FilterBtn>
      </div>

      {view.length === 0 ? (
        <p className="p-6 text-center text-xs text-muted">لا أحداث بارزة في هذه المباراة.</p>
      ) : (
        view.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-center gap-3 bg-surface-2 px-4 py-2 text-[11px] font-bold text-muted">
              <span>{s.name}</span>
              {s.homeScore != null && s.awayScore != null && (
                <span className="tabular-nums text-fg">
                  {s.homeScore} - {s.awayScore}
                </span>
              )}
            </div>
            <ul className="divide-y divide-border">
              {s.events.map((e, j) => (
                <EventRow key={j} e={e} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function EventRow({ e }: { e: CommentaryEntry }) {
  return (
    <li className="flex items-center px-3 py-2">
      <div className="flex min-w-0 flex-1 justify-end">{e.side === 'home' ? <Content e={e} side="home" /> : null}</div>
      <span className="w-12 shrink-0 text-center text-xs font-bold tabular-nums text-muted">{e.minute}&#39;</span>
      <div className="flex min-w-0 flex-1 justify-start">{e.side === 'away' ? <Content e={e} side="away" /> : null}</div>
    </li>
  );
}

function Content({ e, side }: { e: CommentaryEntry; side: 'home' | 'away' }) {
  const text = (
    <span className={'min-w-0 ' + (side === 'home' ? 'text-end' : 'text-start')}>
      <span className="block truncate text-[13px] font-bold text-fg">{e.player?.name ?? '—'}</span>
      {e.playerOut && <span className="block truncate text-[11px] text-muted">{e.playerOut.name}</span>}
    </span>
  );
  const inner = side === 'home' ? (
    <>
      <Avatar p={e.player} />
      {text}
    </>
  ) : (
    <>
      {text}
      <Avatar p={e.player} />
    </>
  );
  const main = e.player?.id ? (
    <Link href={`/sport/player/${e.player.id}`} className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80">
      {inner}
    </Link>
  ) : (
    <span className="flex min-w-0 items-center gap-2">{inner}</span>
  );
  return (
    <div className="flex min-w-0 items-center gap-2">
      {side === 'home' ? (
        <>
          {main}
          <EventIcon type={e.type} />
        </>
      ) : (
        <>
          <EventIcon type={e.type} />
          {main}
        </>
      )}
    </div>
  );
}

function Avatar({ p }: { p: CommentaryPlayerRef | null }) {
  return (
    <span className="avatar size-8 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
      {p?.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- صورة لاعب 365 من CDN
        <img src={p.photo} alt="" loading="lazy" className="size-full object-cover" />
      ) : null}
    </span>
  );
}

function EventIcon({ type }: { type: CommentaryEventType }) {
  if (type === 'goal') return <FootballIcon className="size-4 shrink-0 text-fg" />;
  if (type === 'yellow') return <span className="h-4 w-3 shrink-0 bg-yellow-400" aria-label="بطاقة صفراء" title="بطاقة صفراء" />;
  if (type === 'red') return <span className="h-4 w-3 shrink-0 bg-red-600" aria-label="بطاقة حمراء" title="بطاقة حمراء" />;
  if (type === 'sub') return <ArrowDownUp className="size-4 shrink-0 text-emerald-600" aria-label="تبديل" />;
  if (type === 'woodwork')
    return <span className="size-3.5 shrink-0 rounded-full border-2 border-muted" aria-label="إصابة القائم" title="إصابة القائم" />;
  return <span className="size-2 shrink-0 rounded-full bg-muted" aria-hidden />;
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'px-4 py-1.5 text-[13px] font-bold transition-colors ' +
        (active ? 'bg-primary text-white' : 'border border-border text-muted hover:text-fg')
      }
    >
      {children}
    </button>
  );
}
