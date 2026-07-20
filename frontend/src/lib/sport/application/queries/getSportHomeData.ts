// Query/Use Case الوحيد لهذه المرحلة — يُعيد إنتاج شكل Promise.all الحالي في sport-section.tsx
// تماماً، لكن عبر SportProviderService بدل استدعاء games.ts/stats.ts مباشرة. غير مستورَد بعد من
// أي صفحة/مكوّن فعلي (Rule: no Frontend wiring in this phase) — إثبات أن المكدّس الجديد قادر
// على القيام بمكان الحالي، دون استبداله بعد.
import type { Competition, Country, Match, Statistic, Team } from '../../domain/entities';
import { resolveSportProvider, type SportCategoryRef } from '../SportProviderService';

export interface SportHomeData {
  featured: Match[];
  competitions: Competition[];
  teams: Team[];
  countries: Country[];
  scorers: Statistic[];
}

export async function getSportHomeData(
  category: SportCategoryRef,
  date: string,
  scorerIds: number[],
  featuredPriority: number[],
): Promise<SportHomeData> {
  const { provider, externalId } = resolveSportProvider(category);
  const [featured, competitions, teams, countries, scorers] = await Promise.all([
    provider.getFeaturedMatches(externalId, date, 8, featuredPriority),
    provider.getCompetitions(externalId),
    provider.getPopularTeams(externalId),
    provider.getMatchesByCountry(externalId, date),
    provider.getTopScorers(scorerIds),
  ]);
  return { featured, competitions, teams, countries, scorers };
}
