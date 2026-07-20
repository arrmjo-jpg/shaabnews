import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFreshnessStore } from '../freshness';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';
import type { SquadMember, TeamProfile } from '../../domain/entities';

const profile: TeamProfile = { id: 1, name: 'الهلال', logo: null, country: 'السعودية', mainCompetitionId: 649, competitions: [] };
const squad: SquadMember[] = [{ id: 1, name: 'لاعب', photo: null, jersey: 10, position: 'مهاجم', height: null, birthdate: null }];

let mockProvider = new MockSportDataProvider({ teamProfile: profile, teamSquad: squad });

vi.mock('../../infrastructure/SportProviderResolver', () => ({
  SportProviderResolver: vi.fn(() => mockProvider),
}));

const { getTeamPageData } = await import('./getTeamPageData');

beforeEach(() => {
  resetFreshnessStore();
  mockProvider = new MockSportDataProvider({ teamProfile: profile, teamSquad: squad });
});

describe('getTeamPageData', () => {
  it('يجمّع profile/squad في استدعاء Application واحد (Promise.all، لا حلقة)', async () => {
    const result = await getTeamPageData('365scores', 1);
    expect(result.data.profile).toEqual(profile);
    expect(result.data.squad).toEqual(squad);
    expect(result.freshness).toBe('fresh');
  });

  it('يُعيد آخر نسخة ناجحة (stale) عند فشل لاحق', async () => {
    await getTeamPageData('365scores', 1);
    mockProvider = new MockSportDataProvider({ teamProfile: null, teamSquad: [] });
    const second = await getTeamPageData('365scores', 1);
    expect(second.data.profile).toEqual(profile);
    expect(second.freshness).toBe('stale');
  });
});
