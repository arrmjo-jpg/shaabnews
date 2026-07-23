import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type { SearchResults } from '../../domain/entities';

// Sprint 1.6 Phase 3 (Search) — استعلام Application رقيق. لا withFreshness هنا عمدًا: كل استعلام
// بحث مرتبط باستعلام (query) مختلف، فـ"آخر قيمة ناجحة" من استعلام سابق غير ذي معنى لعرضها بدل
// نتائج استعلام حاليّ فاشل — الفشل هنا يعني ببساطة "لا نتائج"، لا حالة قديمة صالحة نعرضها.
export async function getSportSearchResults(provider: string, query: string, sportId = 1): Promise<SearchResults> {
  const dataProvider = SportProviderResolver(provider);
  return dataProvider.searchSport(query, sportId);
}
