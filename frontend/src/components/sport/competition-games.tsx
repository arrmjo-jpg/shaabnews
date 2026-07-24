import { MatchRow } from '@/components/sport/match-row';
import type { MatchListItem } from '@/lib/sport/domain/entities';

// تبويب «المباريات» لصفحة البطولة — جدول المباريات (قادمة) + النتائج الأخيرة، كلّ صفّ `MatchRow` رابط لتفاصيل المباراة.
export function CompetitionGamesView({ fixtures, results }: { fixtures: MatchListItem[]; results: MatchListItem[] }) {
  if (!fixtures.length && !results.length) {
    return (
      <div className="border border-border bg-surface p-8 text-center text-sm text-muted">
        لا مباريات متاحة لهذه البطولة حالياً.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {fixtures.length > 0 && <GamesBlock title="جدول المباريات" games={fixtures} />}
      {results.length > 0 && <GamesBlock title="النتائج الأخيرة" games={results} />}
    </div>
  );
}

function GamesBlock({ title, games }: { title: string; games: MatchListItem[] }) {
  return (
    <section dir="rtl" className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-extrabold text-fg">{title}</h2>
      </div>
      <div>
        {games.map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
      </div>
    </section>
  );
}
