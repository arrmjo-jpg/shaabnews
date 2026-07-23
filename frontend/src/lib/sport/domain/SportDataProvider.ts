// الـ Port (Ports & Adapters): العقد الوحيد الذي تعتمد عليه طبقة الـ Application — لا تستورد
// أي كود Infrastructure مباشرة. النطاق الأصليّ كان محدودًا بما تحتاجه getSportHomeData فقط؛
// Phase 1.4 (§34 Provider Contract) يوسّعه بما تحتاجه صفحات التفصيل الأربع (بطولة/مباراة/فريق/لاعب).
//
// قاعدة صارمة (§34): لا يجوز لأيّ صفحة Next.js أو مكوّن استيراد games.ts/stats.ts/player.ts
// مباشرة — المسموح فقط هذه الواجهة أو خدمات application/*.
import type {
  Competition,
  CompetitionBracketStage,
  CompetitionChampion,
  CompetitionFixtures,
  CompetitionInsightsSummary,
  CompetitionMatchListing,
  CompetitionProfile,
  CompetitionRoster,
  CompetitionStatsSummary,
  Country,
  FixtureTrend,
  HeadToHead,
  Match,
  MatchDetail,
  MatchStatRow,
  MatchTrendsSummary,
  Player,
  PlayerCareer,
  PlayerRecentMatch,
  PlayerStatLine,
  PlayerTrophy,
  PreGameComparison,
  SearchResults,
  ShotChart,
  SquadMember,
  Standing,
  Statistic,
  Team,
  TeamProfile,
} from './entities';

export interface SportDataProvider {
  // الصفحة الرئيسية (Phase 1.2) — بلا تغيير
  getFeaturedMatches(sportId: number, date: string, limit: number, priorityCompetitionIds: number[]): Promise<Match[]>;
  getCompetitions(sportId: number): Promise<Competition[]>;
  getPopularTeams(sportId: number): Promise<Team[]>;
  getMatchesByCountry(sportId: number, date: string): Promise<Country[]>;
  getTopScorers(competitionIds: number[]): Promise<Statistic[]>;

  // صفحات التفصيل (Phase 1.4 §34) — كل دالة تفويض رقيق واحد، بلا تجميع هنا (التجميع في application/*)
  getMatchDetail(externalId: number): Promise<MatchDetail | null>;
  getCompetitionProfile(externalId: number): Promise<CompetitionProfile | null>;
  getCompetitionRoster(externalId: number): Promise<CompetitionRoster[]>;
  getStandings(externalId: number): Promise<Standing | null>;
  getTeamProfile(externalId: number): Promise<TeamProfile | null>;
  getTeamSquad(externalId: number): Promise<SquadMember[]>;
  getPlayerProfile(externalId: number): Promise<Player | null>;
  getPlayerStats(externalId: number, competitionId: number): Promise<PlayerStatLine[]>;

  // Phase 1.4 Step 1 Round 2 — إضافة بعد أن كشف الوصل الفعليّ للصفحات أنّ الجولة الأولى غير
  // كافية (§34 محدَّثة). صفحة البطولة (7):
  getCompetitionGamesList(externalId: number, limit?: number): Promise<CompetitionFixtures>;
  getCompetitionMatchListing(externalId: number): Promise<CompetitionMatchListing>;
  getCompetitionStatsSummary(externalId: number, limit?: number): Promise<CompetitionStatsSummary | null>;
  getCompetitionHistory(externalId: number): Promise<CompetitionChampion[]>;
  getCompetitionBrackets(externalId: number): Promise<CompetitionBracketStage[]>;
  getCompetitionInsights(externalId: number): Promise<CompetitionInsightsSummary | null>;
  getFixtureTrends(gameId: number): Promise<FixtureTrend[]>;

  // صفحة المباراة (5):
  getMatchStats(gameId: number): Promise<MatchStatRow[]>;
  getPreGameComparison(gameId: number): Promise<PreGameComparison | null>;
  getMatchTrendsSummary(gameId: number): Promise<MatchTrendsSummary | null>;
  getHeadToHead(gameId: number): Promise<HeadToHead | null>;
  getShotChart(gameId: number): Promise<ShotChart | null>;

  // صفحة اللاعب (3):
  getPlayerRecentMatches(athleteId: number, limit?: number): Promise<PlayerRecentMatch[]>;
  getPlayerCareer(athleteId: number): Promise<PlayerCareer>;
  getPlayerTrophies(athleteId: number, competitions: Array<{ id: number; name: string }>): Promise<PlayerTrophy[]>;

  // Sprint 1.6 Phase 3 (Search) — بطولات/فرق/لاعبون فقط، راجع domain/entities.ts للسبب.
  searchSport(query: string, sportId: number): Promise<SearchResults>;
}
