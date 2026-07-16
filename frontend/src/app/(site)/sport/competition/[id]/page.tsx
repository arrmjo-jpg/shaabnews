import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { CompetitionBrackets } from '@/components/sport/competition-brackets';
import { CompetitionChampions } from '@/components/sport/competition-champions';
import { CompetitionGamesView } from '@/components/sport/competition-games';
import { COMPETITION_TABS, CompetitionHeader } from '@/components/sport/competition-header';
import { CompetitionInsightsView } from '@/components/sport/competition-insights';
import { CompetitionMatchesSidebar } from '@/components/sport/competition-matches-sidebar';
import { CompetitionOverview } from '@/components/sport/competition-overview';
import { CompetitionStatsView } from '@/components/sport/competition-stats';
import { SportNews } from '@/components/sport/sport-news';
import { StandingsView } from '@/components/sport/standings-view';
import { getCompetitionGames, getCompetitionInsights, getCompetitionMatchList, getGameDetail, getGameTrends } from '@/lib/sport/games';
import { buildMetadata } from '@/lib/seo';
import {
  getCompetitionBrackets,
  getCompetitionHistory,
  getCompetitionMeta,
  getCompetitionStats,
  getStandings,
} from '@/lib/sport/stats';

// صفحة البطولة (نمط 365 `/league/{id}`) — كلّ الأقسام في الهيدر (`?tab=`): التفاصيل (الافتراضيّ) · المباريات ·
// المجموعات · أخبار (CMS موقعنا) · خروج المغلوب · الإحصائيات · ملاحظات · الأبطال. الأقسام بلا بيانات في الـAPI
// العامّ (ملاحظات، وتفاصيل مواجهات خروج المغلوب) تعرض حالة صادقة بلا تلفيق. الهيدر مُعاد الاستخدام (CompetitionHeader).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isInteger(cid) || cid <= 0) {
    return buildMetadata({ title: 'البطولة', path: `/sport/competition/${id}` });
  }
  const meta = await getCompetitionMeta(cid);
  if (!meta) return buildMetadata({ title: 'البطولة', path: `/sport/competition/${cid}` });

  return buildMetadata({
    title: meta.name,
    description: `جدول ونتائج وترتيب بطولة ${meta.name}`,
    path: `/sport/competition/${cid}`,
    type: 'website',
  });
}

export default async function CompetitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const cid = Number(id);
  if (!Number.isInteger(cid) || cid <= 0) notFound();
  const meta = await getCompetitionMeta(cid);
  if (!meta) notFound();

  const active = COMPETITION_TABS.some((t) => t.id === sp.tab) ? sp.tab! : 'overview';

  // التفاصيل (overview) = نظرة عامّة متكيّفة ⇒ تجلب ما تتيحه أعلام البطولة بالتوازي. باقي التبويبات: بياناتها فقط.
  const isOverview = active === 'overview';
  const [games, stats, champions, standings, brackets, insights, matchList] = await Promise.all([
    active === 'matches' || isOverview ? getCompetitionGames(cid) : Promise.resolve(null),
    active === 'stats' || (isOverview && meta.hasStats) ? getCompetitionStats(cid) : Promise.resolve(null),
    active === 'champions' || (isOverview && meta.hasHistory) ? getCompetitionHistory(cid) : Promise.resolve([]),
    active === 'standings' || (isOverview && meta.hasStandings) ? getStandings(cid) : Promise.resolve(null),
    active === 'brackets' ? getCompetitionBrackets(cid) : Promise.resolve([]),
    active === 'insights' ? getCompetitionInsights(cid) : Promise.resolve(null),
    getCompetitionMatchList(cid),
  ]);
  const goalsCat = stats?.categories.find((c) => c.title === 'الأهداف') ?? stats?.categories[0] ?? null;
  const nextMatch = games ? (games.fixtures[0] ?? games.results[0] ?? null) : null;
  // للتفاصيل فقط: المباراة المميّزة (تفاصيل أوّل مباراة قادمة) + Trends لأقرب ٦ مباريات قادمة — بالتوازي.
  const featuredId = isOverview ? (nextMatch?.id ?? null) : null;
  const trendFixtures = isOverview && games ? games.fixtures.slice(0, 6) : [];
  const [featured, trendLists] = await Promise.all([
    featuredId ? getGameDetail(featuredId) : Promise.resolve(null),
    Promise.all(trendFixtures.map((m) => getGameTrends(m.id))),
  ]);
  const trendCards = trendFixtures.map((match, i) => ({ match, trends: trendLists[i] })).filter((c) => c.trends.length > 0);

  return (
    <div className="bg-surface-2">
      <CompetitionHeader meta={meta} activeTab={active} />
      <Container className="py-6">
        <Link
          href="/sport"
          className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-muted transition-colors hover:text-fg"
        >
          <ChevronRight className="size-4" />
          الرياضة
        </Link>

        {/* تخطيط 365: شريط جانبيّ بمباريات البطولة (يمين RTL) + المحتوى (التبويب النشط). مربوط بالبطولة الحاليّة. */}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="min-w-0">
            <CompetitionMatchesSidebar {...matchList} />
          </aside>
          <main className="min-w-0">
            {active === 'matches' ? (
          <CompetitionGamesView fixtures={games?.fixtures ?? []} results={games?.results ?? []} />
        ) : active === 'standings' ? (
          standings ? (
            <StandingsView data={standings} showLegend />
          ) : (
            <div className="border border-border bg-white p-8 text-center text-sm text-muted">لا يتوفّر ترتيب لهذه البطولة.</div>
          )
        ) : active === 'news' ? (
          <SportNews />
        ) : active === 'brackets' ? (
          <CompetitionBrackets stages={brackets} title={meta.name} logo={meta.logo} />
        ) : active === 'stats' ? (
          stats ? (
            <CompetitionStatsView data={stats} />
          ) : (
            <div className="border border-border bg-white p-8 text-center text-sm text-muted">لا تتوفّر إحصاءات لهذه البطولة.</div>
          )
        ) : active === 'insights' ? (
          insights ? (
            <CompetitionInsightsView data={insights} />
          ) : (
            <div className="border border-border bg-white p-8 text-center text-sm text-muted">
              لا تتوفّر ملاحظات لهذه البطولة حاليّاً.
            </div>
          )
        ) : active === 'champions' ? (
          <CompetitionChampions rows={champions} title={meta.name} />
        ) : (
          <CompetitionOverview
            meta={meta}
            featured={featured}
            trends={trendCards}
            nextMatch={nextMatch}
            standings={standings}
            scorers={goalsCat?.leaders ?? []}
            scorersUnit={goalsCat?.unit ?? null}
            champion={champions[0] ?? null}
          />
            )}
          </main>
        </div>
      </Container>
    </div>
  );
}
