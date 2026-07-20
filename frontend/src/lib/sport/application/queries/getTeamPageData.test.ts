import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFreshnessStore } from '../freshness';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';
import type { Standing, TeamProfile } from '../../domain/entities';

const profile: TeamProfile = { id: 1, name: 'الهلال', logo: null, country: 'السعودية', mainCompetitionId: 649, competitions: [] };
const standings = { competition: { id: 649, name: 'الدوري السعودي', logo: null }, rows: [], zones: [], groups: [] } satisfies Standing;

let mockProvider = new MockSportDataProvider({ teamProfile: profile, standings });

vi.mock('../../infrastructure/SportProviderResolver', () => ({
  SportProviderResolver: vi.fn(() => mockProvider),
}));

const { getTeamPageData } = await import('./getTeamPageData');

beforeEach(() => {
  resetFreshnessStore();
  mockProvider = new MockSportDataProvider({ teamProfile: profile, standings });
});

describe('getTeamPageData', () => {
  it('يجلب البروفايل ثمّ ترتيب دوريه الرئيس (تسلسليّ، يعتمد على mainCompetitionId)', async () => {
    const result = await getTeamPageData('365scores', 1);
    expect(result.data.profile).toEqual(profile);
    expect(result.data.standings).toEqual(standings);
    expect(result.freshness).toBe('fresh');
  });

  it('لا يجلب standings عندما لا يملك الفريق mainCompetitionId', async () => {
    mockProvider = new MockSportDataProvider({ teamProfile: { ...profile, mainCompetitionId: null }, standings });
    const result = await getTeamPageData('365scores', 1);
    expect(result.data.standings).toBeNull();
  });

  it('يُعيد آخر نسخة ناجحة (stale) عند فشل لاحق', async () => {
    await getTeamPageData('365scores', 1);
    mockProvider = new MockSportDataProvider({ teamProfile: null });
    const second = await getTeamPageData('365scores', 1);
    expect(second.data.profile).toEqual(profile);
    expect(second.freshness).toBe('stale');
  });
});
