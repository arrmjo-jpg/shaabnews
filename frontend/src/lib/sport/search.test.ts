import { describe, expect, it, vi } from 'vitest';
import { searchSport } from './search';

function mockFetchOnce(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })),
  );
}

// عيّنة مبنيّة على استجابة حيّة فعليّة (query=real madrid، 2026-07-25) — حقول مختصرة لما يُستهلَك هنا فقط.
const LIVE_SHAPED_PAYLOAD = {
  sports: [{ id: 1, name: 'كرة قدم' }],
  countries: [{ id: 2, name: 'إسبانيا' }],
  competitions: [
    { id: 7, name: 'الدوري الإنجليزي', sportId: 1, countryId: 1, imageVersion: 12 },
    { id: 99, name: 'دوري كرة سلة أخرى', sportId: 2, countryId: 5, imageVersion: 3 },
  ],
  competitors: [
    { id: 131, name: 'ريال مدريد', sportId: 1, countryId: 2, imageVersion: 10 },
    { id: 204, name: 'ريال مدريد', sportId: 2, countryId: 2, imageVersion: 2 },
  ],
  athletes: [
    { id: 817, name: 'كريستيانو رونالدو', sportId: 1, clubName: 'النصر', imageVersion: 61 },
  ],
};

describe('searchSport — بحث كيانات الرياضة (365Scores العامّ)', () => {
  it('يُرجع نتيجة فارغة لاستعلام فارغ دون أي طلب شبكة', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await searchSport('   ');

    expect(result).toEqual({ competitions: [], teams: [], players: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('يُرجع نتيجة فارغة عند فشل الشبكة أو استجابة غير متوقّعة (لا تلفيق)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 500 })));

    await expect(searchSport('ronaldo')).resolves.toEqual({ competitions: [], teams: [], players: [] });
  });

  it('يستخرج البطولات/الفرق/اللاعبين فقط، ويُرشِّح حسب sportId (كرة قدم افتراضيًّا)', async () => {
    mockFetchOnce(LIVE_SHAPED_PAYLOAD);

    const result = await searchSport('real madrid');

    // الدوري الإنجليزي (sportId=1) فقط — دوري كرة السلة (sportId=2) مُستبعَد.
    expect(result.competitions).toEqual([
      { id: 7, name: 'الدوري الإنجليزي', logo: expect.stringContaining('/Competitions/7') },
    ]);
    // ريال مدريد كرة القدم فقط — نسخة كرة السلة (sportId=2) مُستبعَدة.
    expect(result.teams).toEqual([
      { id: 131, name: 'ريال مدريد', logo: expect.stringContaining('/Competitors/131') },
    ]);
    expect(result.players).toEqual([
      { id: 817, name: 'كريستيانو رونالدو', club: 'النصر', photo: expect.stringContaining('/Athletes/817') },
    ]);
  });

  it('لا يحتوي على أي حقل مباريات/games — البحث لا يدعم ذلك عند هذه النقطة (مؤكَّد حيًّا)', async () => {
    mockFetchOnce(LIVE_SHAPED_PAYLOAD);

    const result = await searchSport('real madrid');

    expect(result).not.toHaveProperty('matches');
    expect(result).not.toHaveProperty('games');
  });
});
