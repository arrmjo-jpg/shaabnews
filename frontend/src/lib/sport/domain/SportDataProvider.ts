// الـ Port (Ports & Adapters): العقد الوحيد الذي تعتمد عليه طبقة الـ Application — لا تستورد
// أي كود Infrastructure مباشرة. النطاق مقصود ومحدود بما تحتاجه getSportHomeData اليوم فقط
// (يطابق Promise.all الحالي في sport-section.tsx)، وليس تغطية كاملة لكل استعلامات 365Scores.
import type { Competition, Country, Match, Statistic, Team } from './entities';

export interface SportDataProvider {
  getFeaturedMatches(sportId: number, date: string, limit: number, priorityCompetitionIds: number[]): Promise<Match[]>;
  getCompetitions(sportId: number): Promise<Competition[]>;
  getPopularTeams(sportId: number): Promise<Team[]>;
  getMatchesByCountry(sportId: number, date: string): Promise<Country[]>;
  getTopScorers(competitionIds: number[]): Promise<Statistic[]>;
}
