// Live Scores Strip (Sprint 1.6 Phase 3) — تفويض رفيع لـ `getFeaturedMatches` عبر
// `SportProviderResolver`، بنفس نمط `getTeamPageData`/`getMatchPageData` بالضبط (§34: نقطة
// الدخول الوحيدة المسموحة لأي صفحة/مكوّن هي `application/queries/*`، لا `infrastructure/*` مباشرة).
//
// لا Freshness wrapper هنا عمدًا (خلافًا لاستعلامات صفحات التفاصيل الأربع): الشريط عنصر صفحة
// رئيسيّة تكميليّ، لا كيان أساسي واحد — يطابق نمط `getSportHomeData` الأبسط (Promise واحد مباشر)
// بدل نمط `withFreshness` الخاص بصفحات التفاصيل.
import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type { Match } from '../../domain/entities';

export async function getLiveScoresStripData(
  provider: string,
  sportId: number,
  date: string,
  limit: number,
  priorityCompetitionIds: number[],
): Promise<Match[]> {
  const dataProvider = SportProviderResolver(provider);
  return dataProvider.getFeaturedMatches(sportId, date, limit, priorityCompetitionIds);
}
