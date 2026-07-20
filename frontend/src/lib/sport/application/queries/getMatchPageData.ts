// Phase 1.4 Step 1 Round 2 — أُعيد بناؤها بعد قراءة صفحة المباراة الحيّة فعليًّا
// (frontend/src/app/(site)/sport/match/[id]/page.tsx): تفاصيل المباراة أوّلاً (تُعطي competitionId)،
// ثمّ كل بيانات البطولة/التبويب النشط بالتوازي — تمامًا كما تفعل الصفحة اليوم.
import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type {
  CompetitionMatchListing,
  CompetitionProfile,
  HeadToHead,
  MatchDetail,
  MatchStatRow,
  MatchTrendsSummary,
  PreGameComparison,
  ShotChart,
  Standing,
} from '../../domain/entities';
import { withFreshness, type SportQueryResult } from '../freshness';

export type MatchPageTab = 'overview' | 'lineup' | 'stats' | 'trends' | 'news' | 'h2h';

export interface MatchPageOptions {
  tab: MatchPageTab;
}

const EMPTY_MATCH_LISTING: CompetitionMatchListing = { today: [], upcoming: [], recent: [], fixtures: [], results: [] };

export interface MatchPageData {
  match: MatchDetail | null;
  competitionMeta: CompetitionProfile | null;
  matchList: CompetitionMatchListing;
  standings: Standing | null;
  shotMap: ShotChart | null;
  stats: MatchStatRow[];
  preGame: PreGameComparison | null;
  trends: MatchTrendsSummary | null;
  h2h: HeadToHead | null;
}

export async function getMatchPageData(
  provider: string,
  externalId: number,
  options: MatchPageOptions,
): Promise<SportQueryResult<MatchPageData>> {
  const dataProvider = SportProviderResolver(provider);
  const { tab } = options;

  return withFreshness(
    `match:${provider}:${externalId}:${tab}`,
    async () => {
      const match = await dataProvider.getMatchDetail(externalId);
      if (!match) {
        return { match: null, competitionMeta: null, matchList: EMPTY_MATCH_LISTING, standings: null, shotMap: null, stats: [], preGame: null, trends: null, h2h: null };
      }

      const cid = match.competitionId;
      const [competitionMeta, matchList, standings, shotMap, stats, preGame, trends, h2h] = await Promise.all([
        cid ? dataProvider.getCompetitionProfile(cid) : Promise.resolve(null),
        cid ? dataProvider.getCompetitionMatchListing(cid) : Promise.resolve(EMPTY_MATCH_LISTING),
        tab === 'overview' && cid ? dataProvider.getStandings(cid) : Promise.resolve(null),
        tab === 'overview' ? dataProvider.getShotChart(externalId) : Promise.resolve(null),
        tab === 'stats' ? dataProvider.getMatchStats(externalId) : Promise.resolve([]),
        tab === 'stats' ? dataProvider.getPreGameComparison(externalId) : Promise.resolve(null),
        tab === 'trends' ? dataProvider.getMatchTrendsSummary(externalId) : Promise.resolve(null),
        tab === 'h2h' || tab === 'overview' ? dataProvider.getHeadToHead(externalId) : Promise.resolve(null),
      ]);

      return { match, competitionMeta, matchList, standings, shotMap, stats, preGame, trends, h2h };
    },
    (value) => value.match === null,
  );
}
