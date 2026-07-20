import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFreshnessStore } from '../freshness';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';
import type { Player, PlayerCareer, PlayerStatLine, SquadMember } from '../../domain/entities';

const profile: Player = {
  id: 1,
  name: 'لاعب',
  photo: null,
  position: null,
  nationality: null,
  age: null,
  club: { id: 10, name: 'النادي', logo: null },
  nationalTeam: null,
  teams: [],
  competitions: [{ id: 649, name: 'الدوري السعودي', logo: null }],
};
const stats: PlayerStatLine[] = [{ label: 'أهداف', value: '10' }];
const career: PlayerCareer = { sections: [], competitions: [{ id: 649, name: 'الدوري السعودي' }] };
const squad: SquadMember[] = [
  { id: 1, name: 'لاعب', photo: null, jersey: 9, position: 'مهاجم', height: null, birthdate: null },
  { id: 2, name: 'زميل', photo: null, jersey: 7, position: 'وسط', height: null, birthdate: null },
];

function makeMock() {
  return new MockSportDataProvider({
    playerProfile: profile,
    playerStats: stats,
    playerRecentMatches: [],
    teamSquad: squad,
    playerCareer: career,
    playerTrophies: [{ competition: 'الدوري السعودي', count: 2, columns: [], rows: [] }],
  });
}

let mockProvider = makeMock();

vi.mock('../../infrastructure/SportProviderResolver', () => ({
  SportProviderResolver: vi.fn(() => mockProvider),
}));

const { getPlayerPageData } = await import('./getPlayerPageData');

beforeEach(() => {
  resetFreshnessStore();
  mockProvider = makeMock();
});

describe('getPlayerPageData', () => {
  it('تبويب profile: يجمع كل الحقول ويفصل self عن teammates من نفس نداء التشكيلة', async () => {
    const result = await getPlayerPageData('365scores', 1, { tab: 'profile' });
    expect(result.data.profile).toEqual(profile);
    expect(result.data.self?.id).toBe(1);
    expect(result.data.teammates.map((t) => t.id)).toEqual([2]);
    expect(result.data.career).toEqual(career);
    expect(result.data.trophies).toHaveLength(1);
    expect(result.freshness).toBe('fresh');
  });

  it('تبويب matches: لا يجلب career ولا trophies (غير محتاجة لهذا التبويب)', async () => {
    const result = await getPlayerPageData('365scores', 1, { tab: 'matches' });
    expect(result.data.career).toEqual({ sections: [], competitions: [] });
    expect(result.data.trophies).toEqual([]);
  });

  it('تبويب stats: يجلب الإحصاء فقط دون المباريات/التشكيلة/المسيرة', async () => {
    const result = await getPlayerPageData('365scores', 1, { tab: 'stats' });
    expect(result.data.stats).toEqual(stats);
    expect(result.data.lastMatches).toEqual([]);
  });

  it('لا يستدعي getPlayerStats عندما لا يوجد competitionId', async () => {
    mockProvider = new MockSportDataProvider({ playerProfile: { ...profile, competitions: [] }, playerStats: stats });
    const result = await getPlayerPageData('365scores', 1, { tab: 'stats' });
    expect(result.data.stats).toEqual([]);
  });

  it('يُعيد آخر نسخة ناجحة (stale) عند فشل لاحق', async () => {
    await getPlayerPageData('365scores', 1, { tab: 'profile' });
    mockProvider = new MockSportDataProvider({ playerProfile: null });
    const second = await getPlayerPageData('365scores', 1, { tab: 'profile' });
    expect(second.data.profile).toEqual(profile);
    expect(second.freshness).toBe('stale');
  });
});
