import Link from 'next/link';
import type { TopPerformerCategory, TopPerformerPlayer } from '@/lib/sport/domain/entities';

// «أهم اللاعبين» (نمط 365 top-performers) — فئات (الهجوم/الوسط/الدفاع)، لكلّ فئة لاعب المضيف (يمين) ولاعب الضيف
// (يسار) مع إحصاءاتهما المتقابلة. كلّ لاعب رابطٌ لملفّه. بيانات حقيقيّة من `game.topPerformers` (لا تلفيق).
export function MatchTopPerformers({ categories }: { categories: TopPerformerCategory[] }) {
  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-extrabold text-fg">أهم اللاعبين</h2>
      </div>
      <div className="divide-y divide-border">
        {categories.map((c) => (
          <Category key={c.name} c={c} />
        ))}
      </div>
    </section>
  );
}

function Category({ c }: { c: TopPerformerCategory }) {
  const base = c.home?.stats.length ? c.home.stats : (c.away?.stats ?? []);
  return (
    <div className="px-4 py-3">
      <div className="mb-3 text-center text-[11px] font-bold text-muted">{c.name}</div>
      <div className="mb-3 flex items-start justify-between gap-2">
        <PlayerHead p={c.home} align="end" />
        <PlayerHead p={c.away} align="start" />
      </div>
      {base.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {base.map((s, i) => (
            <li key={i} className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2">
              <span className="text-center text-[13px] font-bold tabular-nums text-fg">{c.home?.stats[i]?.value ?? '-'}</span>
              <span className="text-center text-[11px] leading-tight text-muted">{s.name}</span>
              <span className="text-center text-[13px] font-bold tabular-nums text-fg">{c.away?.stats[i]?.value ?? '-'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerHead({ p, align }: { p: TopPerformerPlayer | null; align: 'start' | 'end' }) {
  if (!p) return <div className="min-w-0 flex-1" />;
  const dir = align === 'end' ? 'flex-row-reverse text-end' : 'text-start';
  return (
    <Link href={`/sport/player/${p.id}`} className={`flex min-w-0 flex-1 items-center gap-2 ${dir}`}>
      <span className="avatar size-10 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- صورة لاعب 365 من CDN
          <img src={p.photo} alt="" loading="lazy" className="size-full object-cover" />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold text-fg">{p.name || '—'}</span>
        {p.position && <span className="block truncate text-[10px] text-muted">{p.position}</span>}
      </span>
    </Link>
  );
}
