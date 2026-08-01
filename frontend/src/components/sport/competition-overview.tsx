import Link from 'next/link';
import { CompetitionTrends, type TrendCard } from '@/components/sport/competition-trends';
import { FeaturedMatchWidget } from '@/components/sport/featured-match-widget';
import { MatchRow } from '@/components/sport/match-row';
import { SportNews } from '@/components/sport/sport-news';
import { StandingsPreview } from '@/components/sport/standings-view';
import { Card, CardHeader } from '@/components/ui/card';
import type {
  CompetitionChampion,
  CompetitionProfile,
  CompetitionStatLeader,
  MatchDetail,
  MatchListItem,
  Standing,
} from '@/lib/sport/domain/entities';

// تبويب «التفاصيل» — نظرة عامّة **متكيّفة حسب البطولة** (الفكرة لا الشكل): تعرض ما لدى البطولة فقط — مباراة
// قادمة + معاينة ترتيب (إن وُجد) + أبرز هدّافين (إن وُجدت إحصاءات، روابط لصفحة اللاعب) + عن البطولة + أخبار
// (CMS). كلّ عنصر يربط لتفاصيله (فريق/مباراة/لاعب/التبويبات) — لا روابط محذوفة.
export function CompetitionOverview({
  meta,
  featured,
  trends,
  nextMatch,
  standings,
  scorers,
  scorersUnit,
  champion,
}: {
  meta: CompetitionProfile;
  featured: MatchDetail | null;
  trends: TrendCard[];
  nextMatch: MatchListItem | null;
  standings: Standing | null;
  scorers: CompetitionStatLeader[];
  scorersUnit: string | null;
  champion: CompetitionChampion | null;
}) {
  const holder = champion?.winner ?? null;
  const base = `/sport/competition/${meta.id}`;
  const hasStandings = !!standings && standings.rows.length > 0;
  const hasScorers = scorers.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {featured ? (
        <FeaturedMatchWidget detail={featured} meta={meta} />
      ) : nextMatch ? (
        <Card as="section" dir="rtl">
          <CardHeader>
            <h2 className="text-sm font-extrabold text-fg">
              {nextMatch.kind === 'finished' ? 'آخر مباراة' : 'المباراة القادمة'}
            </h2>
          </CardHeader>
          <MatchRow match={nextMatch} />
        </Card>
      ) : null}

      {hasScorers && (
        <Card as="section" dir="rtl" className="flex flex-col">
          <CardHeader>
            <h2 className="text-sm font-extrabold text-fg">أبرز الهدّافين</h2>
          </CardHeader>
          {meta.logo && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- شعار بطولة 365 من CDN */}
              <img src={meta.logo} alt="" loading="lazy" className="size-4 shrink-0 object-contain" />
              <span className="truncate text-xs font-bold text-muted">{meta.name}</span>
            </div>
          )}
          <ul>
            {scorers.slice(0, 6).map((s, i) => (
              <li key={`${s.id}-${i}`}>
                <Link
                  href={`/sport/player/${s.id}`}
                  className="flex items-center gap-3 border-b border-border px-4 py-2 transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <span className="w-4 shrink-0 text-center text-xs font-bold tabular-nums text-muted">{i + 1}</span>
                  <span className="avatar size-8 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- صورة لاعب 365 من CDN
                      <img src={s.image} alt="" loading="lazy" className="size-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-fg">
                      {s.name}
                      {s.position && <span className="ms-1.5 text-[10px] font-normal text-muted">{s.position}</span>}
                    </span>
                    {s.team && <span className="block truncate text-[11px] text-muted">{s.team}</span>}
                  </span>
                  <span className="shrink-0 text-base font-extrabold tabular-nums text-fg">{s.value}</span>
                  {scorersUnit && <span className="shrink-0 text-[10px] text-muted">{scorersUnit}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`${base}?tab=stats`}
            className="border-t border-border px-4 py-2.5 text-center text-[13px] font-bold text-primary transition-colors hover:bg-surface-2"
          >
            عرض كل الإحصائيات
          </Link>
        </Card>
      )}

      <CompetitionTrends cards={trends} />

      {hasStandings && standings && <StandingsPreview data={standings} meta={meta} />}

      <Card as="section" dir="rtl">
        <CardHeader>
          <h2 className="text-sm font-extrabold text-fg">عن البطولة</h2>
        </CardHeader>
        <dl>
          <InfoRow k="الاسم" v={meta.name} />
          {meta.country && <InfoRow k="الدولة" v={meta.country} />}
          {holder?.name && <InfoRow k="حامل اللقب" v={holder.name} />}
        </dl>
      </Card>

      <SportNews />
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-b-0">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="truncate ps-3 text-sm font-bold text-fg">{v}</dd>
    </div>
  );
}
