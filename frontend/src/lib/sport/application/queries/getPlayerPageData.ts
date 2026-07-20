// Phase 1.4 Step 1 Round 2 — أُعيد بناؤها بعد قراءة صفحة اللاعب الحيّة فعليًّا
// (frontend/src/app/(site)/sport/player/[id]/page.tsx): تبويب-واعية، بنفس منطق الجلب الشرطيّ
// (بالتوازي عبر Promise.all لما يُحتاج فقط)، ثمّ الألقاب تسلسليًّا (تعتمد على بطولات المسيرة).
import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type { Player, PlayerCareer, PlayerRecentMatch, PlayerStatLine, PlayerTrophy, SquadMember } from '../../domain/entities';
import { withFreshness, type SportQueryResult } from '../freshness';

export type PlayerPageTab = 'profile' | 'matches' | 'stats';

export interface PlayerPageOptions {
  tab: PlayerPageTab;
  competitionId?: number | null;
}

export interface PlayerPageData {
  profile: Player | null;
  stats: PlayerStatLine[];
  lastMatches: PlayerRecentMatch[];
  self: SquadMember | null;
  teammates: SquadMember[];
  career: PlayerCareer;
  trophies: PlayerTrophy[];
}

export async function getPlayerPageData(
  provider: string,
  externalId: number,
  options: PlayerPageOptions,
): Promise<SportQueryResult<PlayerPageData>> {
  const dataProvider = SportProviderResolver(provider);
  const { tab } = options;

  return withFreshness(
    `player:${provider}:${externalId}:${tab}`,
    async () => {
      const profile = await dataProvider.getPlayerProfile(externalId);
      if (!profile) {
        return { profile: null, stats: [], lastMatches: [], self: null, teammates: [], career: { sections: [], competitions: [] }, trophies: [] };
      }

      const compId = options.competitionId ?? profile.competitions[0]?.id ?? null;
      const needProfile = tab === 'profile';
      const needMatches = tab === 'profile' || tab === 'matches';
      const squadTeamId = profile.club?.id ?? profile.nationalTeam?.id ?? null;

      const [stats, lastMatches, squad, career] = await Promise.all([
        (needProfile || tab === 'stats') && compId ? dataProvider.getPlayerStats(externalId, compId) : Promise.resolve([]),
        needMatches ? dataProvider.getPlayerRecentMatches(externalId, tab === 'matches' ? 20 : 5) : Promise.resolve([]),
        squadTeamId ? dataProvider.getTeamSquad(squadTeamId) : Promise.resolve([]),
        needProfile ? dataProvider.getPlayerCareer(externalId) : Promise.resolve({ sections: [], competitions: [] }),
      ]);

      const self = squad.find((s) => s.id === externalId) ?? null;
      const teammates = squad.filter((s) => s.id !== externalId);
      const trophies = needProfile ? await dataProvider.getPlayerTrophies(externalId, career.competitions) : [];

      return { profile, stats, lastMatches, self, teammates, career, trophies };
    },
    (value) => value.profile === null,
  );
}
