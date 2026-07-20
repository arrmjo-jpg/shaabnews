import { describe, expect, it, vi } from 'vitest';
import { Scores365Adapter } from './Scores365Adapter';

// يثبّت fetch على استجابة عامة فارغة الشكل — الهدف هنا إثبات أن المحوّل يفوّض فعلياً إلى
// games.ts/stats.ts (وليس إعادة اختبار منطقهما الداخلي، فذلك مغطّى في games.test.ts). لا اتصال
// فعلي بـ 365Scores في أي وقت — fetch مُموَّه بالكامل.
function stubEmptyFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } })),
  );
}

describe('Scores365Adapter — تفويض رقيق إلى games.ts/stats.ts', () => {
  it('يطابق واجهة SportDataProvider ويُفوّض كل استدعاء دون رمي استثناء', async () => {
    stubEmptyFetch();
    const adapter = new Scores365Adapter();

    await expect(adapter.getFeaturedMatches(1, '2026-07-20', 8, [])).resolves.toEqual([]);
    await expect(adapter.getCompetitions(1)).resolves.toEqual([]);
    await expect(adapter.getPopularTeams(1)).resolves.toEqual([]);
    await expect(adapter.getMatchesByCountry(1, '2026-07-20')).resolves.toEqual([]);
    await expect(adapter.getTopScorers([])).resolves.toEqual([]);
  });

  it('يفوّض دوال صفحات التفصيل الأربع (Phase 1.4 §34) بنفس اتفاقية الفشل المغلَق', async () => {
    stubEmptyFetch();
    const adapter = new Scores365Adapter();

    await expect(adapter.getMatchDetail(1)).resolves.toBeNull();
    await expect(adapter.getCompetitionProfile(1)).resolves.toBeNull();
    await expect(adapter.getCompetitionRoster(1)).resolves.toEqual([]);
    await expect(adapter.getStandings(1)).resolves.toBeNull();
    await expect(adapter.getTeamProfile(1)).resolves.toBeNull();
    await expect(adapter.getTeamSquad(1)).resolves.toEqual([]);
    await expect(adapter.getPlayerProfile(1)).resolves.toBeNull();
    await expect(adapter.getPlayerStats(1, 1)).resolves.toEqual([]);
  });

  it('يفوّض دوال الجولة الثانية (صفحات البطولة/المباراة/اللاعب الفعلية) بنفس اتفاقية الفشل المغلَق', async () => {
    stubEmptyFetch();
    const adapter = new Scores365Adapter();

    await expect(adapter.getCompetitionGamesList(1)).resolves.toEqual({ fixtures: [], results: [] });
    await expect(adapter.getCompetitionMatchListing(1)).resolves.toEqual({ today: [], upcoming: [], recent: [], fixtures: [], results: [] });
    await expect(adapter.getCompetitionStatsSummary(1)).resolves.toBeNull();
    await expect(adapter.getCompetitionHistory(1)).resolves.toEqual([]);
    await expect(adapter.getCompetitionBrackets(1)).resolves.toEqual([]);
    await expect(adapter.getCompetitionInsights(1)).resolves.toBeNull();
    await expect(adapter.getFixtureTrends(1)).resolves.toEqual([]);

    await expect(adapter.getMatchStats(1)).resolves.toEqual([]);
    await expect(adapter.getPreGameComparison(1)).resolves.toBeNull();
    await expect(adapter.getMatchTrendsSummary(1)).resolves.toBeNull();
    await expect(adapter.getHeadToHead(1)).resolves.toBeNull();
    await expect(adapter.getShotChart(1)).resolves.toBeNull();

    await expect(adapter.getPlayerRecentMatches(1)).resolves.toEqual([]);
    await expect(adapter.getPlayerCareer(1)).resolves.toEqual({ sections: [], competitions: [] });
    await expect(adapter.getPlayerTrophies(1, [])).resolves.toEqual([]);
  });
});
