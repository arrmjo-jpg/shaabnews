import Link from 'next/link';
import { FollowButton } from '@/components/sport/follow-button';
import { MatchRow } from '@/components/sport/match-row';
import { getMatchesByCompetition, type CompetitionGroup } from '@/lib/sport/games';

// Block: مباريات اليوم — فلتر **مباشر/حسب التوقيت** (نمط 365) + تجميع بالبطولة (ترويسة شعار+اسم+دولة) + صفوف.
// «مباشر» = المباريات الحيّة فقط (kind==='live')؛ «حسب التوقيت» = الكلّ بترتيب المصدر. SSR عبر `?live=1`.
export async function SportMatchesSection({
  sportId = 1,
  date,
  live = false,
  liveHref = '/sport?live=1',
  timeHref = '/sport',
  headingId = 'sport-matches-heading',
}: {
  sportId?: number;
  date?: string;
  live?: boolean;
  liveHref?: string;
  timeHref?: string;
  headingId?: string;
}) {
  const all = await getMatchesByCompetition(sportId, date);
  const liveCount = all.reduce((n, g) => n + g.matches.filter((m) => m.kind === 'live').length, 0);
  const groups = live
    ? all.map((g) => ({ ...g, matches: g.matches.filter((m) => m.kind === 'live') })).filter((g) => g.matches.length > 0)
    : all;

  return (
    <section dir="rtl" aria-labelledby={headingId}>
      <div className="mb-3 flex items-center gap-3">
        <span className="h-6 w-1.5 shrink-0 bg-primary" aria-hidden />
        <h2 id={headingId} className="text-lg font-extrabold text-fg sm:text-xl">
          المباريات
        </h2>
      </div>

      {/* فلتر: مباشر / حسب التوقيت */}
      <div className="mb-3 flex items-center gap-2">
        <FilterTab href={liveHref} active={live} label="مباشر" count={liveCount} dot />
        <FilterTab href={timeHref} active={!live} label="حسب التوقيت" />
      </div>

      {groups.length === 0 ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 border border-border bg-surface p-8 text-center">
          <p className="text-base font-bold text-fg">{live ? 'لا مباريات مباشرة الآن' : 'لا تتوفّر مباريات حالياً'}</p>
          <p className="text-sm text-muted">
            {live ? 'جرّب «حسب التوقيت» لعرض كل المباريات.' : 'تعذّر جلب البيانات من المصدر الآن.'}
          </p>
        </div>
      ) : (
        <div className="border border-border bg-surface">
          {groups.map((group) => (
            <CompetitionBlock key={group.id} group={group} />
          ))}
        </div>
      )}
    </section>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
  dot,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  dot?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={
        'inline-flex items-center gap-1.5 border px-3 py-1.5 text-[13px] font-bold transition-colors ' +
        (active ? 'border-primary bg-primary text-white' : 'border-border text-muted hover:bg-surface-2 hover:text-fg')
      }
    >
      {dot && <span className={'avatar size-1.5 rounded-full ' + (active ? 'bg-white' : 'bg-primary')} aria-hidden />}
      {label}
      {dot && typeof count === 'number' && count > 0 && (
        <span className={'tabular-nums text-[11px] font-extrabold ' + (active ? 'text-white' : 'text-primary')}>{count}</span>
      )}
    </Link>
  );
}

function CompetitionBlock({ group }: { group: CompetitionGroup }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 bg-surface-2 px-3 py-1.5">
        <Link
          href={`/sport/competition/${group.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 transition-colors hover:text-primary"
        >
          {group.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- شعار البطولة من CDN 365
            <img src={group.logo} alt="" loading="lazy" className="size-6 shrink-0 object-contain" />
          ) : (
            <span className="h-4 w-1 shrink-0 bg-primary" aria-hidden />
          )}
          <span className="truncate text-[13px] font-medium text-fg">{group.name || '—'}</span>
          {group.country ? <span className="shrink-0 truncate text-[13px] text-muted">{group.country}</span> : null}
        </Link>
        <FollowButton type="competition" id={group.id} bare />
      </div>
      <div>
        {group.matches.map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}
