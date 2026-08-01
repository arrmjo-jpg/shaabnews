import { MatchRow } from '@/components/sport/match-row';
import { Card, CardHeader } from '@/components/ui/card';
import type { MatchListItem } from '@/lib/sport/domain/entities';

// تبويب «المباريات» لصفحة البطولة — جدول المباريات (قادمة) + النتائج الأخيرة، كلّ صفّ `MatchRow` رابط لتفاصيل المباراة.
export function CompetitionGamesView({ fixtures, results }: { fixtures: MatchListItem[]; results: MatchListItem[] }) {
  if (!fixtures.length && !results.length) {
    return <Card className="p-8 text-center text-sm text-muted">لا مباريات متاحة لهذه البطولة حالياً.</Card>;
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
    <Card as="section" dir="rtl">
      <CardHeader>
        <h2 className="text-sm font-extrabold text-fg">{title}</h2>
      </CardHeader>
      <div>
        {games.map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
      </div>
    </Card>
  );
}
