import { ArrowLeftRight } from 'lucide-react';
import { FootballIcon } from '@/components/sport/sport-icons';
import type { MatchEvent, MatchEventType } from '@/lib/sport/games';

// أحداث المباراة (النظرة العامّة) — صفّ ثلاثيّ: حدث المضيف يمين | الدقيقة وسط | حدث الضيف يسار. أيقونة بحسب النوع.
export function MatchEvents({ events }: { events: MatchEvent[] }) {
  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border bg-surface-2 px-4 py-2">
        <h2 className="text-sm font-extrabold text-fg">أحداث المباراة</h2>
      </div>
      <ul className="divide-y divide-border">
        {events.map((e, i) => (
          <li key={i} className="flex items-center px-3 py-2">
            <div className="flex min-w-0 flex-1 justify-end">{e.side === 'home' ? <EventContent e={e} /> : null}</div>
            <span className="w-12 shrink-0 text-center text-xs font-bold tabular-nums text-muted">{e.minute}</span>
            <div className="flex min-w-0 flex-1 justify-start">{e.side === 'away' ? <EventContent e={e} /> : null}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EventContent({ e }: { e: MatchEvent }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <EventIcon type={e.type} />
      <span className="min-w-0 truncate text-[13px] font-medium text-fg">{e.player ?? '—'}</span>
    </div>
  );
}

function EventIcon({ type }: { type: MatchEventType }) {
  if (type === 'goal') return <FootballIcon className="size-4 shrink-0 text-fg" />;
  if (type === 'yellow') return <span className="h-4 w-3 shrink-0 bg-yellow-400" aria-label="بطاقة صفراء" />;
  if (type === 'red') return <span className="h-4 w-3 shrink-0 bg-red-600" aria-label="بطاقة حمراء" />;
  return <ArrowLeftRight className="size-4 shrink-0 text-emerald-600" aria-label="تبديل" />;
}
