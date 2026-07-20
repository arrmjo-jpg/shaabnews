// بديل اختبار (test double) لواجهة SportDataProvider — يسمح لاختبارات طبقة الـ Application
// بالعمل ضدّ الواجهة مباشرة، بلا أي تمويه لـ fetch وبلا أي اتصال فعلي بـ Scores365Adapter/365Scores.
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
}

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
}
