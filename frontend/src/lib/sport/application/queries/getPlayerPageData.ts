// Phase 1.4 §34 — صفحة اللاعب: بروفايل ثمّ إحصاء بطولته الأساسية. تسلسليّ عمدًا (خطوتان ثابتتان،
// الثانية تعتمد على معرّف بطولة من نتيجة الأولى) — وليس حلقة لكل عنصر في مجموعة، فلا يخالف قاعدة
// "No N+1 Provider Calls" (§31)، التي تستهدف استدعاءً واحدًا لكل عنصر ضمن مجموعة متغيّرة الحجم.
import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type { Player, PlayerStatLine } from '../../domain/entities';
import { withFreshness, type SportQueryResult } from '../freshness';

export interface PlayerPageData {
  profile: Player | null;
  stats: PlayerStatLine[];
}

export async function getPlayerPageData(provider: string, externalId: number): Promise<SportQueryResult<PlayerPageData>> {
  const dataProvider = SportProviderResolver(provider);

  return withFreshness(
    `player:${provider}:${externalId}`,
    async () => {
      const profile = await dataProvider.getPlayerProfile(externalId);
      const competitionId = profile?.competitions[0]?.id;
      const stats = competitionId ? await dataProvider.getPlayerStats(externalId, competitionId) : [];
      return { profile, stats };
    },
    (value) => value.profile === null,
  );
}
