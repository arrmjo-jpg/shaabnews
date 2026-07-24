'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import type { HeadToHead, HeadToHeadFormGame, HeadToHeadMeeting } from '@/lib/sport/domain/entities';

type Mode = 'all' | 'venue';

// «المواجهات المباشرة» (نمط 365 h2h) — فلتر مُجزَّأ (عرض الكل / على أرضه‑خارج أرضه) + ملخّص (فوز/تعادل/فوز)
// + مواجهات سابقة + أداء كلّ فريق (آخر مبارياته بـف/ت/خ). الفلتر «على أرضه/خارج أرضه» يُظهر فقط ما يطابق إعداد
// المباراة الحالية: المواجهات حيث كان المضيف الحاليّ صاحب الأرض، وأداء المضيف على أرضه + أداء الضيف خارج أرضه؛
// ويعيد حساب السجلّ. كلّ صفّ رابط لمباراته، وترويسة كلّ فريق رابط له. حالة صادقة عند الفراغ (كـ365).
export function MatchH2H({ data }: { data: HeadToHead }) {
  const [mode, setMode] = useState<Mode>('all');
  const homeId = data.homeTeam.id;

  const meetings = mode === 'all' ? data.meetings : data.meetings.filter((m) => m.homeId === homeId);
  const record = computeRecord(meetings, homeId);

  return (
    <div className="flex flex-col gap-6">
      {/* الفلتر (نمط 365): عرض الكل / على أرضه‑خارج أرضه */}
      <div dir="rtl" className="flex gap-2">
        <FilterBtn active={mode === 'all'} onClick={() => setMode('all')}>
          عرض الكل
        </FilterBtn>
        <FilterBtn active={mode === 'venue'} onClick={() => setMode('venue')}>
          على أرضه/خارج أرضه
        </FilterBtn>
      </div>

      <section dir="rtl" className="border border-border bg-surface">
        <div className="border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-extrabold text-fg">المواجهات المباشرة</h2>
        </div>

        {meetings.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
            <TeamCol id={data.homeTeam.id} name={data.homeTeam.name} logo={data.homeTeam.logo} />
            <div className="flex shrink-0 items-stretch gap-3 text-center">
              <Stat n={record.homeWins} label="انتصارات" />
              <span className="w-px bg-border" aria-hidden />
              <Stat n={record.draws} label="تعادلات" />
              <span className="w-px bg-border" aria-hidden />
              <Stat n={record.awayWins} label="انتصارات" />
            </div>
            <TeamCol id={data.awayTeam.id} name={data.awayTeam.name} logo={data.awayTeam.logo} />
          </div>
        )}

        <div className="bg-surface-2 px-4 py-2 text-xs font-extrabold text-fg">مواجهات سابقة</div>
        {meetings.length > 0 ? (
          <ul>
            {meetings.map((m) => (
              <MeetingRow key={m.id} m={m} />
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-xs text-muted">
            {mode === 'venue'
              ? 'لا مواجهات سابقة بهذا الترتيب (المضيف على أرضه).'
              : 'لا تتوفّر مواجهات سابقة بين هذين الفريقين.'}
          </p>
        )}
      </section>

      {data.forms.map((f) => {
        const isHomeForm = f.teamId === homeId;
        const games = (mode === 'all' ? f.games : f.games.filter((g) => g.wasHome === isHomeForm)).slice(0, 5);
        return (
          <section key={f.teamId} dir="rtl" className="border border-border bg-surface">
            <Link
              href={`/sport/team/${f.teamId}`}
              className="flex items-center gap-2 border-b border-border px-4 py-2.5 transition-colors hover:bg-surface-2"
            >
              {f.teamLogo && (
                // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
                <img src={f.teamLogo} alt="" loading="lazy" className="size-6 shrink-0 object-contain" />
              )}
              <h3 className="text-sm font-extrabold text-fg">أداء — {f.teamName}</h3>
            </Link>
            {games.length > 0 ? (
              <ul>
                {games.map((g) => (
                  <FormRow key={g.id} g={g} />
                ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-xs text-muted">
                {isHomeForm ? 'لا مباريات على أرضه في السجلّ الأخير.' : 'لا مباريات خارج أرضه في السجلّ الأخير.'}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

// السجلّ نسبةً للمضيف الحاليّ: نحدّد جانبه في كلّ مواجهة عبر `homeId` (لأنّ بعض المواجهات لعبها على أرض الخصم).
function computeRecord(meetings: HeadToHeadMeeting[], homeTeamId: number): { homeWins: number; draws: number; awayWins: number } {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  for (const m of meetings) {
    if (m.home.score == null || m.away.score == null) continue;
    const homeIsCurrentHome = m.homeId === homeTeamId;
    const hs = homeIsCurrentHome ? m.home.score : m.away.score; // نقاط المضيف الحاليّ
    const as = homeIsCurrentHome ? m.away.score : m.home.score; // نقاط الضيف الحاليّ
    if (hs > as) homeWins++;
    else if (hs < as) awayWins++;
    else draws++;
  }
  return { homeWins, draws, awayWins };
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'px-4 py-2 text-[13px] font-bold transition-colors ' +
        (active ? 'bg-primary text-white' : 'border border-border text-muted hover:text-fg')
      }
    >
      {children}
    </button>
  );
}

function TeamCol({ id, name, logo }: { id: number; name: string | null; logo: string | null }) {
  return (
    <Link href={`/sport/team/${id}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
        <img src={logo} alt="" loading="lazy" className="size-12 shrink-0 object-contain" />
      )}
      <span className="truncate text-[13px] font-bold text-fg">{name || '—'}</span>
    </Link>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex flex-col items-center justify-center">
      <span className="text-2xl font-extrabold tabular-nums text-fg">{n}</span>
      <span className="text-[10px] text-muted">{label}</span>
    </span>
  );
}

function MeetingRow({ m }: { m: HeadToHeadMeeting }) {
  return (
    <li>
      <Link
        href={`/sport/match/${m.id}`}
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-2"
      >
        <span className="truncate text-end text-[13px] font-bold text-fg">{m.home.name}</span>
        <span className="shrink-0 text-center text-[13px] font-extrabold tabular-nums text-fg">
          {m.home.score ?? '-'} - {m.away.score ?? '-'}
        </span>
        <span className="truncate text-start text-[13px] font-bold text-fg">{m.away.name}</span>
        <span className="col-span-3 text-center text-[11px] text-muted">
          {[m.competition, fmtDay(m.date)].filter(Boolean).join(' · ')}
        </span>
      </Link>
    </li>
  );
}

const FORM: Record<HeadToHeadFormGame['outcome'], { label: string; cls: string }> = {
  W: { label: 'ف', cls: 'bg-emerald-600' },
  D: { label: 'ت', cls: 'bg-zinc-400' },
  L: { label: 'خ', cls: 'bg-red-500' },
};

function FormRow({ g }: { g: HeadToHeadFormGame }) {
  const o = FORM[g.outcome];
  return (
    <li>
      <Link
        href={`/sport/match/${g.id}`}
        className="flex items-center gap-3 border-b border-border px-4 py-2 transition-colors last:border-b-0 hover:bg-surface-2"
      >
        <span className="w-12 shrink-0 text-[11px] tabular-nums text-muted">{fmtDay(g.date)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] text-muted">{g.competition}</span>
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-fg">
            <span className="min-w-0 flex-1 truncate text-end">{g.home.name}</span>
            <span className="shrink-0 tabular-nums">
              {g.home.score ?? '-'} - {g.away.score ?? '-'}
            </span>
            <span className="min-w-0 flex-1 truncate text-start">{g.away.name}</span>
          </span>
        </span>
        <span className={'flex size-6 shrink-0 items-center justify-center text-[11px] font-bold text-white ' + o.cls}>
          {o.label}
        </span>
      </Link>
    </li>
  );
}

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  const d = iso.slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0].slice(2)}` : '';
}
