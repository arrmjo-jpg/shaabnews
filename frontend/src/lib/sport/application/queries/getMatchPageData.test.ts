import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFreshnessStore } from '../freshness';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';
import type { MatchDetail } from '../../domain/entities';

const match = { id: 4773214 } as unknown as MatchDetail;

let mockProvider = new MockSportDataProvider({ matchDetail: match });

vi.mock('../../infrastructure/SportProviderResolver', () => ({
  SportProviderResolver: vi.fn(() => mockProvider),
}));

const { getMatchPageData } = await import('./getMatchPageData');

beforeEach(() => {
  resetFreshnessStore();
  mockProvider = new MockSportDataProvider({ matchDetail: match });
});

describe('getMatchPageData', () => {
  it('يعيد تفاصيل المباراة عبر استدعاء Provider واحد', async () => {
    const result = await getMatchPageData('365scores', 4773214);
    expect(result.data.match).toEqual(match);
    expect(result.freshness).toBe('fresh');
  });

  it('يُعيد آخر مباراة ناجحة (stale) عند فشل لاحق', async () => {
    await getMatchPageData('365scores', 4773214);
    mockProvider = new MockSportDataProvider({ matchDetail: null });
    const second = await getMatchPageData('365scores', 4773214);
    expect(second.data.match).toEqual(match);
    expect(second.freshness).toBe('stale');
  });
});
