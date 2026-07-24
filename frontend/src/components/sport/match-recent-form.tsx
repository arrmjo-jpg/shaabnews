import Link from 'next/link';
import type { HeadToHeadFormGame, HeadToHeadTeamForm } from '@/lib/sport/domain/entities';

// «الأداء» (آخر ٥) لتبويب المباراة — لكلّ فريق شارات نتائجه الخمس الأخيرة (ف/ت/خ) + روابط لكلّ مباراة. يعيد استخدام
// بيانات `getH2H().forms` (recentGames). صورة مصغّرة من الأداء الكامل في تبويب «المواجهات المباشرة».
const FORM: Record<HeadToHeadFormGame['outcome'], { label: string; cls: string }> = {
  W: { label: 'ف', cls: 'bg-emerald-600' },
  D: { label: 'ت', cls: 'bg-zinc-400' },
  L: { label: 'خ', cls: 'bg-red-500' },
};

export function MatchRecentForm({ forms }: { forms: HeadToHeadTeamForm[] }) {
  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-extrabold text-fg">الأداء — آخر ٥ مباريات</h2>
      </div>
      <div className="divide-y divide-border">
        {forms.map((f) => (
          <div key={f.teamId} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/sport/team/${f.teamId}`} className="flex min-w-0 flex-1 items-center gap-2 transition-colors hover:text-primary">
              {f.teamLogo && (
                // eslint-disable-next-line @next/next/no-img-element -- شعار فريق 365 من CDN
                <img src={f.teamLogo} alt="" loading="lazy" className="size-6 shrink-0 object-contain" />
              )}
              <span className="truncate text-[13px] font-bold text-fg">{f.teamName || '—'}</span>
            </Link>
            <span className="flex shrink-0 gap-1">
              {f.games.slice(0, 5).map((g) => {
                const o = FORM[g.outcome];
                return (
                  <Link
                    key={g.id}
                    href={`/sport/match/${g.id}`}
                    title={`${g.home.name} ${g.home.score ?? '-'}-${g.away.score ?? '-'} ${g.away.name}`}
                    className={'flex size-6 items-center justify-center text-[11px] font-bold text-white transition-opacity hover:opacity-80 ' + o.cls}
                  >
                    {o.label}
                  </Link>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
