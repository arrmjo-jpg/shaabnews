import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFreshnessStore } from '../freshness';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';
import type { CompetitionFixtures, CompetitionProfile, MatchListItem } from '../../domain/entities';

const profile: CompetitionProfile = { id: 649, name: 'الدوري السعودي', logo: null, country: 'السعودية', hasStats: true, hasHistory: true, hasBrackets: false, hasStandings: true };
const side = { name: 'أ', score: null, color: null, logo: null };
const fixture: MatchListItem = { id: 1, kind: 'upcoming', statusText: null, minute: null, startTime: '2026-08-01', home: side, away: side };
const games: CompetitionFixtures = { fixtures: [fixture], results: [] };

function makeMock() {
  return new MockSportDataProvider({
    competitionProfile: profile,
    competitionGamesList: games,
    fixtureTrends: [{ text: 'اتجاه', percentage: 90 }],
    matchDetail: { id: 1 } as never,
  });
}

let mockProvider = makeMock();

vi.mock('../../infrastructure/SportProviderResolver', () => ({
  SportProviderResolver: vi.fn(() => mockProvider),
}));

const { getCompetitionPageData } = await import('./getCompetitionPageData');

beforeEach(() => {
  resetFreshnessStore();
  mockProvider = makeMock();
});

describe('getCompetitionPageData', () => {
  it('تبويب overview: يجلب standings/history لأن meta.hasStandings/hasHistory=true، ويبني trendCards من قائمة محدودة', async () => {
    const result = await getCompetitionPageData('365scores', 649, { tab: 'overview' });
    expect(result.data.meta).toEqual(profile);
    expect(result.data.games).toEqual(games);
    expect(result.data.featured).toEqual({ id: 1 });
    expect(result.data.trendCards).toHaveLength(1);
    expect(result.data.trendCards[0].match.id).toBe(1);
    expect(result.freshness).toBe('fresh');
  });

  it('تبويب standings: يجلب standings فقط دون games/stats/champions', async () => {
    const result = await getCompetitionPageData('365scores', 649, { tab: 'standings' });
    expect(result.data.games).toBeNull();
    expect(result.data.stats).toBeNull();
    expect(result.data.champions).toEqual([]);
    expect(result.data.trendCards).toEqual([]);
  });

  it('تبويب brackets: يجلب brackets فقط', async () => {
    mockProvider = new MockSportDataProvider({ competitionProfile: profile, competitionBrackets: [{ round: 'النهائي', matches: [] } as never] });
    const result = await getCompetitionPageData('365scores', 649, { tab: 'brackets' });
    expect(result.data.brackets).toHaveLength(1);
  });

  it('يُعيد آخر meta ناجح (stale) عند فشل لاحق لنفس التبويب', async () => {
    await getCompetitionPageData('365scores', 649, { tab: 'overview' });
    mockProvider = new MockSportDataProvider({ competitionProfile: null });
    const second = await getCompetitionPageData('365scores', 649, { tab: 'overview' });
    expect(second.data.meta).toEqual(profile);
    expect(second.freshness).toBe('stale');
  });
});
