// Phase 1.4 §34 — صفحة المباراة: استدعاء Provider واحد (getMatchDetail يعيد شكلاً غنيًّا بالفعل —
// تشكيلات/أحداث/تعليق/أفضل أداء — لا حاجة لتجميع أكثر من مصدر واحد اليوم).
import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type { MatchDetail } from '../../domain/entities';
import { withFreshness, type SportQueryResult } from '../freshness';

export interface MatchPageData {
  match: MatchDetail | null;
}

export async function getMatchPageData(provider: string, externalId: number): Promise<SportQueryResult<MatchPageData>> {
  const dataProvider = SportProviderResolver(provider);

  return withFreshness(
    `match:${provider}:${externalId}`,
    async () => {
      const match = await dataProvider.getMatchDetail(externalId);
      return { match };
    },
    (value) => value.match === null,
  );
}
