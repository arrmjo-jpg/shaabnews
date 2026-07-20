// DTOs للطبقة المجالية (Domain) — أسماء استعارة (aliases) على أفضل شكل موجود فعلاً لكل مفهوم،
// وليست أنواعاً جديدة. الهدف: عقد ثابت لا يتغيّر لو تغيّر الشكل الداخلي في games.ts/stats.ts/player.ts.
//
// Match = FeaturedMatch (وليس SportMatch) لأنه الشكل الذي تُرجعه getFeaturedMatches فعلاً،
// وهو ما تستهلكه getSportHomeData. SportMatch يخدم دوال أخرى غير مُستخدَمة في هذه المرحلة.
import type { CompetitionItem, CountryMatchGroup, FeaturedMatch, TeamItem } from '../games';
import type { PlayerProfile } from '../player';
import type { ScorerCompetition, Standings } from '../stats';

export type Match = FeaturedMatch;
export type Competition = CompetitionItem;
export type Team = TeamItem;
export type Country = CountryMatchGroup;
export type Statistic = ScorerCompetition;
export type Player = PlayerProfile;
export type Standing = Standings;

// لا شكل مطابق موجود اليوم — بديل أدنى (stub) غير مُستخدَم بعد، حتى تحتاجه حالة استخدام لاحقة.
export interface Season {
  number: number;
  label?: string;
}
