import { Card, CardHeader } from '@/components/ui/card';
import type { MatchStatRow } from '@/lib/sport/domain/entities';

// تبويب الإحصائيات — كلّ الإحصائيّات مُجمّعة بالفئة (categoryName)؛ لكلّ واحدة: قيمة المضيف (يمين) | الاسم | قيمة الضيف
// (يسار) + شريط مقارنة (المضيف أحمر يمين / الضيف رماديّ يسار). غير المصنّفة (الرئيسيّة) أوّلاً. RTL.
export function MatchStats({ stats }: { stats: MatchStatRow[] }) {
  if (!stats.length) {
    return <Card className="p-8 text-center text-sm text-muted">الإحصائيات غير متاحة لهذه المباراة.</Card>;
  }
  const groups: { category: string | null; rows: MatchStatRow[] }[] = [];
  const idx = new Map<string, number>();
  for (const s of stats) {
    const key = s.category ?? '';
    let gi = idx.get(key);
    if (gi == null) {
      gi = groups.length;
      idx.set(key, gi);
      groups.push({ category: s.category, rows: [] });
    }
    groups[gi].rows.push(s);
  }

  return (
    <Card as="section" dir="rtl">
      <CardHeader className="bg-surface-2">
        <h2 className="text-sm font-extrabold text-fg">الإحصائيات</h2>
      </CardHeader>
      {groups.map((grp, gi) => (
        <div key={gi}>
          {grp.category && (
            <div className="border-b border-border bg-surface-2/60 px-4 py-1.5 text-[11px] font-bold text-muted">
              {grp.category}
            </div>
          )}
          <ul className="divide-y divide-border">
            {grp.rows.map((s, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-extrabold tabular-nums text-fg">{s.homeValue}</span>
                  <span className="truncate text-center text-xs font-medium text-muted">{s.name}</span>
                  <span className="font-extrabold tabular-nums text-fg">{s.awayValue}</span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden bg-surface-2">
                  <div className="bg-primary" style={{ width: `${Math.round(s.homeShare * 100)}%` }} />
                  <div className="flex-1 bg-zinc-300" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
