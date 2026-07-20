import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFreshnessStore } from '../freshness';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';
import type { CompetitionProfile, HeadToHead, MatchDetail } from '../../domain/entities';

const match = { id: 4773214, competitionId: 649 } as unknown as MatchDetail;
const competitionMeta: CompetitionProfile = { id: 649, name: 'الدوري السعودي', logo: null, country: 'السعودية', hasStats: true, hasHistory: true, hasBrackets: false, hasStandings: true };
const h2h = { homeTeam: { id: 1, name: 'أ', logo: null }, awayTeam: { id: 2, name: 'ب', logo: null }, record: null, meetings: [], forms: [] } satisfies HeadToHead;

function makeMock() {
  return new MockSportDataProvider({ matchDetail: match, competitionProfile: competitionMeta, headToHead: h2h });
}

let mockProvider = makeMock();

vi.mock('../../infrastructure/SportProviderResolver', () => ({
  SportProviderResolver: vi.fn(() => mockProvider),
}));

const { getMatchPageData } = await import('./getMatchPageData');

beforeEach(() => {
  resetFreshnessStore();
  mockProvider = makeMock();
});

describe('getMatchPageData', () => {
  it('تبويب overview: يجلب standings/shotMap/h2h، ليس stats/trends', async () => {
    const result = await getMatchPageData('365scores', 4773214, { tab: 'overview' });
    expect(result.data.match).toEqual(match);
    expect(result.data.competitionMeta).toEqual(competitionMeta);
    expect(result.data.h2h).toEqual(h2h);
    expect(result.data.stats).toEqual([]);
    expect(result.data.trends).toBeNull();
    expect(result.freshness).toBe('fresh');
  });

  it('تبويب stats: يجلب stats/preGame فقط دون standings/shotMap/h2h/trends', async () => {
    const result = await getMatchPageData('365scores', 4773214, { tab: 'stats' });
    expect(result.data.standings).toBeNull();
    expect(result.data.shotMap).toBeNull();
    expect(result.data.h2h).toBeNull();
    expect(result.data.trends).toBeNull();
  });

  it('تبويب h2h: يجلب h2h فقط من بين الحقول الشرطية', async () => {
    const result = await getMatchPageData('365scores', 4773214, { tab: 'h2h' });
    expect(result.data.h2h).toEqual(h2h);
    expect(result.data.standings).toBeNull();
  });

  it('يُعيد آخر مباراة ناجحة (stale) عند فشل لاحق لنفس التبويب', async () => {
    await getMatchPageData('365scores', 4773214, { tab: 'overview' });
    mockProvider = new MockSportDataProvider({ matchDetail: null });
    const second = await getMatchPageData('365scores', 4773214, { tab: 'overview' });
    expect(second.data.match).toEqual(match);
    expect(second.freshness).toBe('stale');
  });
});
