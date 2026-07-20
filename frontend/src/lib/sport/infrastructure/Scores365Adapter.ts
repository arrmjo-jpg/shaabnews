// المحوّل (Adapter) الوحيد المتوفر اليوم — تفويض رقيق فقط إلى games.ts/stats.ts، بلا أي تعديل
// عليهما. أي فشل شبكي/تحليلي يبقى يُعامَل هناك بنفس الاتفاقية الحالية (null/[] بلا استثناء).
import {
  getCompetitionGames,
  getCompetitionInsights,
  getCompetitionMatchList,
  getCompetitions,
  getFeaturedMatches,
  getGameDetail,
  getGameStats,
  getGameTrends,
  getH2H,
  getMatchesByCountry,
  getMatchTrends,
  getPopularTeams,
  getPreGameStats,
  getShotMap,
} from '../games';
import { getPlayer, getPlayerCareerData, getPlayerLastMatches, getPlayerStats, getPlayerTrophies, getTeamSquad } from '../player';
import {
  getCompetitionBrackets,
  getCompetitionHistory,
  getCompetitionMeta,
  getCompetitionStats,
  getCompetitionTeams,
  getStandings,
  getTeam,
  getTopScorers,
} from '../stats';
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

  getCompetitionGamesList(externalId: number, limit?: number) {
    return limit === undefined ? getCompetitionGames(externalId) : getCompetitionGames(externalId, limit);
  }

  getCompetitionMatchListing(externalId: number) {
    return getCompetitionMatchList(externalId);
  }

  getCompetitionStatsSummary(externalId: number, limit?: number) {
    return limit === undefined ? getCompetitionStats(externalId) : getCompetitionStats(externalId, limit);
  }

  getCompetitionHistory(externalId: number) {
    return getCompetitionHistory(externalId);
  }

  getCompetitionBrackets(externalId: number) {
    return getCompetitionBrackets(externalId);
  }

  getCompetitionInsights(externalId: number) {
    return getCompetitionInsights(externalId);
  }

  getFixtureTrends(gameId: number) {
    return getGameTrends(gameId);
  }

  getMatchStats(gameId: number) {
    return getGameStats(gameId);
  }

  getPreGameComparison(gameId: number) {
    return getPreGameStats(gameId);
  }

  getMatchTrendsSummary(gameId: number) {
    return getMatchTrends(gameId);
  }

  getHeadToHead(gameId: number) {
    return getH2H(gameId);
  }

  getShotChart(gameId: number) {
    return getShotMap(gameId);
  }

  getPlayerRecentMatches(athleteId: number, limit?: number) {
    return limit === undefined ? getPlayerLastMatches(athleteId) : getPlayerLastMatches(athleteId, limit);
  }

  getPlayerCareer(athleteId: number) {
    return getPlayerCareerData(athleteId);
  }

  getPlayerTrophies(athleteId: number, competitions: Array<{ id: number; name: string }>) {
    return getPlayerTrophies(athleteId, competitions);
  }
}
