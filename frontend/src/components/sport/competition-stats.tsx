import { Card, CardHeader } from '@/components/ui/card';
import type { CompetitionStatsSummary } from '@/lib/sport/domain/entities';

// تبويب «الإحصائيات» لصفحة البطولة — شبكة بطاقات لكلّ فئة (هدّافون/صنّاع/بطاقات/شباك نظيفة…)،
// كلّ بطاقة = ترتيب + صورة لاعب دائريّة + اسم + مركز·فريق + القيمة (مع الوحدة). مربّع؛ الصور `.avatar`. لا تلفيق.
export function CompetitionStatsView({ data }: { data: CompetitionStatsSummary }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {data.categories.map((cat) => (
        <Card key={cat.id} as="section" dir="rtl" className="flex flex-col">
          <CardHeader>
            <h2 className="text-sm font-extrabold text-fg">{cat.title}</h2>
          </CardHeader>
          <ol>
            {cat.leaders.map((p, idx) => (
              <li key={`${p.id}-${idx}`} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-muted tabular-nums">{idx + 1}</span>
                <span className="avatar size-9 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- صورة لاعب 365 من CDN
                    <img src={p.image} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-fg">{p.name}</div>
                  {(p.position || p.team) && (
                    <div className="truncate text-xs text-muted">{[p.position, p.team].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
                <div className="shrink-0 text-center">
                  <div className="text-base font-extrabold tabular-nums text-fg">{p.value}</div>
                  {cat.unit && <div className="text-[10px] text-muted">{cat.unit}</div>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}
