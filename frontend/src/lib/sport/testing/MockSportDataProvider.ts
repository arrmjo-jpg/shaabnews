// بديل اختبار (test double) لواجهة SportDataProvider — يسمح لاختبارات طبقة الـ Application
// بالعمل ضدّ الواجهة مباشرة، بلا أي تمويه لـ fetch وبلا أي اتصال فعلي بـ Scores365Adapter/365Scores.
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
  ShotChart,
  SquadMember,
  Standing,
  Statistic,
  Team,
  TeamProfile,
} from '../domain/entities';
import type { SportDataProvider } from '../domain/SportDataProvider';

export interface MockSportDataProviderCanned {
  featuredMatches?: Match[];
  competitions?: Competition[];
  popularTeams?: Team[];
  matchesByCountry?: Country[];
  topScorers?: Statistic[];
  matchDetail?: MatchDetail | null;
  competitionProfile?: CompetitionProfile | null;
  competitionRoster?: CompetitionRoster[];
  standings?: Standing | null;
  teamProfile?: TeamProfile | null;
  teamSquad?: SquadMember[];
  playerProfile?: Player | null;
  playerStats?: PlayerStatLine[];
  competitionGamesList?: CompetitionFixtures;
  competitionMatchListing?: CompetitionMatchListing;
  competitionStatsSummary?: CompetitionStatsSummary | null;
  competitionHistory?: CompetitionChampion[];
  competitionBrackets?: CompetitionBracketStage[];
  competitionInsights?: CompetitionInsightsSummary | null;
  fixtureTrends?: FixtureTrend[];
  matchStats?: MatchStatRow[];
  preGameComparison?: PreGameComparison | null;
  matchTrendsSummary?: MatchTrendsSummary | null;
  headToHead?: HeadToHead | null;
  shotChart?: ShotChart | null;
  playerRecentMatches?: PlayerRecentMatch[];
  playerCareer?: PlayerCareer;
  playerTrophies?: PlayerTrophy[];
}

const EMPTY_COMPETITION_FIXTURES: CompetitionFixtures = { fixtures: [], results: [] };
const EMPTY_MATCH_LISTING: CompetitionMatchListing = { today: [], upcoming: [], recent: [], fixtures: [], results: [] };
const EMPTY_PLAYER_CAREER: PlayerCareer = { sections: [], competitions: [] };

export class MockSportDataProvider implements SportDataProvider {
  constructor(private readonly canned: MockSportDataProviderCanned = {}) {}

  async getFeaturedMatches(): Promise<Match[]> {
    return this.canned.featuredMatches ?? [];
  }

  async getCompetitions(): Promise<Competition[]> {
    return this.canned.competitions ?? [];
  }

  async getPopularTeams(): Promise<Team[]> {
    return this.canned.popularTeams ?? [];
  }

  async getMatchesByCountry(): Promise<Country[]> {
    return this.canned.matchesByCountry ?? [];
  }

  async getTopScorers(): Promise<Statistic[]> {
    return this.canned.topScorers ?? [];
  }

  async getMatchDetail(): Promise<MatchDetail | null> {
    return this.canned.matchDetail ?? null;
  }

  async getCompetitionProfile(): Promise<CompetitionProfile | null> {
    return this.canned.competitionProfile ?? null;
  }

  async getCompetitionRoster(): Promise<CompetitionRoster[]> {
    return this.canned.competitionRoster ?? [];
  }

  async getStandings(): Promise<Standing | null> {
    return this.canned.standings ?? null;
  }

  async getTeamProfile(): Promise<TeamProfile | null> {
    return this.canned.teamProfile ?? null;
  }

  async getTeamSquad(): Promise<SquadMember[]> {
    return this.canned.teamSquad ?? [];
  }

  async getPlayerProfile(): Promise<Player | null> {
    return this.canned.playerProfile ?? null;
  }

  async getPlayerStats(): Promise<PlayerStatLine[]> {
    return this.canned.playerStats ?? [];
  }

  async getCompetitionGamesList(): Promise<CompetitionFixtures> {
    return this.canned.competitionGamesList ?? EMPTY_COMPETITION_FIXTURES;
  }

  async getCompetitionMatchListing(): Promise<CompetitionMatchListing> {
    return this.canned.competitionMatchListing ?? EMPTY_MATCH_LISTING;
  }

  async getCompetitionStatsSummary(): Promise<CompetitionStatsSummary | null> {
    return this.canned.competitionStatsSummary ?? null;
  }

  async getCompetitionHistory(): Promise<CompetitionChampion[]> {
    return this.canned.competitionHistory ?? [];
  }

  async getCompetitionBrackets(): Promise<CompetitionBracketStage[]> {
    return this.canned.competitionBrackets ?? [];
  }

  async getCompetitionInsights(): Promise<CompetitionInsightsSummary | null> {
    return this.canned.competitionInsights ?? null;
  }

  async getFixtureTrends(): Promise<FixtureTrend[]> {
    return this.canned.fixtureTrends ?? [];
  }

  async getMatchStats(): Promise<MatchStatRow[]> {
    return this.canned.matchStats ?? [];
  }

  async getPreGameComparison(): Promise<PreGameComparison | null> {
    return this.canned.preGameComparison ?? null;
  }

  async getMatchTrendsSummary(): Promise<MatchTrendsSummary | null> {
    return this.canned.matchTrendsSummary ?? null;
  }

  async getHeadToHead(): Promise<HeadToHead | null> {
    return this.canned.headToHead ?? null;
  }

  async getShotChart(): Promise<ShotChart | null> {
    return this.canned.shotChart ?? null;
  }

  async getPlayerRecentMatches(): Promise<PlayerRecentMatch[]> {
    return this.canned.playerRecentMatches ?? [];
  }

  async getPlayerCareer(): Promise<PlayerCareer> {
    return this.canned.playerCareer ?? EMPTY_PLAYER_CAREER;
  }

  async getPlayerTrophies(): Promise<PlayerTrophy[]> {
    return this.canned.playerTrophies ?? [];
  }
}
