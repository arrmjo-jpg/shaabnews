// الـ Port (Ports & Adapters): العقد الوحيد الذي تعتمد عليه طبقة الـ Application — لا تستورد
// أي كود Infrastructure مباشرة. النطاق الأصليّ كان محدودًا بما تحتاجه getSportHomeData فقط؛
// Phase 1.4 (§34 Provider Contract) يوسّعه بما تحتاجه صفحات التفصيل الأربع (بطولة/مباراة/فريق/لاعب).
//
// قاعدة صارمة (§34): لا يجوز لأيّ صفحة Next.js أو مكوّن استيراد games.ts/stats.ts/player.ts
// مباشرة — المسموح فقط هذه الواجهة أو خدمات application/*.
import type {
  Competition,
  CompetitionProfile,
  CompetitionRoster,
  Country,
  Match,
  MatchDetail,
  Player,
  PlayerStatLine,
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
}
