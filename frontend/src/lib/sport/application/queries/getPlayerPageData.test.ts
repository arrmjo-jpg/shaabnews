import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFreshnessStore } from '../freshness';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';
import type { Player, PlayerStatLine } from '../../domain/entities';

const profile: Player = {
  id: 1,
  name: 'لاعب',
  photo: null,
  position: null,
  nationality: null,
  age: null,
  club: null,
  nationalTeam: null,
  teams: [],
  competitions: [{ id: 649, name: 'الدوري السعودي', logo: null }],
};
const stats: PlayerStatLine[] = [{ label: 'أهداف', value: '10' }];

let mockProvider = new MockSportDataProvider({ playerProfile: profile, playerStats: stats });

vi.mock('../../infrastructure/SportProviderResolver', () => ({
  SportProviderResolver: vi.fn(() => mockProvider),
}));

const { getPlayerPageData } = await import('./getPlayerPageData');

beforeEach(() => {
  resetFreshnessStore();
  mockProvider = new MockSportDataProvider({ playerProfile: profile, playerStats: stats });
});

describe('getPlayerPageData', () => {
  it('يجلب البروفايل ثمّ إحصاء أول بطولة فيه (تسلسليّ، ليس حلقة)', async () => {
    const result = await getPlayerPageData('365scores', 1);
    expect(result.data.profile).toEqual(profile);
    expect(result.data.stats).toEqual(stats);
    expect(result.freshness).toBe('fresh');
  });

  it('لا يستدعي getPlayerStats عندما لا توجد بطولات للاعب', async () => {
    mockProvider = new MockSportDataProvider({ playerProfile: { ...profile, competitions: [] }, playerStats: stats });
    const result = await getPlayerPageData('365scores', 1);
    expect(result.data.stats).toEqual([]);
  });

  it('يُعيد آخر نسخة ناجحة (stale) عند فشل لاحق', async () => {
    await getPlayerPageData('365scores', 1);
    mockProvider = new MockSportDataProvider({ playerProfile: null, playerStats: [] });
    const second = await getPlayerPageData('365scores', 1);
    expect(second.data.profile).toEqual(profile);
    expect(second.freshness).toBe('stale');
  });
});
