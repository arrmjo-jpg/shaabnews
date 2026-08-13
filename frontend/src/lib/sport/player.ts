import 'server-only';
import { z } from 'zod';

// صفحة اللاعب — المصدر 365 العامّ. `web/athletes/?athletes={id}` يعطي: الملف (اسم/مركز/جنسية/عمر/صورة) + النادي
// والمنتخب من `competitors[]` + **قائمة بطولات اللاعب** من `competitions[]` (لمحوّل الإحصاء). والإحصاء لكلّ بطولة
// عبر `web/stats/?athletes={id}&competitions={c}`. كلّها مفحوصة حيًّا. server-only، Zod، ISR؛ null/[] عند الفشل (لا تلفيق).
// غير متاح في الـAPI العامّ (يُحذف بصدق): الطول/القميص/الميلاد، مسيرة الانتقالات، الألقاب.
const BASE = 'https://webws.365scores.com/web';
const COMMON = 'appTypeId=5&langId=27&timezoneName=Asia/Amman&userCountryId=6';

export interface PlayerTeam {
  id: number;
  name: string;
  logo: string | null;
}
export interface PlayerCompetition {
  id: number;
  name: string;
  logo: string | null;
}
export interface PlayerProfile {
  id: number;
  name: string;
  photo: string | null;
  position: string | null;
  nationality: string | null;
  age: number | null;
  club: PlayerTeam | null;
  nationalTeam: PlayerTeam | null;
  teams: PlayerTeam[];
  competitions: PlayerCompetition[];
}
export interface PlayerStat {
  label: string;
  value: string;
}

const AthleteSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    age: z.number().nullish(),
    position: z.object({ name: z.string().nullish() }).passthrough().nullish(),
    formationPosition: z.object({ name: z.string().nullish() }).passthrough().nullish(),
    nationalityName: z.string().nullish(),
    clubId: z.number().nullish(),
    nationalTeamId: z.number().nullish(),
    imageVersion: z.number().nullish(),
  })
  .passthrough();
const CompetitorRef = z
  .object({ id: z.number(), name: z.string(), imageVersion: z.number().nullish() })
  .passthrough();
const CompetitionRef = z
  .object({ id: z.number(), name: z.string(), countryId: z.number().nullish(), imageVersion: z.number().nullish() })
  .passthrough();
const AthletesResponse = z
  .object({
    athletes: z.array(AthleteSchema).nullish(),
    competitors: z.array(CompetitorRef).nullish(),
    competitions: z.array(CompetitionRef).nullish(),
  })
  .passthrough();

