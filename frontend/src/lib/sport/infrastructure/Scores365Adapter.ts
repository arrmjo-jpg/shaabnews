// المحوّل (Adapter) الوحيد المتوفر اليوم — تفويض رقيق فقط إلى games.ts/stats.ts، بلا أي تعديل
// عليهما. أي فشل شبكي/تحليلي يبقى يُعامَل هناك بنفس الاتفاقية الحالية (null/[] بلا استثناء).
import { getCompetitions, getFeaturedMatches, getGameDetail, getMatchesByCountry, getPopularTeams } from '../games';
import { getPlayer, getPlayerStats, getTeamSquad } from '../player';
import { getCompetitionMeta, getCompetitionTeams, getStandings, getTeam, getTopScorers } from '../stats';
import type { SportDataProvider } from '../domain/SportDataProvider';

export class Scores365Adapter implements SportDataProvider {
  getFeaturedMatches(sportId: number, date: string, limit: number, priorityCompetitionIds: number[]) {
    return getFeaturedMatches(sportId, date, limit, priorityCompetitionIds);
  }

  getCompetitions(sportId: number) {
    return getCompetitions(sportId);
  }

  getPopularTeams(sportId: number) {
    return getPopularTeams(sportId);
  }

  getMatchesByCountry(sportId: number, date: string) {
    return getMatchesByCountry(sportId, date);
  }

  getTopScorers(competitionIds: number[]) {
    return getTopScorers(competitionIds);
  }

  getMatchDetail(externalId: number) {
    return getGameDetail(externalId);
  }

  getCompetitionProfile(externalId: number) {
    return getCompetitionMeta(externalId);
  }

  getCompetitionRoster(externalId: number) {
    return getCompetitionTeams(externalId);
  }

  getStandings(externalId: number) {
    return getStandings(externalId);
  }

  getTeamProfile(externalId: number) {
    return getTeam(externalId);
  }

  getTeamSquad(externalId: number) {
    return getTeamSquad(externalId);
  }

  getPlayerProfile(externalId: number) {
    return getPlayer(externalId);
  }

  getPlayerStats(externalId: number, competitionId: number) {
    return getPlayerStats(externalId, competitionId);
  }
}
