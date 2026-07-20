import { describe, expect, it, vi } from 'vitest';
import type { Match } from '../../domain/entities';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';

// يعزل هذا الاختبار عن SportProviderResolver/Scores365Adapter تماماً: resolveSportProvider
// مُموَّه ليُعيد MockSportDataProvider مباشرة، فلا يبقى أي مسار ممكن نحو fetch أو 365Scores الحقيقي.
const mockProvider = new MockSportDataProvider({
  featuredMatches: [{ id: 1 } as unknown as Match],
});

vi.mock('../SportProviderService', () => ({
  resolveSportProvider: vi.fn(() => ({ provider: mockProvider, externalId: 1 })),
}));

const { getSportHomeData } = await import('./getSportHomeData');

describe('getSportHomeData', () => {
  it('يُنتج نفس شكل البيانات الذي يجمّعه sport-section.tsx اليوم (featured/competitions/teams/countries/scorers)', async () => {
    const result = await getSportHomeData({ provider: '365scores', external_id: '1' }, '2026-07-20', [], []);

    expect(result).toEqual({
      featured: [{ id: 1 }],
      competitions: [],
      teams: [],
      countries: [],
      scorers: [],
    });
  });
});
