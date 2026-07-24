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
import { SportBreadcrumb } from '@/components/sport/sport-breadcrumb';
import { SportNews } from '@/components/sport/sport-news';
import { StandingsView } from '@/components/sport/standings-view';
import { env } from '@/lib/env';
import { buildMetadata } from '@/lib/seo';
import { getCompetitionPageData, type CompetitionPageTab } from '@/lib/sport/application/queries/getCompetitionPageData';

// صفحة البطولة (نمط 365 `/league/{id}`) — كلّ الأقسام في الهيدر (`?tab=`): التفاصيل (الافتراضيّ) · المباريات ·
// المجموعات · أخبار (CMS موقعنا) · خروج المغلوب · الإحصائيات · ملاحظات · الأبطال. الأقسام بلا بيانات في الـAPI
// العامّ (ملاحظات، وتفاصيل مواجهات خروج المغلوب) تعرض حالة صادقة بلا تلفيق. الهيدر مُعاد الاستخدام (CompetitionHeader).
// Phase 1.4 Step 2 — تستورد حصريًّا من `application/queries/*` (لا `games.ts`/`stats.ts` مباشرة)، طبقًا لـ §34.
const PROVIDER = '365scores';

function resolveTab(raw: string | undefined): CompetitionPageTab {
  return COMPETITION_TABS.some((t) => t.id === raw) ? (raw as CompetitionPageTab) : 'overview';
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isInteger(cid) || cid <= 0) {
    return buildMetadata({ title: 'البطولة', path: `/sport/competition/${id}` });
  }
  const sp = await searchParams;
  const tab = resolveTab(sp.tab);
  const { data } = await getCompetitionPageData(PROVIDER, cid, { tab });
  const meta = data.meta;
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

  const active = resolveTab(sp.tab);
  const { data } = await getCompetitionPageData(PROVIDER, cid, { tab: active });
  const meta = data.meta;
  if (!meta) notFound();

  const { games, stats, champions, standings, brackets, insights, matchList, featured, trendCards } = data;
  const goalsCat = stats?.categories.find((c) => c.title === 'الأهداف') ?? stats?.categories[0] ?? null;
  const nextMatch = games ? (games.fixtures[0] ?? games.results[0] ?? null) : null;

  const siteUrl = env.siteUrl || '';
  const competitionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: meta.name,
    url: `${siteUrl}/sport/competition/${cid}`,
    ...(meta.logo ? { logo: meta.logo } : {}),
  };

  return (
    <div className="bg-surface-2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(competitionJsonLd) }} />
      <CompetitionHeader meta={meta} activeTab={active} />
      <Container className="py-6">
        <SportBreadcrumb items={[{ name: meta.name }]} />

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
            <div className="border border-border bg-surface p-8 text-center text-sm text-muted">لا يتوفّر ترتيب لهذه البطولة.</div>
          )
        ) : active === 'news' ? (
          <SportNews />
        ) : active === 'brackets' ? (
          <CompetitionBrackets stages={brackets} title={meta.name} logo={meta.logo} />
        ) : active === 'stats' ? (
          stats ? (
            <CompetitionStatsView data={stats} />
          ) : (
            <div className="border border-border bg-surface p-8 text-center text-sm text-muted">لا تتوفّر إحصاءات لهذه البطولة.</div>
          )
        ) : active === 'insights' ? (
          insights ? (
            <CompetitionInsightsView data={insights} />
          ) : (
            <div className="border border-border bg-surface p-8 text-center text-sm text-muted">
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
