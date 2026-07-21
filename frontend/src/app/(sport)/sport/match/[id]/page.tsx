import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { CompetitionHeader } from '@/components/sport/competition-header';
import { CompetitionMatchesSidebar } from '@/components/sport/competition-matches-sidebar';
import { MatchCommentary } from '@/components/sport/match-commentary';
import { MatchH2H } from '@/components/sport/match-h2h';
import { MatchHeader } from '@/components/sport/match-header';
import { MatchInfo } from '@/components/sport/match-info';
import { MatchLineup } from '@/components/sport/match-lineup';
import { MatchPreGameStats } from '@/components/sport/match-pregame-stats';
import { MatchRecentForm } from '@/components/sport/match-recent-form';
import { MatchShotMap } from '@/components/sport/match-shot-map';
import { MatchStats } from '@/components/sport/match-stats';
import { MatchTopPerformers } from '@/components/sport/match-top-performers';
import { MatchTrendsView } from '@/components/sport/match-trends';
import { SportBreadcrumb } from '@/components/sport/sport-breadcrumb';
import { SportNews } from '@/components/sport/sport-news';
import { StandingsTable } from '@/components/sport/standings-table';
import { env } from '@/lib/env';
import { buildMetadata } from '@/lib/seo';
import { getMatchPageData, type MatchPageTab } from '@/lib/sport/application/queries/getMatchPageData';
import type { Standing } from '@/lib/sport/domain/entities';

// صفحة تفاصيل المباراة (نمط 365 game-center) — عمودان: يمين شريط مباريات الدوري (`CompetitionMatchesSidebar` نفسه،
// بكلّ تبويباته) + يسار تفاصيل المباراة: ترويسة متدرّجة + **كلّ التبويبات** (المباراة/التشكيلة المتوقعة/الإحصائيات/
// شائع/أخبار/المواجهات المباشرة) محفوظة دائماً، بحالة صادقة عند غياب البيانات. المصدر `web/game` + `web/trends` + CMS.
// Phase 1.4 Step 2 — تستورد حصريًّا من `application/queries/*` (لا `games.ts`/`stats.ts` مباشرة)، طبقًا لـ §34.
const PROVIDER = '365scores';

const TABS = [
  { id: 'overview', label: 'المباراة' },
  { id: 'lineup', label: 'التشكيلة المتوقعة' },
  { id: 'stats', label: 'الإحصائيات' },
  { id: 'trends', label: 'شائع' },
  { id: 'news', label: 'أخبار' },
  { id: 'h2h', label: 'المواجهات المباشرة' },
] as const;

