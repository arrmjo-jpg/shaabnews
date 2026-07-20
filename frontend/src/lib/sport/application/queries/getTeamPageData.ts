// Phase 1.4 Step 1 Round 2 — أُعيد بناؤها بعد قراءة صفحة الفريق الحيّة فعليًّا
// (frontend/src/app/(site)/sport/team/[id]/page.tsx): تجلب البروفايل، ثمّ (تسلسليًّا، تعتمد على
// mainCompetitionId من البروفايل) ترتيب دوريه الرئيس إن وُجد — تمامًا كما تفعل الصفحة اليوم.
// لا squad: الصفحة الحيّة لا تعرض تشكيلة الفريق إطلاقًا (getTeamSquad يبقى على الـPort لاستخدام
// صفحة اللاعب فقط — "زملاء اللاعب").
import { SportProviderResolver } from '../../infrastructure/SportProviderResolver';
import type { Standing, TeamProfile } from '../../domain/entities';
import { withFreshness, type SportQueryResult } from '../freshness';

export interface TeamPageData {
  profile: TeamProfile | null;
  standings: Standing | null;
}

export async function getTeamPageData(provider: string, externalId: number): Promise<SportQueryResult<TeamPageData>> {
  const dataProvider = SportProviderResolver(provider);

  return withFreshness(
    `team:${provider}:${externalId}`,
    async () => {
      const profile = await dataProvider.getTeamProfile(externalId);
      const standings = profile?.mainCompetitionId ? await dataProvider.getStandings(profile.mainCompetitionId) : null;
      return { profile, standings };
    },
    (value) => value.profile === null,
  );
}
