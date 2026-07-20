// DTOs للطبقة المجالية (Domain) — أسماء استعارة (aliases) على أفضل شكل موجود فعلاً لكل مفهوم،
// وليست أنواعاً جديدة. الهدف: عقد ثابت لا يتغيّر لو تغيّر الشكل الداخلي في games.ts/stats.ts/player.ts.
//
// Match = FeaturedMatch (وليس SportMatch) لأنه الشكل الذي تُرجعه getFeaturedMatches فعلاً،
// وهو ما تستهلكه getSportHomeData. SportMatch يخدم دوال أخرى غير مُستخدَمة في هذه المرحلة.
import type {
  CompetitionGames,
  CompetitionInsights,
  CompetitionItem,
  CompetitionMatchList,
  CountryMatchGroup,
  FeaturedMatch,
  GameDetail,
  H2H,
  MatchStat,
  MatchTrends,
  PreGameStats,
  ShotMap,
  SportMatch,
  TeamItem,
  TrendLine,
} from '../games';
import type { PlayerCareerData, PlayerGame, PlayerProfile, PlayerStat, SquadPlayer, TrophyGroup } from '../player';
import type { BracketStageView, ChampionRow, CompetitionMeta, CompetitionStats, ScorerCompetition, Standings, TeamLite, TeamPage } from '../stats';

export type Match = FeaturedMatch;
export type Competition = CompetitionItem;
export type Team = TeamItem;
export type Country = CountryMatchGroup;
export type Statistic = ScorerCompetition;
export type Player = PlayerProfile;
export type Standing = Standings;

// Phase 1.4 §34 — Domain aliases for the 4 detail-page entity types (Provider Contract additions).
// Same "Step 1: promote existing shapes" policy as the home-page aliases above (§35 DTO Mapping
// Policy) — these stay distinct Domain names even though they're type-identical to their provider
// source today, so a future second provider or "Step 2" consolidation never requires hunting
// through every component that imports them.
export type MatchDetail = GameDetail;
export type CompetitionProfile = CompetitionMeta;
export type CompetitionRoster = TeamLite;
export type TeamProfile = TeamPage;
export type SquadMember = SquadPlayer;
export type PlayerStatLine = PlayerStat;

// Phase 1.4 Step 1 (Round 2) — extended once real page-wiring proved the first pass (§34 update,
// commit 3784714d0a) covered too little: these 16 additional aliases are what the 4 live detail
// pages actually consume, verified by reading every one of them (competition/match/team/player)
// before adding a single method — not assumed from a generic "what a detail page might need".
export type MatchListItem = SportMatch;
export type CompetitionFixtures = CompetitionGames;
export type CompetitionMatchListing = CompetitionMatchList;
export type FixtureTrend = TrendLine;
export type MatchStatRow = MatchStat;
export type PreGameComparison = PreGameStats;
export type MatchTrendsSummary = MatchTrends;
export type HeadToHead = H2H;
export type ShotChart = ShotMap;
export type CompetitionInsightsSummary = CompetitionInsights;
export type CompetitionStatsSummary = CompetitionStats;
export type CompetitionChampion = ChampionRow;
export type CompetitionBracketStage = BracketStageView;
export type PlayerRecentMatch = PlayerGame;
export type PlayerCareer = PlayerCareerData;
export type PlayerTrophy = TrophyGroup;

// لا شكل مطابق موجود اليوم — بديل أدنى (stub) غير مُستخدَم بعد، حتى تحتاجه حالة استخدام لاحقة.
export interface Season {
  number: number;
  label?: string;
}
