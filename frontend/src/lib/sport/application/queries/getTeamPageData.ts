// Phase 1.4 §31 (No N+1 Provider Calls) — تجميع بروفايل الفريق + قائمة اللاعبين في استدعاء
// Application واحد (Promise.all)، لا حلقة لكلّ لاعب.
import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type { SquadMember, TeamProfile } from '../../domain/entities';
import { withFreshness, type SportQueryResult } from '../freshness';

export interface TeamPageData {
  profile: TeamProfile | null;
  squad: SquadMember[];
}

export async function getTeamPageData(provider: string, externalId: number): Promise<SportQueryResult<TeamPageData>> {
  const dataProvider = SportProviderResolver(provider);

  return withFreshness(
    `team:${provider}:${externalId}`,
    async () => {
      const [profile, squad] = await Promise.all([
        dataProvider.getTeamProfile(externalId),
        dataProvider.getTeamSquad(externalId),
      ]);
      return { profile, squad };
    },
    (value) => value.profile === null,
  );
}
