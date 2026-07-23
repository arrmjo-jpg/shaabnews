import { describe, expect, it, vi } from 'vitest';
import { MockSportDataProvider } from '../../testing/MockSportDataProvider';
import type { SearchResults } from '../../domain/entities';

const results: SearchResults = {
  competitions: [{ id: 7, name: 'الدوري الإنجليزي', logo: null }],
  teams: [{ id: 131, name: 'ريال مدريد', logo: null }],
  players: [{ id: 817, name: 'كريستيانو رونالدو', club: 'النصر', photo: null }],
};

let mockProvider = new MockSportDataProvider({ searchResults: results });

vi.mock('../../infrastructure/SportProviderResolver', () => ({
  SportProviderResolver: vi.fn(() => mockProvider),
}));

const { getSportSearchResults } = await import('./getSportSearchResults');

describe('getSportSearchResults', () => {
  it('يمرّر query/sportId إلى المزوّد ويُعيد نتائجه كما هي', async () => {
    mockProvider = new MockSportDataProvider({ searchResults: results });
    const result = await getSportSearchResults('365scores', 'real madrid');
    expect(result).toEqual(results);
  });

  it('لا يوجد withFreshness — استعلام فاشل يُعيد نتيجة فارغة مباشرة، لا آخر قيمة ناجحة سابقة', async () => {
    mockProvider = new MockSportDataProvider({});
    const result = await getSportSearchResults('365scores', 'unknown query');
    expect(result).toEqual({ competitions: [], teams: [], players: [] });
  });
});
