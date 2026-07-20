// Phase 1.4 Step 1 Round 2 — أُعيد بناؤها بعد قراءة صفحة البطولة الحيّة فعليًّا
// (frontend/src/app/(site)/sport/competition/[id]/page.tsx): meta أوّلاً (تُعطي hasStats/hasHistory/
// hasStandings لتكييف تبويب overview)، ثمّ كل بيانات التبويب النشط بالتوازي، ثمّ المباراة المميّزة
// + اتجاهات المباريات القادمة (Promise.all على قائمة محدودة — لا حلقة تسلسلية، §31 No N+1).
import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type {
  CompetitionBracketStage,
  CompetitionChampion,
  CompetitionFixtures,
  CompetitionInsightsSummary,
  CompetitionMatchListing,
  CompetitionProfile,
  CompetitionStatsSummary,
  FixtureTrend,
  MatchDetail,
  MatchListItem,
  Standing,
} from '../../domain/entities';
import { withFreshness, type SportQueryResult } from '../freshness';

export type CompetitionPageTab = 'overview' | 'matches' | 'standings' | 'news' | 'brackets' | 'stats' | 'insights' | 'champions';

export interface CompetitionPageOptions {
  tab: CompetitionPageTab;
}

const EMPTY_MATCH_LISTING: CompetitionMatchListing = { today: [], upcoming: [], recent: [], fixtures: [], results: [] };

export interface TrendCard {
  match: MatchListItem;
  trends: FixtureTrend[];
}

export interface CompetitionPageData {
  meta: CompetitionProfile | null;
  games: CompetitionFixtures | null;
  stats: CompetitionStatsSummary | null;
  champions: CompetitionChampion[];
  standings: Standing | null;
  brackets: CompetitionBracketStage[];
  insights: CompetitionInsightsSummary | null;
  matchList: CompetitionMatchListing;
  featured: MatchDetail | null;
  trendCards: TrendCard[];
}

export async function getCompetitionPageData(
  provider: string,
  externalId: number,
  options: CompetitionPageOptions,
): Promise<SportQueryResult<CompetitionPageData>> {
  const dataProvider = SportProviderResolver(provider);
  const { tab } = options;

  return withFreshness(
    `competition:${provider}:${externalId}:${tab}`,
    async () => {
      const meta = await dataProvider.getCompetitionProfile(externalId);
      if (!meta) {
        return {
          meta: null,
          games: null,
          stats: null,
          champions: [],
          standings: null,
          brackets: [],
          insights: null,
          matchList: EMPTY_MATCH_LISTING,
          featured: null,
          trendCards: [],
        };
      }

      const isOverview = tab === 'overview';

      const [games, stats, champions, standings, brackets, insights, matchList] = await Promise.all([
        tab === 'matches' || isOverview ? dataProvider.getCompetitionGamesList(externalId) : Promise.resolve(null),
        tab === 'stats' || (isOverview && meta.hasStats) ? dataProvider.getCompetitionStatsSummary(externalId) : Promise.resolve(null),
        tab === 'champions' || (isOverview && meta.hasHistory) ? dataProvider.getCompetitionHistory(externalId) : Promise.resolve([]),
        tab === 'standings' || (isOverview && meta.hasStandings) ? dataProvider.getStandings(externalId) : Promise.resolve(null),
        tab === 'brackets' ? dataProvider.getCompetitionBrackets(externalId) : Promise.resolve([]),
        tab === 'insights' ? dataProvider.getCompetitionInsights(externalId) : Promise.resolve(null),
        dataProvider.getCompetitionMatchListing(externalId),
      ]);

      // للتفاصيل فقط: المباراة المميّزة (أوّل مباراة قادمة أو نتيجة) + اتجاهات لأقرب ٦ مباريات —
      // قائمة محدودة الحجم مسبقًا (slice(0,6))، بالتوازي عبر Promise.all — لا حلقة تسلسلية لكل عنصر.
      const nextMatch = games ? (games.fixtures[0] ?? games.results[0] ?? null) : null;
      const featuredId = isOverview ? (nextMatch?.id ?? null) : null;
      const trendFixtures: MatchListItem[] = isOverview && games ? games.fixtures.slice(0, 6) : [];

      const [featured, trendLists] = await Promise.all([
        featuredId ? dataProvider.getMatchDetail(featuredId) : Promise.resolve(null),
        Promise.all(trendFixtures.map((m) => dataProvider.getFixtureTrends(m.id))),
      ]);
      const trendCards: TrendCard[] = trendFixtures
        .map((m, i) => ({ match: m, trends: trendLists[i] }))
        .filter((c) => c.trends.length > 0);

      return { meta, games, stats, champions, standings, brackets, insights, matchList, featured, trendCards };
    },
    (value) => value.meta === null,
  );
}
