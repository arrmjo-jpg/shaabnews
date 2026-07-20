// طبقة Service: تأخذ شكل استجابة CMS Category الفعلي ({provider, external_id: string}) وتُنتج
// زوجاً جاهزاً (مزوّد محلول + معرّف رقمي) — هذا ما يفصل SportProviderResolver/externalIdMapper
// عن أي كود استهلاك، ويتيح لاختبارات queries/getSportHomeData استخدام MockSportDataProvider
// بلا لمس Scores365Adapter/SportProviderResolver إطلاقاً.
import type { SportDataProvider } from '../domain/SportDataProvider';
import { parseExternalId } from '../infrastructure/externalIdMapper';
import { SportProviderResolver } from '../infrastructure/SportProviderResolver';

export interface SportCategoryRef {
  provider: string;
  external_id: string;
}

export interface ResolvedSportProvider {
  provider: SportDataProvider;
  externalId: number;
}

export function resolveSportProvider(category: SportCategoryRef): ResolvedSportProvider {
  return {
    provider: SportProviderResolver(category.provider),
    externalId: parseExternalId(category.external_id),
  };
}
