// DTOs للطبقة المجالية (Domain) — أسماء استعارة (aliases) على أفضل شكل موجود فعلاً لكل مفهوم،
// وليست أنواعاً جديدة. الهدف: عقد ثابت لا يتغيّر لو تغيّر الشكل الداخلي في games.ts/stats.ts/player.ts.
//
// Match = FeaturedMatch (وليس SportMatch) لأنه الشكل الذي تُرجعه getFeaturedMatches فعلاً،
// وهو ما تستهلكه getSportHomeData. SportMatch يخدم دوال أخرى غير مُستخدَمة في هذه المرحلة.
import type { CompetitionItem, CountryMatchGroup, FeaturedMatch, GameDetail, TeamItem } from '../games';
import type { PlayerProfile, PlayerStat, SquadPlayer } from '../player';
import type { CompetitionMeta, ScorerCompetition, Standings, TeamLite, TeamPage } from '../stats';

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

// لا شكل مطابق موجود اليوم — بديل أدنى (stub) غير مُستخدَم بعد، حتى تحتاجه حالة استخدام لاحقة.
export interface Season {
  number: number;
  label?: string;
}
