// بديل اختبار (test double) لواجهة SportDataProvider — يسمح لاختبارات طبقة الـ Application
// بالعمل ضدّ الواجهة مباشرة، بلا أي تمويه لـ fetch وبلا أي اتصال فعلي بـ Scores365Adapter/365Scores.
import type { Competition, Country, Match, Statistic, Team } from '../domain/entities';
import type { SportDataProvider } from '../domain/SportDataProvider';

export interface MockSportDataProviderCanned {
  featuredMatches?: Match[];
  competitions?: Competition[];
  popularTeams?: Team[];
  matchesByCountry?: Country[];
  topScorers?: Statistic[];
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
}
