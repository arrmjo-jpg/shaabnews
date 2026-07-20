import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFreshnessStore } from '../freshness';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';
import type { CompetitionProfile } from '../../domain/entities';

const profile = { id: 649, name: 'الدوري السعودي', logo: null, country: 'السعودية', hasStats: true, hasHistory: true, hasBrackets: false, hasStandings: true } satisfies CompetitionProfile;

let mockProvider = new MockSportDataProvider({ competitionProfile: profile });

vi.mock('../../infrastructure/SportProviderResolver', () => ({
  SportProviderResolver: vi.fn(() => mockProvider),
}));

const { getCompetitionPageData } = await import('./getCompetitionPageData');

beforeEach(() => {
  resetFreshnessStore();
  mockProvider = new MockSportDataProvider({ competitionProfile: profile });
});

describe('getCompetitionPageData', () => {
  it('يجمّع profile/standings/roster في استدعاء Application واحد', async () => {
    const result = await getCompetitionPageData('365scores', 649);

    expect(result.data.profile).toEqual(profile);
    expect(result.data.standings).toBeNull();
    expect(result.data.roster).toEqual([]);
    expect(result.freshness).toBe('fresh');
  });

  it('يُعيد آخر profile ناجح (stale) عند فشل لاحق', async () => {
    await getCompetitionPageData('365scores', 649);

    mockProvider = new MockSportDataProvider({ competitionProfile: null });
    const second = await getCompetitionPageData('365scores', 649);

    expect(second.data.profile).toEqual(profile);
    expect(second.freshness).toBe('stale');
  });
});
