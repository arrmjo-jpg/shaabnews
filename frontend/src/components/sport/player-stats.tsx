import { CompetitionCarousel } from '@/components/sport/competition-carousel';
import { Card, CardHeader } from '@/components/ui/card';
import type { PlayerCompetitionRef, PlayerStatLine } from '@/lib/sport/domain/entities';

// بطاقة إحصاء اللاعب (نمط 365 athlete highlight-stats) — محوّل بطولات أفقيّ (روابط `?competitionId=`، يحفظ التبويب)
// + شبكة بطاقات مقاييس (أهداف/صناعة/تقييم/جزاء/بطاقات). البيانات الفعليّة فقط — حالة فارغة صادقة بلا تلفيق.
export function PlayerStats({
  competitions,
  activeId,
  stats,
  baseHref,
}: {
  competitions: PlayerCompetitionRef[];
  activeId: number | null;
  stats: PlayerStatLine[];
  baseHref: string;
}) {
  return (
    <Card as="section" dir="rtl">
      <CardHeader>
        <h2 className="text-sm font-extrabold text-fg">الإحصائيات</h2>
      </CardHeader>

      {competitions.length > 0 && (
        <CompetitionCarousel competitions={competitions} activeId={activeId} baseHref={baseHref} />
      )}

      {stats.length > 0 ? (
        <div className="grid grid-cols-3 gap-px bg-border sm:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center justify-center gap-1 bg-surface px-2 py-4 text-center">
              <span className="text-xl font-extrabold tabular-nums text-fg">{s.value}</span>
              <span className="text-[11px] leading-tight text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-muted">لا تتوفّر إحصاءات لهذه البطولة.</div>
      )}
    </Card>
  );
}
