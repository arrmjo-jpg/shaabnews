import 'server-only';
import { z } from 'zod';

// بحث الرياضة (365Scores العامّ) — `web/search/?query=...`. مُختبَر حيًّا (2026-07-25):
// المفاتيح الفعليّة المُعادة هي sports/countries/competitions/competitors/athletes فقط — **لا
// مصفوفة مباريات/games إطلاقًا**، فبحث المباريات غير مدعوم بهذه النقطة ولا يُستخرج هنا (لا تلفيق).
// sports/countries تُستبعَد أيضًا: لا صفحة داخلية قانونية (Canonical Internal Route) لأيّ منهما،
// ويُمنَع عرض أيّ نتيجة بلا وجهة داخلية حقيقية (القاعدة المعماريّة المُقفَلة لميزة Search).
const BASE = 'https://webws.365scores.com/web';
const COMMON = 'appTypeId=5&langId=27&timezoneName=Asia/Amman&userCountryId=6';

const CompetitionHit = z
  .object({ id: z.number(), name: z.string(), sportId: z.number().nullish(), countryId: z.number().nullish(), imageVersion: z.number().nullish() })
  .passthrough();
const CompetitorHit = z
  .object({ id: z.number(), name: z.string(), sportId: z.number().nullish(), imageVersion: z.number().nullish() })
  .passthrough();
const AthleteHit = z
  .object({ id: z.number(), name: z.string(), sportId: z.number().nullish(), clubName: z.string().nullish(), imageVersion: z.number().nullish() })
  .passthrough();

const SearchResponse = z
  .object({
    competitions: z.array(CompetitionHit).nullish(),
    competitors: z.array(CompetitorHit).nullish(),
    athletes: z.array(AthleteHit).nullish(),
  })
  .passthrough();

export interface SportSearchCompetition {
  id: number;
  name: string;
  logo: string | null;
}
export interface SportSearchTeam {
  id: number;
  name: string;
  logo: string | null;
}
export interface SportSearchPlayer {
  id: number;
  name: string;
  club: string | null;
  photo: string | null;
}
export interface SportSearchResults {
  competitions: SportSearchCompetition[];
  teams: SportSearchTeam[];
  players: SportSearchPlayer[];
}

const EMPTY: SportSearchResults = { competitions: [], teams: [], players: [] };
const LIMIT_PER_TYPE = 8;

function competitionLogo(id: number, countryId: number | null | undefined, version: number | null | undefined): string | null {
  if (version == null) return null;
  const def = countryId != null ? `Countries:Round:${countryId}` : 'Competitions:default1';
  return `https://imagecache.365scores.com/image/upload/f_png,w_40,h_40,c_limit,q_auto:eco,dpr_2,d_${def}.png/v${version}/Competitions/${id}`;
}

function teamLogo(id: number, version: number | null | undefined): string | null {
  if (version == null) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_40,h_40,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v${version}/Competitors/${id}`;
}

function playerPhoto(id: number, version: number | null | undefined): string | null {
  if (version == null) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_64,h_64,c_limit,q_auto:eco,dpr_2,d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/v${version}/Athletes/${id}`;
}

// بحث كيانات الرياضة — بطولات/فرق/لاعبون فقط (راجع التعليق أعلى الملف لسبب استبعاد الباقي).
// sportId افتراضيّ 1 (كرة قدم) — نفس اصطلاح باقي هذا المجلّد (games.ts إلخ)، بلا مصدر آخر لتعدّد الرياضات اليوم.
export async function searchSport(query: string, sportId = 1): Promise<SportSearchResults> {
  const q = query.trim();
  if (q === '') return EMPTY;
  try {
    const res = await fetch(`${BASE}/search/?${COMMON}&query=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 300, tags: ['sport-search'] },
    });
    if (!res.ok) return EMPTY;
    const parsed = SearchResponse.safeParse(await res.json());
    if (!parsed.success) return EMPTY;
    const data = parsed.data;

    const competitions: SportSearchCompetition[] = (data.competitions ?? [])
      .filter((c) => c.sportId == null || c.sportId === sportId)
      .slice(0, LIMIT_PER_TYPE)
      .map((c) => ({ id: c.id, name: c.name, logo: competitionLogo(c.id, c.countryId, c.imageVersion) }));

    const teams: SportSearchTeam[] = (data.competitors ?? [])
      .filter((c) => c.sportId == null || c.sportId === sportId)
      .slice(0, LIMIT_PER_TYPE)
      .map((c) => ({ id: c.id, name: c.name, logo: teamLogo(c.id, c.imageVersion) }));

    const players: SportSearchPlayer[] = (data.athletes ?? [])
      .filter((a) => a.sportId == null || a.sportId === sportId)
      .slice(0, LIMIT_PER_TYPE)
      .map((a) => ({ id: a.id, name: a.name, club: a.clubName ?? null, photo: playerPhoto(a.id, a.imageVersion) }));

    return { competitions, teams, players };
  } catch {
    return EMPTY;
  }
}