function resolveTab(raw: string | undefined): MatchPageTab {
  return TABS.some((t) => t.id === raw) ? (raw as MatchPageTab) : 'overview';
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const gameId = Number(id);
  if (!Number.isInteger(gameId) || gameId <= 0) {
    return buildMetadata({ title: 'المباراة', path: `/sport/match/${id}` });
  }
  const sp = await searchParams;
  const tab = resolveTab(sp.tab);
  const { data } = await getMatchPageData(PROVIDER, gameId, { tab });
  const d = data.match;
  if (!d) return buildMetadata({ title: 'المباراة', path: `/sport/match/${id}` });

  return buildMetadata({
    title: `${d.home.name} ضد ${d.away.name}`,
    description: `نتيجة وتفاصيل مباراة ${d.home.name} ضد ${d.away.name}`,
    path: `/sport/match/${gameId}`,
    type: 'website',
  });
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const gameId = Number(id);
  if (!Number.isInteger(gameId) || gameId <= 0) notFound();

  const active = resolveTab(sp.tab);
  const { data } = await getMatchPageData(PROVIDER, gameId, { tab: active });
  const d = data.match;
  if (!d) notFound();

  const { competitionMeta: compMeta, matchList, standings, shotMap, stats, preGame, trends, h2h } = data;
  const matchTeamIds = [d.homeId, d.awayId].filter((x): x is number => x != null);

  const siteUrl = env.siteUrl || '';
  const matchJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${d.home.name} ضد ${d.away.name}`,
    url: `${siteUrl}/sport/match/${gameId}`,
    ...(d.startTime ? { startDate: d.startTime } : {}),
    ...(d.venue ? { location: { '@type': 'Place', name: d.venue } } : {}),
    homeTeam: { '@type': 'SportsTeam', name: d.home.name, ...(d.home.logo ? { logo: d.home.logo } : {}) },
    awayTeam: { '@type': 'SportsTeam', name: d.away.name, ...(d.away.logo ? { logo: d.away.logo } : {}) },
  };

  return (
    <div className="bg-surface-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(matchJsonLd) }} />
      {compMeta && <CompetitionHeader meta={compMeta} />}
      <Container className="py-6">
        <SportBreadcrumb items={[{ name: `${d.home.name} ضد ${d.away.name}` }]} />

        {/* عمودان (نمط 365): يمين مباريات الدوري، يسار تفاصيل المباراة. */}
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="min-w-0">
            <CompetitionMatchesSidebar {...matchList} />
          </aside>

          <main className="flex min-w-0 flex-col gap-6">
            <MatchHeader d={d} />

            {/* كلّ التبويبات محفوظة (نمط 365) */}
            <div dir="rtl" className="flex overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  href={t.id === 'overview' ? `/sport/match/${gameId}` : `/sport/match/${gameId}?tab=${t.id}`}
                  aria-current={active === t.id ? 'page' : undefined}
                  className={
                    'shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-center text-sm font-bold transition-colors ' +
                    (active === t.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-fg')
                  }
                >
                  {t.label}
                </Link>
              ))}
            </div>

            {active === 'lineup' ? (
              <MatchLineup
                home={d.homeLineup}
                away={d.awayLineup}
                homeTeam={d.home.name}
                awayTeam={d.away.name}
                homeColor={d.home.color}
                awayColor={d.away.color}
                homeLogo={d.home.logo}
                awayLogo={d.away.logo}
              />
            ) : active === 'stats' ? (
              stats.length > 0 ? (
                <MatchStats stats={stats} />
              ) : preGame ? (
                <MatchPreGameStats data={preGame} homeColor={d.home.color} awayColor={d.away.color} />
              ) : (
                <div className="border border-border bg-white p-8 text-center text-sm text-muted">
                  لا تتوفّر إحصاءات لهذه المباراة بعد.
                </div>
              )
            ) : active === 'trends' ? (
              trends ? (
                <MatchTrendsView data={trends} />
              ) : (
                <div className="border border-border bg-white p-8 text-center text-sm text-muted">
                  لا تتوفّر إحصاءات شائعة لهذه المباراة.
                </div>
              )
            ) : active === 'news' ? (
              <SportNews />
            ) : active === 'h2h' ? (
              h2h ? (
                <MatchH2H data={h2h} />
              ) : (
                <div className="border border-border bg-white p-8 text-center text-sm text-muted">
                  لا تتوفّر بيانات مواجهات بين هذين الفريقين.
                </div>
              )
            ) : (
              <>
                {shotMap && <MatchShotMap data={shotMap} />}

                {d.topPerformers.length > 0 && <MatchTopPerformers categories={d.topPerformers} />}

                {d.commentary.length > 0 ? (
                  <MatchCommentary stages={d.commentary} />
                ) : (
                  <div className="border border-border bg-white p-8 text-center text-sm text-muted">
                    {d.kind === 'upcoming' ? 'لم تبدأ المباراة بعد.' : 'لا أحداث مسجّلة لهذه المباراة.'}
                  </div>
                )}

                {h2h && h2h.forms.length > 0 && <MatchRecentForm forms={h2h.forms} />}

                <MatchInfo d={d} />

                {standings && (
                  <section dir="rtl" className="border border-border bg-white">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                      {standings.competition.logo && (
                        // eslint-disable-next-line @next/next/no-img-element -- شعار البطولة من CDN 365
                        <img src={standings.competition.logo} alt="" className="size-6 shrink-0 object-contain" />
                      )}
                      <h2 className="text-sm font-extrabold text-fg">ترتيب الفريقين</h2>
                    </div>
                    <div className="px-2">
                      <StandingsTable data={groupOfTeams(standings, matchTeamIds)} highlightIds={matchTeamIds} />
                    </div>
                    <Link
                      href={`/sport/competition/${standings.competition.id}?tab=standings`}
                      className="block border-t border-border px-4 py-2.5 text-center text-[13px] font-bold text-primary transition-colors hover:bg-surface-2"
                    >
                      الترتيب الكامل
                    </Link>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </Container>
    </div>
  );
}

// ترتيب الفريقين: نُظهر مجموعتهما فقط (بطولة مجموعات) — نمط 365 «ترتيب الفريقين». دوري أحاديّ ⇒ الجدول كما هو.
function groupOfTeams(standings: Standing, teamIds: number[]): Standing {
  if (standings.groups.length <= 1) return standings;
  const row = standings.rows.find((r) => teamIds.includes(r.team.id));
  if (!row || row.groupNum == null) return standings;
  return { ...standings, rows: standings.rows.filter((r) => r.groupNum === row.groupNum) };
}