function playerPhoto(id: number, version: number | null | undefined, w = 140): string | null {
  if (version == null) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_${w},h_${w},c_limit,q_auto:eco,dpr_2,d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/v${version}/Athletes/${id}`;
}
function teamLogo(id: number, version: number | null | undefined): string | null {
  if (version == null) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_56,h_56,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v${version}/Competitors/${id}`;
}
function competitionLogo(id: number, countryId: number | null | undefined, version: number | null | undefined): string | null {
  if (countryId == null || version == null) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_24,h_24,c_limit,q_auto:eco,dpr_2,d_Countries:Round:${countryId}.png/v${version}/Competitions/${id}`;
}

export async function getPlayer(id: number): Promise<PlayerProfile | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const res = await fetch(`${BASE}/athletes/?${COMMON}&athletes=${id}`, {
      signal: AbortSignal.timeout(6000),
      // High-cardinality 365Scores entity (athleteId × competition/season).
      // Avoid persistent Next disk fetch-cache. (getTeamSquad below stays cached — teams are bounded.)
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = AthletesResponse.safeParse(await res.json());
    if (!parsed.success) return null;
    const list = parsed.data.athletes ?? [];
    const a = list.find((x) => x.id === id) ?? list[0];
    if (!a) return null;

    const byId = new Map<number, z.infer<typeof CompetitorRef>>();
    for (const c of parsed.data.competitors ?? []) byId.set(c.id, c);
    const toTeam = (tid: number | null | undefined): PlayerTeam | null => {
      if (tid == null) return null;
      const c = byId.get(tid);
      return c ? { id: c.id, name: c.name, logo: teamLogo(c.id, c.imageVersion ?? null) } : null;
    };
    const club = toTeam(a.clubId);
    const nationalTeam = toTeam(a.nationalTeamId);
    const teams = [club, nationalTeam].filter((t): t is PlayerTeam => t !== null);

    const competitions: PlayerCompetition[] = (parsed.data.competitions ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      logo: competitionLogo(c.id, c.countryId ?? null, c.imageVersion ?? null),
    }));

    return {
      id: a.id,
      name: a.name,
      photo: playerPhoto(a.id, a.imageVersion ?? null),
      position: a.formationPosition?.name ?? a.position?.name ?? null,
      nationality: a.nationalityName ?? null,
      age: a.age ?? null,
      club,
      nationalTeam,
      teams,
      competitions,
    };
  } catch {
    return null;
  }
}

// بطاقات الإحصاء (نمط 365) — نختار مقاييس محدّدة بـtypeId من فئات `athletesStats`. أوّل ظهور لكلّ typeId يفوز
// (كلّ فئة تتصدّرها مقياسها الأساسيّ). نُعيد المتوفّر فقط. typeId: 1=أهداف·2=صناعة·36=تقييم·3=صفراء·4=حمراء·10=جزاء.
const STAT_CARDS: { typeId: number; label: string }[] = [
  { typeId: 1, label: 'أهداف' },
  { typeId: 2, label: 'صناعة' },
  { typeId: 36, label: 'التقييم' },
  { typeId: 10, label: 'ضربات الجزاء' },
  { typeId: 3, label: 'بطاقات صفراء' },
  { typeId: 4, label: 'بطاقات حمراء' },
];

const StatEntry = z.object({ typeId: z.number(), value: z.string() }).passthrough();
const StatRow = z
  .object({ entity: z.object({ id: z.number() }).passthrough().nullish(), stats: z.array(StatEntry).nullish() })
  .passthrough();
const AthleteStatCat = z.object({ rows: z.array(StatRow).nullish() }).passthrough();
const StatsResponse = z
  .object({ stats: z.object({ athletesStats: z.array(AthleteStatCat).nullish() }).passthrough().nullish() })
  .passthrough();

export async function getPlayerStats(id: number, competitionId: number): Promise<PlayerStat[]> {
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(competitionId) || competitionId <= 0) return [];
  try {
    const res = await fetch(`${BASE}/stats/?${COMMON}&athletes=${id}&competitions=${competitionId}`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const parsed = StatsResponse.safeParse(await res.json());
    if (!parsed.success) return [];
    // المقياس الأساسيّ لكلّ فئة = أوّل stat (تتصدّر الفئةَ مقياسُها الرئيسيّ) ⇒ نتفادى التقاط قيمة ثانويّة خاطئة.
    const byType = new Map<number, string>();
    for (const cat of parsed.data.stats?.athletesStats ?? []) {
      const row = (cat.rows ?? []).find((r) => r.entity?.id === id) ?? (cat.rows ?? [])[0];
      const primary = row?.stats?.[0];
      if (primary && !byType.has(primary.typeId)) byType.set(primary.typeId, primary.value);
    }
    return STAT_CARDS.filter((c) => byType.has(c.typeId)).map((c) => ({ label: c.label, value: byType.get(c.typeId) as string }));
  } catch {
    return [];
  }
}

// قائمة لاعبي الفريق (تشكيلة) — المصدر `web/squads/?competitors={teamId}` (مفحوص حيًّا: athletes مع قميص/طول/ميلاد).
// تُستعمل لـ«قد تكون مهتمًا بـ» (زملاء اللاعب) ولاستخراج تفاصيل اللاعب نفسه (طول/قميص/ميلاد، غير المتوفّرة في athletes/).
export interface SquadPlayer {
  id: number;
  name: string;
  photo: string | null;
  jersey: number | null;
  position: string | null;
  height: number | null;
  birthdate: string | null;
}

const SquadAthlete = z
  .object({
    id: z.number(),
    name: z.string(),
    jerseyNum: z.number().nullish(),
    position: z.object({ name: z.string().nullish() }).passthrough().nullish(),
    height: z.number().nullish(),
    birthdate: z.string().nullish(),
    imageVersion: z.number().nullish(),
  })
  .passthrough();
const SquadResponse = z
  .object({
    squads: z
      .array(z.object({ competitorId: z.number().nullish(), athletes: z.array(SquadAthlete).nullish() }).passthrough())
      .nullish(),
  })
  .passthrough();

// ===== المباريات الأخيرة للّاعب (بتقييمه ودقائقه وأهدافه) — `web/athletes/games/?athleteId={id}&lastMatchLimit={n}` =====
// (مفحوص حيًّا: ٥٩ مباراة، كلّ عنصر `{game, played, athleteStats}`؛ athleteStats: type229=دقائق·226=أهداف·التقييم=ذو bgColor).
export interface PlayerGame {
  id: number;
  competition: string | null;
  date: string | null;
  home: { name: string; logo: string | null; score: number | null };
  away: { name: string; logo: string | null; score: number | null };
  minutes: string | null;
  goals: string | null;
  rating: string | null;
  ratingColor: string | null;
}

const GameCompetitor = z
  .object({ id: z.number(), name: z.string(), score: z.number().nullish(), imageVersion: z.number().nullish() })
  .passthrough();
const AthleteGame = z
  .object({
    game: z
      .object({
        id: z.number(),
        competitionDisplayName: z.string().nullish(),
        startTime: z.string().nullish(),
        homeCompetitor: GameCompetitor.nullish(),
        awayCompetitor: GameCompetitor.nullish(),
      })
      .passthrough(),
    athleteStats: z
      .array(z.object({ type: z.number().nullish(), value: z.string().nullish(), bgColor: z.string().nullish() }).passthrough())
      .nullish(),
  })
  .passthrough();
const PlayerGamesResponse = z.object({ games: z.array(AthleteGame).nullish() }).passthrough();

export async function getPlayerLastMatches(athleteId: number, limit = 10): Promise<PlayerGame[]> {
  if (!Number.isInteger(athleteId) || athleteId <= 0) return [];
  try {
    const res = await fetch(`${BASE}/athletes/games/?${COMMON}&athleteId=${athleteId}&lastMatchLimit=${limit}`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const parsed = PlayerGamesResponse.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.games ?? []).slice(0, limit).map((it) => {
      const g = it.game;
      const stats = it.athleteStats ?? [];
      const byType = (t: number) => stats.find((s) => s.type === t)?.value ?? null;
      const ratingStat = stats.find((s) => s.bgColor);
      const side = (c: z.infer<typeof GameCompetitor> | null | undefined) => ({
        name: c?.name ?? '',
        logo: c ? teamLogo(c.id, c.imageVersion ?? null) : null,
        score: typeof c?.score === 'number' && c.score >= 0 ? c.score : null,
      });
      return {
        id: g.id,
        competition: g.competitionDisplayName ?? null,
        date: g.startTime ?? null,
        home: side(g.homeCompetitor),
        away: side(g.awayCompetitor),
        minutes: byType(229),
        goals: byType(226),
        rating: ratingStat?.value ?? null,
        ratingColor: ratingStat?.bgColor ?? null,
      } satisfies PlayerGame;
    });
  } catch {
    return [];
  }
}

// ===== مسيرة اللاعب (مسيرته عبر الأندية/البطولات بالإحصاء) — `web/athletes/career?athleteId={id}&seasonKey={season}` =====
// (مفحوص حيًّا: يلزم seasonKey؛ يردّ stats.categories[نادٍ/منتخب] + stats.tables[أعمدة×صفوف بطولات بإحصاءاتها]).
export interface CareerColumn {
  num: number;
  name: string;
}
export interface CareerRow {
  competitionId: number;
  title: string;
  values: Record<number, string>;
}
export interface CareerSection {
  name: string;
  columns: CareerColumn[];
  rows: CareerRow[];
}

const CareerColZ = z.object({ num: z.number(), shortName: z.string().nullish(), name: z.string().nullish() }).passthrough();
const CareerRowZ = z
  .object({
    entityId: z.number().nullish(),
    title: z.string().nullish(),
    values: z.array(z.object({ columnNum: z.number(), value: z.string().nullish() }).passthrough()).nullish(),
  })
  .passthrough();
const CareerTableZ = z.object({ columns: z.array(CareerColZ).nullish(), rows: z.array(CareerRowZ).nullish() }).passthrough();
const CareerResponse = z
  .object({
    stats: z
      .object({
        categories: z.array(z.object({ name: z.string().nullish() }).passthrough()).nullish(),
        tables: z.array(CareerTableZ).nullish(),
      })
      .passthrough()
      .nullish(),
    competitions: z.array(z.object({ id: z.number(), name: z.string() }).passthrough()).nullish(),
  })
  .passthrough();

interface CareerFetch {
  sections: CareerSection[];
  comps: { id: number; name: string }[];
}
async function fetchCareer(athleteId: number, seasonKey: number): Promise<CareerFetch | null> {
  const res = await fetch(`${BASE}/athletes/career?${COMMON}&athleteId=${athleteId}&seasonKey=${seasonKey}`, {
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (res.status === 204 || !res.ok) return null;
  const parsed = CareerResponse.safeParse(await res.json());
  if (!parsed.success || !parsed.data.stats?.tables?.length) return null;
  const cats = parsed.data.stats.categories ?? [];
  const sections = parsed.data.stats.tables.map((t, i) => ({
    name: cats[i]?.name ?? '',
    columns: (t.columns ?? []).map((c) => ({ num: c.num, name: c.shortName || c.name || '' })),
    rows: (t.rows ?? []).map((r) => ({
      competitionId: r.entityId ?? 0,
      title: r.title ?? '',
      values: Object.fromEntries((r.values ?? []).map((v) => [v.columnNum, v.value ?? '-'])),
    })),
  }));
  const comps = (parsed.data.competitions ?? []).map((c) => ({ id: c.id, name: c.name }));
  return { sections, comps };
}

export interface PlayerCareerData {
  sections: CareerSection[];
  competitions: { id: number; name: string }[];
}
// career يلزمه seasonKey ويعطي بطولات ذلك الموسم فقط ⇒ نمسح ١٠ مواسم بالتوازي: العرض من أحدث موسم فيه بيانات،
// وقائمة البطولات (للألقاب) = اتّحاد كلّ المواسم (تكشف بطولات قديمة فاز بها اللاعب خارج موسمه الحاليّ، مثبَت لإليجاه).
export async function getPlayerCareerData(athleteId: number): Promise<PlayerCareerData> {
  if (!Number.isInteger(athleteId) || athleteId <= 0) return { sections: [], competitions: [] };
  const y = new Date().getFullYear();
  const seasons = Array.from({ length: 10 }, (_, i) => y - i);
  const all = await Promise.all(seasons.map((s) => fetchCareer(athleteId, s).catch(() => null)));
  const sections = all.find((r) => r && r.sections.length)?.sections ?? [];
  const map = new Map<number, string>();
  for (const r of all) for (const c of r?.comps ?? []) if (!map.has(c.id)) map.set(c.id, c.name);
  return { sections, competitions: [...map].map(([id, name]) => ({ id, name })) };
}

// ===== ألقاب اللاعب — `web/athletes/trophies/stats?athleteId={id}&competitionId={c}` =====
// (مفحوص حيًّا: 204 لبطولة بلا ألقاب، 200 ببطولة لها ألقاب — مثل 5830 Eastern Suburbs). نستعلم لبطولات مسيرته.
export interface TrophyColumn {
  num: number;
  name: string;
}
export interface TrophyWinRow {
  competitor: string;
  competitorLogo: string | null;
  season: string | null;
  values: Record<number, string>;
}
export interface TrophyGroup {
  competition: string;
  count: number;
  columns: TrophyColumn[];
  rows: TrophyWinRow[];
}

const TrophyResponse = z
  .object({
    stats: z
      .object({
        columns: z.array(z.object({ num: z.number(), name: z.string().nullish() }).passthrough()).nullish(),
        rows: z
          .array(
            z
              .object({
                entityId: z.number().nullish(),
                title: z.string().nullish(),
                secondaryTitle: z.string().nullish(),
                values: z.array(z.object({ columnNum: z.number(), value: z.string().nullish() }).passthrough()).nullish(),
              })
              .passthrough(),
          )
          .nullish(),
      })
      .passthrough()
      .nullish(),
    competitors: z.array(z.object({ id: z.number(), name: z.string(), imageVersion: z.number().nullish() }).passthrough()).nullish(),
  })
  .passthrough();

export async function getPlayerTrophies(
  athleteId: number,
  competitions: { id: number; name: string }[],
): Promise<TrophyGroup[]> {
  if (!Number.isInteger(athleteId) || athleteId <= 0 || !competitions.length) return [];
  const list = competitions.slice(0, 20);
  const results = await Promise.all(
    list.map(async ({ id: cid, name }) => {
      try {
        const res = await fetch(`${BASE}/athletes/trophies/stats?${COMMON}&athleteId=${athleteId}&competitionId=${cid}`, {
          signal: AbortSignal.timeout(6000),
          cache: 'no-store',
        });
        if (res.status === 204 || !res.ok) return null;
        const parsed = TrophyResponse.safeParse(await res.json());
        if (!parsed.success || !parsed.data.stats?.rows?.length) return null;
        // الاسم من بطولات المسيرة (الردّ يعطي competitions فارغة)؛ الأعمدة ديناميكيّة؛ شعار الفريق من competitors.
        const logoOf = new Map<number, string | null>();
        for (const c of parsed.data.competitors ?? []) logoOf.set(c.id, teamLogo(c.id, c.imageVersion ?? null));
        const columns: TrophyColumn[] = (parsed.data.stats.columns ?? []).map((c) => ({ num: c.num, name: c.name ?? '' }));
        const rows: TrophyWinRow[] = parsed.data.stats.rows.map((r) => ({
          competitor: r.title ?? '',
          competitorLogo: r.entityId != null ? (logoOf.get(r.entityId) ?? null) : null,
          season: r.secondaryTitle ?? null,
          values: Object.fromEntries((r.values ?? []).map((x) => [x.columnNum, x.value ?? '-'])),
        }));
        return { competition: name || '', count: rows.length, columns, rows } satisfies TrophyGroup;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is TrophyGroup => r !== null);
}

export async function getTeamSquad(teamId: number): Promise<SquadPlayer[]> {
  if (!Number.isInteger(teamId) || teamId <= 0) return [];
  try {
    const res = await fetch(`${BASE}/squads/?${COMMON}&competitors=${teamId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600, tags: ['sport-stats'] },
    });
    if (!res.ok) return [];
    const parsed = SquadResponse.safeParse(await res.json());
    if (!parsed.success) return [];
    const squad = (parsed.data.squads ?? []).find((s) => s.competitorId === teamId) ?? (parsed.data.squads ?? [])[0];
    return (squad?.athletes ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      photo: playerPhoto(a.id, a.imageVersion ?? null, 40),
      jersey: a.jerseyNum ?? null,
      position: a.position?.name ?? null,
      height: a.height ?? null,
      birthdate: a.birthdate ?? null,
    }));
  } catch {
    return [];
  }
}
