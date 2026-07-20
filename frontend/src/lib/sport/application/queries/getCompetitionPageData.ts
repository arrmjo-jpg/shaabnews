// Phase 1.4 §31 (No N+1 Provider Calls) + §34 (Provider Contract) — خدمة Application مركّبة
// واحدة لصفحة البطولة، بلا أي اعتماد على Next.js/React (مدخلات صريحة، DTO نظيف خارجًا) كي تبقى
// قابلة للاستدعاء من أي مستهلك مستقبلي (API مستقلّة، تطبيق جوال، CLI) لا صفحات Next.js فقط.
import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type { CompetitionProfile, CompetitionRoster, Standing } from '../../domain/entities';
import { withFreshness, type SportQueryResult } from '../freshness';

export interface CompetitionPageData {
  profile: CompetitionProfile | null;
  standings: Standing | null;
  roster: CompetitionRoster[];
}

export async function getCompetitionPageData(
  provider: string,
  externalId: number,
): Promise<SportQueryResult<CompetitionPageData>> {
  const dataProvider = SportProviderResolver(provider);

  return withFreshness(
    `competition:${provider}:${externalId}`,
    async () => {
      const [profile, standings, roster] = await Promise.all([
        dataProvider.getCompetitionProfile(externalId),
        dataProvider.getStandings(externalId),
        dataProvider.getCompetitionRoster(externalId),
      ]);
      return { profile, standings, roster };
    },
    (value) => value.profile === null,
  );
}
