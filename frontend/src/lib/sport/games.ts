import 'server-only';
import { z } from 'zod';
import { todayAmman, ymdToDmy } from './day';

// مصدر البيانات الوحيد (SSoT) = **365Scores العامّ**. لا Mock. استدعاء `allscores` واحد يغذّي عدّة Blocks
// (مباريات/بطولات/دول/فِرق)؛ Next يوحّد الطلب المكرّر لنفس الرابط. التصنيف/الشعارات مفروضة من البيانات.

const BASE = 'https://webws.365scores.com/web';
const COMMON = 'appTypeId=3&langId=27&timezoneName=Asia/Amman&userCountryId=6';

const Competitor = z
  .object({
    id: z.number(),
    name: z.string(),
    score: z.number().nullish(),
    color: z.string().nullish(),
    imageVersion: z.number().nullish(),
    popularityRank: z.number().nullish(),
  })
  .passthrough();

const Game = z
  .object({
    id: z.number(),
    competitionId: z.number().nullish(),
    competitionDisplayName: z.string().nullish(),
    startTime: z.string().nullish(),
    statusGroup: z.number().nullish(),
    statusText: z.string().nullish(),
    gameTime: z.number().nullish(),
    gameTimeDisplay: z.string().nullish(),
    homeCompetitor: Competitor.nullish(),
    awayCompetitor: Competitor.nullish(),
  })
  .passthrough();

const Competition = z
  .object({
    id: z.number(),
    name: z.string(),
    totalGames: z.number().nullish(),
    liveGames: z.number().nullish(),
    countryId: z.number().nullish(),
    popularityRank: z.number().nullish(),
    imageVersion: z.number().nullish(),
    hasStandings: z.boolean().nullish(),
  })
  .passthrough();

const Country = z
  .object({
    id: z.number(),
    name: z.string(),
    totalGames: z.number().nullish(),
    imageVersion: z.number().nullish(),
  })
  .passthrough();

const TeamEntity = z
  .object({
    id: z.number(),
    name: z.string(),
    color: z.string().nullish(),
    imageVersion: z.number().nullish(),
    popularityRank: z.number().nullish(),
  })
  .passthrough();

const AllScores = z
  .object({
    games: z.array(Game).nullish(),
    competitions: z.array(Competition).nullish(),
    countries: z.array(Country).nullish(),
    competitors: z.array(TeamEntity).nullish(),
  })
  .passthrough();

// date اختياريّ (YYYY-MM-DD) ⇒ يُمرَّر كـ startDate/endDate (DD/MM/YYYY) فيُرجع مباريات ذلك اليوم — أساس فلتر الأيّام.
async function fetchAllScores(sportId: number, date?: string): Promise<z.infer<typeof AllScores> | null> {
  try {
    const dateQ = date ? `&startDate=${ymdToDmy(date)}&endDate=${ymdToDmy(date)}` : '';
    const res = await fetch(`${BASE}/games/allscores/?${COMMON}&sports=${sportId}${dateQ}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 60, tags: ['sport-games'] },
    });
    if (!res.ok) return null;
    const parsed = AllScores.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function img(kind: string, id: number, version: number | null | undefined, size = 64): string | null {
  if (version == null) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_${size},h_${size},c_limit,q_auto:eco,dpr_2,d_${kind}:default1.png/v${version}/${kind}/${id}`;
}

// شعار البطولة — نمط 365 (الافتراضيّ = علم الدولة المستديرة).
function competitionLogo(id: number, countryId: number | null | undefined, version: number | null | undefined): string | null {
  if (version == null) return null;
  const def = countryId != null ? `Countries:Round:${countryId}` : 'Competitions:default1';
  return `https://imagecache.365scores.com/image/upload/f_png,w_48,h_48,c_limit,q_auto:eco,dpr_2,d_${def}.png/v${version}/Competitions/${id}`;
}

// ===== المباريات (Block: مباريات اليوم) =====
export type MatchKind = 'live' | 'upcoming' | 'finished';
export interface MatchSide {
  name: string;
  score: number | null;
  color: string | null;
  logo: string | null;
}
export interface SportMatch {
  id: number;
  kind: MatchKind;
  statusText: string | null;
  minute: string | null;
  startTime: string | null;
  home: MatchSide;
  away: MatchSide;
}
export interface CompetitionGroup {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  matches: SportMatch[];
}

function toSide(c: z.infer<typeof Competitor> | null | undefined): MatchSide {
  const raw = c?.score;
  return {
    name: c?.name ?? '',
    score: typeof raw === 'number' && raw >= 0 ? raw : null,
    color: c?.color ?? null,
    logo: c ? img('Competitors', c.id, c.imageVersion) : null,
  };
}

function classify(group: number | null | undefined, home: MatchSide, away: MatchSide): MatchKind {
  if (group === 3) return 'live';
  if (home.score !== null && away.score !== null) return 'finished';
  return 'upcoming';
}

export async function getMatchesByCompetition(sportId = 1, date?: string): Promise<CompetitionGroup[]> {
  const data = await fetchAllScores(sportId, date);
  if (!data?.games) return [];
  const compMeta = new Map<number, { countryId: number | null; imageVersion: number | null }>();
  for (const c of data.competitions ?? []) compMeta.set(c.id, { countryId: c.countryId ?? null, imageVersion: c.imageVersion ?? null });
  const countryName = new Map<number, string>();
  for (const c of data.countries ?? []) countryName.set(c.id, c.name);
  const map = new Map<number, CompetitionGroup>();
  const order: number[] = [];
  for (const g of data.games) {
    const home = toSide(g.homeCompetitor);
    const away = toSide(g.awayCompetitor);
    const kind = classify(g.statusGroup, home, away);
    const cid = g.competitionId ?? -1;
    if (!map.has(cid)) {
      const meta = compMeta.get(cid);
      map.set(cid, {
        id: cid,
        name: g.competitionDisplayName ?? '',
        logo: meta ? competitionLogo(cid, meta.countryId, meta.imageVersion) : null,
        country: meta?.countryId != null ? countryName.get(meta.countryId) ?? null : null,
        matches: [],
      });
      order.push(cid);
    }
    const minute =
      kind === 'live'
        ? g.gameTimeDisplay || (typeof g.gameTime === 'number' && g.gameTime > 0 ? `${Math.floor(g.gameTime)}'` : null)
        : null;
    map.get(cid)!.matches.push({ id: g.id, kind, statusText: g.statusText ?? null, minute, startTime: g.startTime ?? null, home, away });
  }
  return order.map((id) => map.get(id)!);
}

// تجميع مباريات اليوم **بالدولة → البطولة → المباريات** (لقائمة «الدول» المنسدلة). يتبع التاريخ المختار؛ مرتّب بعدد المباريات.
export interface CountryMatchGroup {
  id: number;
  name: string;
  flag: string | null;
  gameCount: number;
  liveCount: number;
  competitions: CompetitionGroup[];
}

export async function getMatchesByCountry(sportId = 1, date?: string, limit = 20): Promise<CountryMatchGroup[]> {
  const data = await fetchAllScores(sportId, date);
  if (!data?.games) return [];
  const compMeta = new Map<number, { countryId: number | null; imageVersion: number | null; name: string }>();
  for (const c of data.competitions ?? [])
    compMeta.set(c.id, { countryId: c.countryId ?? null, imageVersion: c.imageVersion ?? null, name: c.name });
  const countryMeta = new Map<number, { name: string; imageVersion: number | null }>();
  for (const c of data.countries ?? []) countryMeta.set(c.id, { name: c.name, imageVersion: c.imageVersion ?? null });

  const countries = new Map<number, { group: CountryMatchGroup; comps: Map<number, CompetitionGroup> }>();
  for (const g of data.games) {
    const home = toSide(g.homeCompetitor);
    const away = toSide(g.awayCompetitor);
    const kind = classify(g.statusGroup, home, away);
    const cid = g.competitionId ?? -1;
    const meta = compMeta.get(cid);
    const countryId = meta?.countryId ?? -1;
    if (!countries.has(countryId)) {
      const cm = countryMeta.get(countryId);
      countries.set(countryId, {
        group: {
          id: countryId,
          name: cm?.name ?? '—',
          flag: cm ? img('Countries', countryId, cm.imageVersion) : null,
          gameCount: 0,
          liveCount: 0,
          competitions: [],
        },
        comps: new Map(),
      });
    }
    const entry = countries.get(countryId)!;
    if (!entry.comps.has(cid)) {
      entry.comps.set(cid, {
        id: cid,
        name: g.competitionDisplayName ?? meta?.name ?? '',
        logo: meta ? competitionLogo(cid, meta.countryId, meta.imageVersion) : null,
        country: entry.group.name,
        matches: [],
      });
    }
    const minute =
      kind === 'live'
        ? g.gameTimeDisplay || (typeof g.gameTime === 'number' && g.gameTime > 0 ? `${Math.floor(g.gameTime)}'` : null)
        : null;
    entry.comps
      .get(cid)!
      .matches.push({ id: g.id, kind, statusText: g.statusText ?? null, minute, startTime: g.startTime ?? null, home, away });
    entry.group.gameCount += 1;
    if (kind === 'live') entry.group.liveCount += 1;
  }
  return [...countries.values()]
    .map(({ group, comps }) => ({ ...group, competitions: [...comps.values()] }))
    .sort((a, b) => b.gameCount - a.gameCount)
    .slice(0, limit);
}

// مباريات بطولة بعينها — جدول (قادمة) + نتائج (منتهية) لصفحة البطولة. كلّ صفّ MatchRow يربط لتفاصيل المباراة.
// المصدر `web/games/fixtures` و`web/games/results` (`competitions={id}`)؛ نُرشِّح لمعرّف البطولة (يُرجع بطولات فرعيّة أيضاً).
export interface CompetitionGames {
  fixtures: SportMatch[];
  results: SportMatch[];
}

async function fetchCompGames(path: 'fixtures' | 'results', competitionId: number): Promise<SportMatch[]> {
  try {
    const res = await fetch(`${BASE}/games/${path}/?${COMMON}&competitions=${competitionId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 120, tags: ['sport-games'] },
    });
    if (!res.ok) return [];
    const parsed = AllScores.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.games ?? [])
      .filter((g) => g.competitionId === competitionId)
      .map((g) => {
        const home = toSide(g.homeCompetitor);
        const away = toSide(g.awayCompetitor);
        const kind = classify(g.statusGroup, home, away);
        const minute =
          kind === 'live'
            ? g.gameTimeDisplay || (typeof g.gameTime === 'number' && g.gameTime > 0 ? `${Math.floor(g.gameTime)}'` : null)
            : null;
        return { id: g.id, kind, statusText: g.statusText ?? null, minute, startTime: g.startTime ?? null, home, away };
      });
  } catch {
    return [];
  }
}

export async function getCompetitionGames(competitionId: number, limit = 25): Promise<CompetitionGames> {
  if (!Number.isInteger(competitionId) || competitionId <= 0) return { fixtures: [], results: [] };
  const [fx, rs] = await Promise.all([fetchCompGames('fixtures', competitionId), fetchCompGames('results', competitionId)]);
  const fixtures = fx.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')).slice(0, limit);
  const results = rs.sort((a, b) => (b.startTime ?? '').localeCompare(a.startTime ?? '')).slice(0, limit);
  return { fixtures, results };
}

function gameToMatch(g: z.infer<typeof Game>): SportMatch {
  const home = toSide(g.homeCompetitor);
  const away = toSide(g.awayCompetitor);
  const kind = classify(g.statusGroup, home, away);
  const minute =
    kind === 'live'
      ? g.gameTimeDisplay || (typeof g.gameTime === 'number' && g.gameTime > 0 ? `${Math.floor(g.gameTime)}'` : null)
      : null;
  return { id: g.id, kind, statusText: g.statusText ?? null, minute, startTime: g.startTime ?? null, home, away };
}

// مباريات فريق (لصفحة اللاعب «المباريات الأخيرة» = مباريات فرقه) — المصدر **`web/games/results|fixtures/?competitors={teamId}`**
// (مفحوص حيًّا: results يردّ سجلّ الفريق الكامل، مثلاً ماذرويل ٢٣ مباراة؛ الـfeed العامّ `games/?competitors` متفرّق).
// نُرشِّح بمعرّف الفريق ونرتّب الأحدث أولاً. ملاحظة: مباريات الفريق لا حضور اللاعب بعينه (غير متاح عامًّا) ⇒ تُؤطَّر بصدق.
export async function getTeamGames(teamId: number, limit = 12): Promise<SportMatch[]> {
  if (!Number.isInteger(teamId) || teamId <= 0) return [];
  const fetchPath = async (path: 'results' | 'fixtures'): Promise<SportMatch[]> => {
    try {
      const res = await fetch(`${BASE}/games/${path}/?${COMMON}&competitors=${teamId}`, {
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 300, tags: ['sport-games'] },
      });
      if (!res.ok) return [];
      const parsed = AllScores.safeParse(await res.json());
      if (!parsed.success) return [];
      return (parsed.data.games ?? [])
        .filter((g) => g.homeCompetitor?.id === teamId || g.awayCompetitor?.id === teamId)
        .map(gameToMatch);
    } catch {
      return [];
    }
  };
  const [rs, fx] = await Promise.all([fetchPath('results'), fetchPath('fixtures')]);
  return [...rs, ...fx].sort((a, b) => (b.startTime ?? '').localeCompare(a.startTime ?? '')).slice(0, limit);
}

// ===== قائمة مباريات البطولة للشريط الجانبيّ (كل المباريات/نتائج/جدول المباريات) — مُجمَّعة بالمجموعة+الجولة =====
// المباريات تحمل groupName/roundName/roundNum/startTime مباشرةً ⇒ عنوان «المجموعة ط - الجولة 1» + تاريخ المجموعة.
export interface MatchGroup {
  label: string;
  date: string | null;
  matches: SportMatch[];
}
export interface CompetitionMatchList {
  today: MatchGroup[];
  upcoming: MatchGroup[];
  recent: MatchGroup[];
  fixtures: MatchGroup[];
  results: MatchGroup[];
}

const ListGame = z
  .object({
    id: z.number(),
    competitionId: z.number().nullish(),
    startTime: z.string().nullish(),
    statusGroup: z.number().nullish(),
    statusText: z.string().nullish(),
    gameTime: z.number().nullish(),
    gameTimeDisplay: z.string().nullish(),
    groupName: z.string().nullish(),
    roundName: z.string().nullish(),
    roundNum: z.number().nullish(),
    homeCompetitor: Competitor.nullish(),
    awayCompetitor: Competitor.nullish(),
  })
  .passthrough();
const ListResponse = z.object({ games: z.array(ListGame).nullish() }).passthrough();

async function fetchCompList(path: 'fixtures' | 'results', competitionId: number): Promise<z.infer<typeof ListGame>[]> {
  try {
    const res = await fetch(`${BASE}/games/${path}/?${COMMON}&competitions=${competitionId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 120, tags: ['sport-games'] },
    });
    if (!res.ok) return [];
    const parsed = ListResponse.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.games ?? []).filter((g) => g.competitionId === competitionId);
  } catch {
    return [];
  }
}

function groupMatches(games: z.infer<typeof ListGame>[]): MatchGroup[] {
  const map = new Map<string, MatchGroup>();
  const order: string[] = [];
  for (const g of games) {
    const round = g.roundNum != null ? `${g.roundName || 'الجولة'} ${g.roundNum}` : g.roundName || '';
    const label = [g.groupName, round].filter(Boolean).join(' - ') || g.roundName || g.groupName || '—';
    if (!map.has(label)) {
      map.set(label, { label, date: g.startTime ?? null, matches: [] });
      order.push(label);
    }
    const home = toSide(g.homeCompetitor);
    const away = toSide(g.awayCompetitor);
    const kind = classify(g.statusGroup, home, away);
    const minute =
      kind === 'live'
        ? g.gameTimeDisplay || (typeof g.gameTime === 'number' && g.gameTime > 0 ? `${Math.floor(g.gameTime)}'` : null)
        : null;
    map.get(label)!.matches.push({ id: g.id, kind, statusText: g.statusText ?? null, minute, startTime: g.startTime ?? null, home, away });
  }
  return order.map((l) => map.get(l)!);
}

const ymd = (iso: string | null | undefined): string => (iso ?? '').slice(0, 10);
const byTimeAsc = (a: z.infer<typeof ListGame>, b: z.infer<typeof ListGame>): number =>
  (a.startTime ?? '').localeCompare(b.startTime ?? '');
const byTimeDesc = (a: z.infer<typeof ListGame>, b: z.infer<typeof ListGame>): number =>
  (b.startTime ?? '').localeCompare(a.startTime ?? '');

// التقسيم بتاريخ اليوم (عمّان، مأخوذ من startTime بإزاحة +03:00): اليوم/القادم/السابق ⇒ «كل المباريات» يبدأ
// بمباريات اليوم ثمّ الجدول ثمّ النتائج الأخيرة (ترتيب 365). تبويبا «نتائج»/«جدول» = كلّ النتائج/الجدول.
export async function getCompetitionMatchList(competitionId: number): Promise<CompetitionMatchList> {
  if (!Number.isInteger(competitionId) || competitionId <= 0)
    return { today: [], upcoming: [], recent: [], fixtures: [], results: [] };
  const today = todayAmman();
  const [fx, rs] = await Promise.all([fetchCompList('fixtures', competitionId), fetchCompList('results', competitionId)]);
  const todayGames = [...rs, ...fx].filter((g) => ymd(g.startTime) === today).sort(byTimeAsc);
  const upcomingGames = fx.filter((g) => ymd(g.startTime) > today).sort(byTimeAsc);
  const recentGames = rs.filter((g) => ymd(g.startTime) < today).sort(byTimeDesc);
  return {
    today: groupMatches(todayGames),
    upcoming: groupMatches(upcomingGames),
    recent: groupMatches(recentGames),
    fixtures: groupMatches([...fx].sort(byTimeAsc)),
    results: groupMatches([...rs].sort(byTimeDesc)),
  };
}

// ===== «الأكثر شيوعاً» (Trends) لكلّ مباراة — نقطة `trends/?games={id}` مفحوصة حيًّا (200) =====
// كلّ عنصر: `text` (إحصاء واقعيّ «فاز X - 9/10 المباريات الأخيرة» ⇒ نُبقيه) + `betCTA`/`odds` (مراهنات ⇒ نُجرّدها
// تماماً التزاماً بالعقد) + `percentage` (الثقة ⇒ مؤشّر اللهب). نُرتّب بالثقة، نُزيل التكرار، نحدّ ٣ أسطر.
const TrendItem = z
  .object({
    text: z.string().nullish(),
    percentage: z.number().nullish(),
    competitorIds: z.array(z.number()).nullish(),
  })
  .passthrough();
const TrendsResponse = z.object({ trends: z.array(TrendItem).nullish() }).passthrough();

export interface TrendLine {
  text: string;
  percentage: number | null;
}

export async function getGameTrends(gameId: number): Promise<TrendLine[]> {
  if (!Number.isInteger(gameId) || gameId <= 0) return [];
  try {
    const res = await fetch(`${BASE}/trends/?${COMMON}&games=${gameId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 300, tags: [`sport-game-${gameId}`] },
    });
    if (!res.ok) return [];
    const parsed = TrendsResponse.safeParse(await res.json());
    if (!parsed.success) return [];
    const seen = new Set<string>();
    const lines: TrendLine[] = [];
    for (const t of parsed.data.trends ?? []) {
      const text = (t.text ?? '').replace(/\s+/g, ' ').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      lines.push({ text, percentage: t.percentage ?? null });
    }
    lines.sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
    return lines.slice(0, 3);
  } catch {
    return [];
  }
}

// ===== Featured (Block: سلايدر المباريات المميّزة) — نمط 365 `featured-games-widget`: عدّة شرائح لأبرز مباريات اليوم
// (مباشر ← قادم فعليّ ← منتهية) مرتّبة بشعبيّة البطولة `popularityRank` المتاح (لا حقل "featured" مخترَع). شعار 82px.
export interface FeaturedMatch {
  id: number;
  competition: string | null;
  competitionLogo: string | null;
  kind: MatchKind;
  statusText: string | null;
  minute: string | null;
  startTime: string | null;
  venue: string | null;
  home: MatchSide;
  away: MatchSide;
}

// جلب اسم الملعب فقط (allscores لا يحويه؛ يأتي من تفاصيل المباراة). خفيف: لا Zod كامل. مُكاش طويلاً (نادر التغيّر).
async function fetchVenue(gameId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${BASE}/game/?appTypeId=5&langId=27&timezoneName=Asia/Amman&userCountryId=6&gameId=${gameId}`,
      { signal: AbortSignal.timeout(6000), next: { revalidate: 300, tags: [`sport-game-${gameId}`] } },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { game?: { venue?: { name?: string | null } | null } | null };
    return j?.game?.venue?.name ?? null;
  } catch {
    return null;
  }
}

export async function getFeaturedMatches(
  sportId = 1,
  date?: string,
  limit = 8,
  priority: number[] = [],
): Promise<FeaturedMatch[]> {
  const data = await fetchAllScores(sportId, date);
  if (!data?.games?.length) return [];
  const popById = new Map<number, number>();
  const compMeta = new Map<number, { countryId: number | null; imageVersion: number | null }>();
  for (const c of data.competitions ?? []) {
    popById.set(c.id, c.popularityRank ?? Number.MAX_SAFE_INTEGER);
    compMeta.set(c.id, { countryId: c.countryId ?? null, imageVersion: c.imageVersion ?? null });
  }
  const pop = (g: z.infer<typeof Game>) => popById.get(g.competitionId ?? -1) ?? Number.MAX_SAFE_INTEGER;
  // طبقة الأولويّة: مباشر(0) ← قادم فعليّ مستقبليّ(1) ← منتهية(2) ← غير مؤهّلة(3: مؤجّلة/«نتيجة نهائية فقط» ماضية)
  const tier = (g: z.infer<typeof Game>): number => {
    if (g.statusGroup === 3) return 0;
    const upcoming =
      (g.homeCompetitor?.score ?? -1) < 0 &&
      (g.awayCompetitor?.score ?? -1) < 0 &&
      !!g.startTime &&
      new Date(g.startTime).getTime() > Date.now();
    if (upcoming) return 1;
    if ((g.homeCompetitor?.score ?? -1) >= 0 && (g.awayCompetitor?.score ?? -1) >= 0) return 2;
    return 3;
  };
  // أولويّة بطولات مطلوبة (مثل كأس العالم) في صدارة الهيرو، ثمّ الطبقة (مباشر/قادم/منتهٍ) فالشعبيّة.
  const prioritySet = new Set(priority);
  const prio = (g: z.infer<typeof Game>) => (prioritySet.has(g.competitionId ?? -1) ? 0 : 1);
  const ranked = [...data.games]
    .filter((g) => tier(g) < 3)
    .sort((a, b) => prio(a) - prio(b) || tier(a) - tier(b) || pop(a) - pop(b))
    .slice(0, limit);
  const base: FeaturedMatch[] = ranked.map((g) => {
    const home = toSide(g.homeCompetitor);
    const away = toSide(g.awayCompetitor);
    const kind = classify(g.statusGroup, home, away);
    const meta = compMeta.get(g.competitionId ?? -1);
    const minute =
      kind === 'live'
        ? g.gameTimeDisplay || (typeof g.gameTime === 'number' && g.gameTime > 0 ? `${Math.floor(g.gameTime)}'` : null)
        : null;
    return {
      id: g.id,
      competition: g.competitionDisplayName ?? null,
      competitionLogo: meta ? competitionLogo(g.competitionId ?? -1, meta.countryId, meta.imageVersion) : null,
      kind,
      statusText: g.statusText ?? null,
      minute,
      startTime: g.startTime ?? null,
      venue: null,
      home: { ...home, logo: g.homeCompetitor ? img('Competitors', g.homeCompetitor.id, g.homeCompetitor.imageVersion, 82) : null },
      away: { ...away, logo: g.awayCompetitor ? img('Competitors', g.awayCompetitor.id, g.awayCompetitor.imageVersion, 82) : null },
    };
  });
  // إثراء الملعب لكلّ شريحة (allscores بلا venue) — متوازٍ ومُكاش.
  const venues = await Promise.all(base.map((b) => fetchVenue(b.id)));
  return base.map((b, i) => ({ ...b, venue: venues[i] }));
}

// ===== Competitions / Countries / Popular Teams (Blocks) — مرتّبة بحقل popularity من المصدر =====
export interface CompetitionItem {
  id: number;
  name: string;
  logo: string | null;
  totalGames: number;
  liveGames: number;
}
export interface CountryItem {
  id: number;
  name: string;
  flag: string | null;
  totalGames: number;
}
export interface TeamItem {
  id: number;
  name: string;
  logo: string | null;
  color: string | null;
}

export async function getCompetitions(sportId = 1, limit = 20): Promise<CompetitionItem[]> {
  const data = await fetchAllScores(sportId);
  if (!data?.competitions) return [];
  return [...data.competitions]
    .sort((a, b) => (a.popularityRank ?? Infinity) - (b.popularityRank ?? Infinity))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      logo: img('Competitions', c.id, c.imageVersion),
      totalGames: c.totalGames ?? 0,
      liveGames: c.liveGames ?? 0,
    }));
}

export async function getCountries(sportId = 1, limit = 20): Promise<CountryItem[]> {
  const data = await fetchAllScores(sportId);
  if (!data?.countries) return [];
  return [...data.countries]
    .sort((a, b) => (b.totalGames ?? 0) - (a.totalGames ?? 0))
    .slice(0, limit)
    .map((c) => ({ id: c.id, name: c.name, flag: img('Countries', c.id, c.imageVersion), totalGames: c.totalGames ?? 0 }));
}

export async function getPopularTeams(sportId = 1, limit = 20): Promise<TeamItem[]> {
  const data = await fetchAllScores(sportId);
  if (!data?.competitors) return [];
  return [...data.competitors]
    .sort((a, b) => (a.popularityRank ?? Infinity) - (b.popularityRank ?? Infinity))
    .slice(0, limit)
    .map((t) => ({ id: t.id, name: t.name, logo: img('Competitors', t.id, t.imageVersion), color: t.color ?? null }));
}

// صورة لاعب من 365 (قصّ الوجه) — للتشكيلة المرئيّة. بلا نسخة ⇒ null (لا تلفيق).
function athletePhoto(athleteId: number, version: number | null): string | null {
  if (version == null) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_62,h_62,c_limit,q_auto:eco,dpr_2,d_Athletes:default.png,r_max,c_thumb,g_face,z_0.65/v${version}/Athletes/${athleteId}`;
}
// شعار نادي اللاعب (بادج صغير في التشكيلة) — بلا نسخة (نمط 365).
function competitorLogoSimple(id: number): string {
  return `https://imagecache.365scores.com/image/upload/f_png,w_24,h_24,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/Competitors/${id}`;
}

// ===== Game Detail (Block: صفحة تفاصيل المباراة) — نقطة `web/game/?gameId=` (appTypeId=5) =====
const GameEvent = z
  .object({
    competitorId: z.number().nullish(),
    gameTimeDisplay: z.string().nullish(),
    gameTime: z.number().nullish(),
    addedTime: z.number().nullish(), // وقت بدل ضائع («90+3»)
    stageId: z.number().nullish(), // الشوط الذي يقع فيه الحدث
    playerId: z.number().nullish(),
    extraPlayers: z.array(z.number()).nullish(), // للتبديل: [0] = اللاعب الخارج
    isMajor: z.boolean().nullish(), // حدث بارز (لفلتر «الأبرز»)
    eventType: z.object({ id: z.number().nullish(), name: z.string().nullish() }).passthrough().nullish(),
  })
  .passthrough();
const GameStage = z
  .object({ id: z.number(), name: z.string().nullish(), homeCompetitorScore: z.number().nullish(), awayCompetitorScore: z.number().nullish() })
  .passthrough();
const Member = z
  .object({
    // ليس دائمًا موجودًا (فجوة بيانات حقيقيّة من 365 لبعض اللاعبين — راجع تحقيق مباراة 4747697).
    // athleteId هو الهويّة المُعتمَدة عند التطبيع؛ id هو مفتاح الربط المحليّ لهذه المباراة فقط
    // (يطابق LineupMember.id وGameEvent.playerId — ليس athleteId، تحقّق حيّ لا افتراض).
    id: z.number().nullish(),
    athleteId: z.number().nullish(),
    name: z.string().nullish(),
    shortName: z.string().nullish(),
    jerseyNumber: z.number().nullish(),
    imageVersion: z.number().nullish(),
  })
  .passthrough();
const LineupMember = z
  .object({
    // نفس فجوة Member.id أعلاه — مفتاح ربط محليّ قد يغيب لنفس السبب.
    id: z.number().nullish(),
    status: z.number().nullish(), // 1 = أساسيّ
    position: z.object({ name: z.string().nullish() }).passthrough().nullish(),
    ranking: z.number().nullish(),
    competitorId: z.number().nullish(), // نادي اللاعب (شعار بادج صغير)
    yardFormation: z
      .object({ fieldLine: z.number().nullish(), fieldSide: z.number().nullish() })
      .passthrough()
      .nullish(), // fieldLine=العمق 0→100، fieldSide=العرض 0→100 (لعرض الملعب)
  })
  .passthrough();
const Lineups = z
  .object({ formation: z.string().nullish(), members: z.array(LineupMember).nullish() })
  .passthrough();
const DetailCompetitor = Competitor.extend({ lineups: Lineups.nullish() });
// أهم اللاعبين (topPerformers) — فئات (الهجوم/الوسط/الدفاع)، لكلٍّ لاعب مضيف/ضيف + إحصاءاته.
const TPStat = z.object({ name: z.string().nullish(), value: z.string().nullish() }).passthrough();
const TPPlayer = z
  .object({
    athleteId: z.number().nullish(),
    id: z.number().nullish(),
    name: z.string().nullish(),
    shortName: z.string().nullish(),
    positionName: z.string().nullish(),
    imageVersion: z.number().nullish(),
    stats: z.array(TPStat).nullish(),
  })
  .passthrough();
const TPCategory = z.object({ name: z.string().nullish(), homePlayer: TPPlayer.nullish(), awayPlayer: TPPlayer.nullish() }).passthrough();
const TopPerformersZ = z.object({ categories: z.array(TPCategory).nullish() }).passthrough();
function tpPlayer(p: z.infer<typeof TPPlayer> | null | undefined): TopPerfPlayer | null {
  if (!p) return null;
  const id = p.athleteId ?? p.id;
  if (id == null) return null;
  return {
    id,
    name: p.shortName || p.name || null,
    photo: athletePhoto(id, p.imageVersion ?? null),
    position: p.positionName ?? null,
    stats: (p.stats ?? []).filter((s) => s.name).map((s) => ({ name: s.name as string, value: s.value ?? '' })),
  };
}
const DetailGame = Game.extend({
  homeCompetitor: DetailCompetitor.nullish(),
  awayCompetitor: DetailCompetitor.nullish(),
  roundName: z.string().nullish(),
  roundNum: z.number().nullish(),
  groupName: z.string().nullish(),
  venue: z.object({ name: z.string().nullish(), capacity: z.number().nullish() }).passthrough().nullish(),
  events: z.array(GameEvent).nullish(),
  members: z.array(Member).nullish(),
  officials: z.array(z.object({ name: z.string().nullish() }).passthrough()).nullish(),
  hasLineups: z.boolean().nullish(),
  hasStats: z.boolean().nullish(),
  hasPreviousMeetings: z.boolean().nullish(),
  topPerformers: TopPerformersZ.nullish(),
  stages: z.array(GameStage).nullish(),
});
const GameResponse = z.object({ game: DetailGame.nullish(), competitions: z.array(Competition).nullish() }).passthrough();

export type MatchEventType = 'goal' | 'yellow' | 'red' | 'sub';
export interface MatchEvent {
  minute: string | null;
  side: 'home' | 'away';
  type: MatchEventType;
  player: string | null;
}
export interface LineupPlayer {
  id: number; // athleteId (لرابط ملف اللاعب)
  name: string;
  jersey: number | null;
  position: string | null;
  ranking: number | null;
  photo: string | null;
  clubLogo: string | null;
  x: number | null; // fieldSide 0..100 (عرض الملعب)
  y: number | null; // fieldLine 0..100 (عمق: 0=حارس)
}
export interface TeamLineup {
  formation: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}
export interface TopPerfPlayer {
  id: number; // athleteId (لرابط ملف اللاعب)
  name: string | null;
  photo: string | null;
  position: string | null;
  stats: { name: string; value: string }[];
}
export interface TopPerfCategory {
  name: string; // الهجوم / الوسط / الدفاع
  home: TopPerfPlayer | null;
  away: TopPerfPlayer | null;
}
// «مجريات» (سرد الأحداث) — حدث ثنائيّ الجانب على خطّ زمنيّ، مُجمَّع بالأشواط.
export type CommentaryType = 'goal' | 'yellow' | 'red' | 'sub' | 'woodwork' | 'other';
export interface CommentaryPlayer {
  id: number;
  name: string | null;
  photo: string | null;
}
export interface CommentaryEvent {
  side: 'home' | 'away';
  minute: string; // «41» أو «90+3»
  type: CommentaryType;
  major: boolean; // isMajor (لفلتر «الأبرز»)
  player: CommentaryPlayer | null; // اللاعب (الداخل في التبديل)
  playerOut: CommentaryPlayer | null; // اللاعب الخارج (تبديل فقط)
}
export interface CommentaryStage {
  name: string; // «شوط» / «نهاية ال 90 دقيقة»
  homeScore: number | null;
  awayScore: number | null;
  events: CommentaryEvent[]; // الأحدث أوّلاً
}
export interface GameDetail {
  id: number;
  competitionId: number | null;
  competition: string | null;
  competitionLogo: string | null;
  round: string | null;
  group: string | null;
  venue: string | null;
  venueCapacity: number | null;
  startTime: string | null;
  kind: MatchKind;
  statusText: string | null;
  minute: string | null;
  home: MatchSide;
  away: MatchSide;
  homeId: number | null;
  awayId: number | null;
  events: MatchEvent[];
  referee: string | null;
  homeLineup: TeamLineup | null;
  awayLineup: TeamLineup | null;
  hasLineups: boolean;
  hasStats: boolean;
  hasPreviousMeetings: boolean;
  topPerformers: TopPerfCategory[];
  commentary: CommentaryStage[]; // مجريات المباراة مُجمَّعة بالأشواط (الأحدث أوّلاً)
}

// خريطة نوع الحدث بالـid (موثوقة؛ الأسماء قد تكون إنجليزيّة في المصدر). الثانويّ (woodwork…) يُتجاهَل.
function eventKind(id: number | null | undefined): MatchEventType | null {
  switch (id) {
    case 1:
      return 'goal';
    case 2:
      return 'yellow';
    case 3:
      return 'red';
    case 1000:
      return 'sub';
    default:
      return null;
  }
}

// نوع حدث «المجريات» (أوسع من eventKind: يشمل الخشب وغيره بلا حذف).
function commentaryType(id: number | null | undefined): CommentaryType {
  switch (id) {
    case 1:
      return 'goal';
    case 2:
      return 'yellow';
    case 3:
      return 'red';
    case 1000:
      return 'sub';
    case 12:
      return 'woodwork';
    default:
      return 'other';
  }
}
function eventMinute(e: z.infer<typeof GameEvent>): string {
  const base = e.gameTimeDisplay != null ? String(e.gameTimeDisplay) : e.gameTime != null ? String(Math.floor(e.gameTime)) : '';
  return e.addedTime ? `${base}+${e.addedTime}` : base;
}

export async function getGameDetail(gameId: number): Promise<GameDetail | null> {
  try {
    const res = await fetch(
      `${BASE}/game/?appTypeId=5&langId=27&timezoneName=Asia/Amman&userCountryId=6&gameId=${gameId}`,
      { signal: AbortSignal.timeout(6000), next: { revalidate: 30, tags: [`sport-game-${gameId}`] } },
    );
    if (!res.ok) return null;
    const parsed = GameResponse.safeParse(await res.json());
    if (!parsed.success || !parsed.data.game) return null;
    const g = parsed.data.game;
    const home = { ...toSide(g.homeCompetitor), logo: g.homeCompetitor ? img('Competitors', g.homeCompetitor.id, g.homeCompetitor.imageVersion, 96) : null };
    const away = { ...toSide(g.awayCompetitor), logo: g.awayCompetitor ? img('Competitors', g.awayCompetitor.id, g.awayCompetitor.imageVersion, 96) : null };
    const kind = classify(g.statusGroup, home, away);
    const compMeta = (parsed.data.competitions ?? []).find((c) => c.id === g.competitionId);
    const memberInfo = new Map<number, { athleteId: number; name: string; jersey: number | null; photo: string | null }>();
    for (const mm of g.members ?? []) {
      // المعرّف الكنّونيّ (canonical) لهذا اللاعب: athleteId إن وُجد وإلّا id. لاعب بلا كليهما
      // يُتجاوَز هو وحده (لا تفشل المباراة كاملة) — راجع تحقيق مباراة 4747697.
      const playerId = mm.athleteId ?? mm.id;
      if (playerId == null) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[sport/games] عضو بلا id ولا athleteId — تجاوَزناه', mm);
        }
        continue;
      }
      // مفتاح الخريطة يبقى id المحليّ عمدًا (لا playerId): هو ما يطابقه LineupMember.id
      // وGameEvent.playerId فعليًّا (تحقّق حيّ)، وليس athleteId — تبديله يكسر كلّ ربط تشكيلة/مجريات.
      if (mm.id != null) {
        memberInfo.set(mm.id, {
          athleteId: playerId,
          name: mm.shortName || mm.name || '',
          jersey: mm.jerseyNumber ?? null,
          photo: athletePhoto(playerId, mm.imageVersion ?? null),
        });
      }
    }
    const events: MatchEvent[] = [];
    for (const e of g.events ?? []) {
      const type = eventKind(e.eventType?.id);
      if (!type) continue;
      events.push({
        minute: e.gameTimeDisplay ?? null,
        side: e.competitorId === g.homeCompetitor?.id ? 'home' : 'away',
        type,
        player: e.playerId != null ? memberInfo.get(e.playerId)?.name ?? null : null,
      });
    }
    const buildLineup = (lu: z.infer<typeof Lineups> | null | undefined): TeamLineup | null => {
      if (!lu?.members?.length) return null;
      const rows = lu.members
        .map((mm) => {
          const info = mm.id != null ? memberInfo.get(mm.id) : undefined;
          // نفس التطبيع الكنّونيّ: athleteId (عبر memberInfo) إن وُجد، وإلّا id المحليّ.
          const playerId = info?.athleteId ?? mm.id;
          if (playerId == null) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[sport/games] لاعب تشكيلة بلا id ولا athleteId — تجاوَزناه', mm);
            }
            return null;
          }
          return {
            player: {
              id: playerId,
              name: info?.name ?? '',
              jersey: info?.jersey ?? null,
              position: mm.position?.name ?? null,
              ranking: mm.ranking ?? null,
              photo: info?.photo ?? null,
              clubLogo: mm.competitorId != null ? competitorLogoSimple(mm.competitorId) : null,
              x: mm.yardFormation?.fieldSide ?? null,
              y: mm.yardFormation?.fieldLine ?? null,
            } satisfies LineupPlayer,
            starting: mm.status === 1,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      return {
        formation: lu.formation ?? null,
        starters: rows.filter((r) => r.starting).map((r) => r.player),
        bench: rows.filter((r) => !r.starting).map((r) => r.player),
      };
    };
    const minute =
      kind === 'live'
        ? g.gameTimeDisplay || (typeof g.gameTime === 'number' && g.gameTime > 0 ? `${Math.floor(g.gameTime)}'` : null)
        : null;

    // «مجريات»: أحداث مُجمَّعة بالأشواط، الأشواط معكوسة (الأحدث أوّلاً) والأحداث داخلها الأحدث أوّلاً. الشوط بلا أحداث يُسقَط.
    const cPlayer = (id: number | null | undefined): CommentaryPlayer | null => {
      if (id == null) return null;
      const mi = memberInfo.get(id);
      return mi ? { id: mi.athleteId, name: mi.name || null, photo: mi.photo } : null;
    };
    const evByStage = new Map<number, CommentaryEvent[]>();
    for (const e of g.events ?? []) {
      const ctype = commentaryType(e.eventType?.id);
      const ev: CommentaryEvent = {
        side: e.competitorId === g.homeCompetitor?.id ? 'home' : 'away',
        minute: eventMinute(e),
        type: ctype,
        major: !!e.isMajor,
        player: cPlayer(e.playerId),
        playerOut: ctype === 'sub' ? cPlayer(e.extraPlayers?.[0]) : null,
      };
      const sid = e.stageId ?? 0;
      const arr = evByStage.get(sid) ?? [];
      arr.push(ev);
      evByStage.set(sid, arr);
    }
    const commentary: CommentaryStage[] = [];
    for (const s of [...(g.stages ?? [])].reverse()) {
      const evs = evByStage.get(s.id);
      if (!evs || evs.length === 0) continue;
      commentary.push({ name: s.name ?? '', homeScore: s.homeCompetitorScore ?? null, awayScore: s.awayCompetitorScore ?? null, events: [...evs].reverse() });
    }

    return {
      id: g.id,
      competitionId: g.competitionId ?? null,
      competition: g.competitionDisplayName ?? null,
      competitionLogo: compMeta ? competitionLogo(compMeta.id, compMeta.countryId, compMeta.imageVersion) : null,
      round: g.roundName ? (g.roundNum != null ? `${g.roundName} ${g.roundNum}` : g.roundName) : null,
      group: g.groupName ?? null,
      venue: g.venue?.name ?? null,
      venueCapacity: g.venue?.capacity ?? null,
      startTime: g.startTime ?? null,
      kind,
      statusText: g.statusText ?? null,
      minute,
      home,
      away,
      homeId: g.homeCompetitor?.id ?? null,
      awayId: g.awayCompetitor?.id ?? null,
      events,
      referee: g.officials?.[0]?.name ?? null,
      homeLineup: buildLineup(g.homeCompetitor?.lineups),
      awayLineup: buildLineup(g.awayCompetitor?.lineups),
      hasLineups: !!g.hasLineups,
      hasStats: !!g.hasStats,
      hasPreviousMeetings: !!g.hasPreviousMeetings,
      topPerformers: (g.topPerformers?.categories ?? [])
        .map((c) => ({ name: c.name ?? '', home: tpPlayer(c.homePlayer), away: tpPlayer(c.awayPlayer) }))
        .filter((c) => c.name && (c.home || c.away)),
      commentary,
    };
  } catch {
    return null;
  }
}

// ===== Game Stats (تبويب الإحصائيات) — نقطة `web/game/stats/?...&games={id}` (تحتاج `games=` لا `gameId=`) =====
const StatEntry = z
  .object({
    id: z.number(),
    name: z.string(),
    competitorId: z.number(),
    isMajor: z.boolean().nullish(),
    categoryName: z.string().nullish(),
    value: z.string().nullish(),
    order: z.number().nullish(),
  })
  .passthrough();
const StatsResponse = z
  .object({
    statistics: z.array(StatEntry).nullish(),
    games: z
      .array(
        z
          .object({
            id: z.number(),
            homeCompetitor: z.object({ id: z.number() }).passthrough().nullish(),
            awayCompetitor: z.object({ id: z.number() }).passthrough().nullish(),
          })
          .passthrough(),
      )
      .nullish(),
  })
  .passthrough();

export interface MatchStat {
  name: string;
  category: string | null;
  homeValue: string;
  awayValue: string;
  homeShare: number; // نسبة شريط المضيف 0..1
}

// أوّل رقم في النصّ (لشريط المقارنة): "64%"→64، "12/13 (92%)"→12، "1.6"→1.6.
function statNum(v: string | null | undefined): number {
  if (!v) return 0;
  const m = v.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

export async function getGameStats(gameId: number): Promise<MatchStat[]> {
  try {
    const res = await fetch(
      `${BASE}/game/stats/?appTypeId=5&langId=27&timezoneName=Asia/Amman&userCountryId=6&games=${gameId}`,
      { signal: AbortSignal.timeout(6000), next: { revalidate: 30, tags: [`sport-game-${gameId}`] } },
    );
    if (!res.ok) return [];
    const parsed = StatsResponse.safeParse(await res.json());
    if (!parsed.success) return [];
    const game = parsed.data.games?.find((g) => g.id === gameId) ?? parsed.data.games?.[0];
    const homeId = game?.homeCompetitor?.id;
    const awayId = game?.awayCompetitor?.id;
    if (homeId == null || awayId == null) return [];
    const byId = new Map<number, { name: string; category: string | null; order: number; home?: string; away?: string }>();
    for (const s of parsed.data.statistics ?? []) {
      let row = byId.get(s.id);
      if (!row) {
        row = { name: s.name, category: s.categoryName || null, order: s.order ?? 0 };
        byId.set(s.id, row);
      }
      if (s.competitorId === homeId) row.home = s.value ?? undefined;
      else if (s.competitorId === awayId) row.away = s.value ?? undefined;
    }
    return [...byId.values()]
      .filter((r) => r.home != null || r.away != null)
      .sort((a, b) => a.order - b.order)
      .map((r) => {
        const hn = statNum(r.home);
        const an = statNum(r.away);
        return {
          name: r.name,
          category: r.category,
          homeValue: r.home ?? '—',
          awayValue: r.away ?? '—',
          homeShare: hn + an > 0 ? hn / (hn + an) : 0.5,
        };
      });
  } catch {
    return [];
  }
}

// ===== إحصاء ما قبل المباراة (نمط 365 pre-game-stats) — نقطة `web/stats/preGame?game={id}` (مفحوصة حيًّا) =====
// مقارنة الفريقين عبر مبارياتهما الأخيرة: مجموعتان (كل المسابقات % + معدّل الإحصائيات)، صفّ لكلّ مقياس (مضيف/ضيف)،
// و`markedTeam` (1=مضيف·2=ضيف) للقيمة المظلَّلة. نُجرّد `bettingOpportunity`/odds تماماً (العقد). null عند الفشل.
export interface PreGameStatRow {
  name: string;
  home: string;
  away: string;
  marked: 'home' | 'away' | null;
}
export interface PreGameStatGroup {
  title: string;
  rows: PreGameStatRow[];
}
export interface PreGameStats {
  homeText: string | null;
  awayText: string | null;
  groups: PreGameStatGroup[];
}

const PreGameStat = z
  .object({
    id: z.number(),
    name: z.string().nullish(),
    competitorId: z.number().nullish(),
    value: z.string().nullish(),
    statisticGroup: z.number().nullish(),
    markedTeam: z.number().nullish(),
  })
  .passthrough();
const PreGameResponse = z
  .object({
    statistics: z.array(PreGameStat).nullish(),
    statisticsGroups: z.array(z.object({ id: z.number(), name: z.string().nullish() }).passthrough()).nullish(),
    statisticGamesPlayed: z
      .object({ homeText: z.string().nullish(), awayText: z.string().nullish() })
      .passthrough()
      .nullish(),
    games: z
      .array(
        z
          .object({
            homeCompetitor: z.object({ id: z.number() }).passthrough().nullish(),
            awayCompetitor: z.object({ id: z.number() }).passthrough().nullish(),
          })
          .passthrough(),
      )
      .nullish(),
  })
  .passthrough();

export async function getPreGameStats(gameId: number): Promise<PreGameStats | null> {
  if (!Number.isInteger(gameId) || gameId <= 0) return null;
  try {
    const res = await fetch(`${BASE}/stats/preGame?${COMMON}&game=${gameId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 300, tags: [`sport-game-${gameId}`] },
    });
    if (!res.ok) return null;
    const parsed = PreGameResponse.safeParse(await res.json());
    if (!parsed.success) return null;
    const d = parsed.data;
    const homeId = d.games?.[0]?.homeCompetitor?.id ?? null;
    const awayId = d.games?.[0]?.awayCompetitor?.id ?? null;
    if (homeId == null || awayId == null) return null;
    const groupName = new Map<number, string>();
    for (const g of d.statisticsGroups ?? []) groupName.set(g.id, g.name ?? '');
    const groupRows = new Map<number, Map<number, PreGameStatRow>>();
    const order: number[] = [];
    for (const s of d.statistics ?? []) {
      const gid = s.statisticGroup ?? 0;
      if (!groupRows.has(gid)) {
        groupRows.set(gid, new Map());
        order.push(gid);
      }
      const rows = groupRows.get(gid) as Map<number, PreGameStatRow>;
      let row = rows.get(s.id);
      if (!row) {
        row = { name: s.name ?? '', home: '-', away: '-', marked: null };
        rows.set(s.id, row);
      }
      if (s.competitorId === homeId) row.home = s.value ?? '-';
      else if (s.competitorId === awayId) row.away = s.value ?? '-';
      if (s.markedTeam === 1) row.marked = 'home';
      else if (s.markedTeam === 2) row.marked = 'away';
    }
    const groups = order
      .map((gid) => ({ title: groupName.get(gid) ?? '', rows: [...(groupRows.get(gid) as Map<number, PreGameStatRow>).values()] }))
      .filter((g) => g.rows.length > 0);
    if (groups.length === 0) return null;
    return { homeText: d.statisticGamesPlayed?.homeText ?? null, awayText: d.statisticGamesPlayed?.awayText ?? null, groups };
  } catch {
    return null;
  }
}

// ===== «شائع» لصفحة المباراة (نمط 365 trends-widget) — `web/trends/?games={id}` =====
// مُجمَّع بالفريق + «أفضل تريند» (التريندات ذات confidenceTrendIds) + 🔥 للعالية (percentage≥0.95). نُجرّد betCTA/odds.
export interface MatchTrendLine {
  text: string;
  flame: boolean;
}
export interface MatchTrendTeam {
  teamId: number | null;
  teamName: string | null;
  teamLogo: string | null;
  trends: MatchTrendLine[];
}
export interface MatchTrends {
  top: { teamName: string | null; teamLogo: string | null; lines: string[] } | null;
  teams: MatchTrendTeam[];
}

const MatchTrendItem = z
  .object({
    text: z.string().nullish(),
    percentage: z.number().nullish(),
    competitorIds: z.array(z.number()).nullish(),
    confidenceTrendIds: z.array(z.number()).nullish(),
  })
  .passthrough();
const MatchTrendsResponse = z
  .object({
    trends: z.array(MatchTrendItem).nullish(),
    competitors: z.array(z.object({ id: z.number(), name: z.string(), imageVersion: z.number().nullish() }).passthrough()).nullish(),
  })
  .passthrough();

export async function getMatchTrends(gameId: number): Promise<MatchTrends | null> {
  if (!Number.isInteger(gameId) || gameId <= 0) return null;
  try {
    const res = await fetch(`${BASE}/trends/?${COMMON}&games=${gameId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 300, tags: [`sport-game-${gameId}`] },
    });
    if (!res.ok) return null;
    const parsed = MatchTrendsResponse.safeParse(await res.json());
    if (!parsed.success) return null;
    const comp = new Map<number, { name: string; logo: string | null }>();
    for (const c of parsed.data.competitors ?? []) comp.set(c.id, { name: c.name, logo: img('Competitors', c.id, c.imageVersion, 24) });
    const byTeam = new Map<number, MatchTrendTeam>();
    const order: number[] = [];
    const topLines: { teamId: number; text: string }[] = [];
    for (const t of parsed.data.trends ?? []) {
      const text = (t.text ?? '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const cid = (t.competitorIds ?? [])[0] ?? -1;
      if (!byTeam.has(cid)) {
        byTeam.set(cid, { teamId: cid > 0 ? cid : null, teamName: comp.get(cid)?.name ?? null, teamLogo: comp.get(cid)?.logo ?? null, trends: [] });
        order.push(cid);
      }
      (byTeam.get(cid) as MatchTrendTeam).trends.push({ text, flame: (t.percentage ?? 0) >= 0.95 });
      if ((t.confidenceTrendIds ?? []).length > 0) topLines.push({ teamId: cid, text });
    }
    const teams = order.map((c) => byTeam.get(c) as MatchTrendTeam).filter((t) => t.trends.length > 0);
    if (teams.length === 0) return null;
    let top: MatchTrends['top'] = null;
    if (topLines.length > 0) {
      const tid = topLines[0].teamId;
      top = { teamName: comp.get(tid)?.name ?? null, teamLogo: comp.get(tid)?.logo ?? null, lines: topLines.filter((l) => l.teamId === tid).map((l) => l.text) };
    }
    return { top, teams };
  } catch {
    return null;
  }
}

// ===== المواجهات المباشرة (نمط 365 h2h) — `web/games/h2h/?gameId={id}` (مفحوص حيًّا) =====
// game.h2hGames = مواجهات الفريقين السابقة، و homeCompetitor/awayCompetitor.recentGames = أداء كلّ فريق (آخر مبارياته).
// الملخّص (فوز/تعادل/فوز) و W/D/L محسوبة من النتائج. مباراة بلا تاريخ ⇒ meetings فارغة (حالة صادقة، كـ365).
export interface H2HSide {
  name: string;
  score: number | null;
}
export interface H2HMeeting {
  id: number;
  competition: string | null;
  date: string | null;
  homeId: number | null; // صاحب الأرض في تلك المواجهة (لفلتر «على أرضه/خارج أرضه»)
  home: H2HSide;
  away: H2HSide;
}
export interface H2HFormGame extends H2HMeeting {
  outcome: 'W' | 'D' | 'L';
  wasHome: boolean; // هل لعب الفريق صاحب الأداء هذه المباراة على أرضه؟ (للفلتر)
}
export interface H2HTeamForm {
  teamId: number;
  teamName: string | null;
  teamLogo: string | null;
  games: H2HFormGame[];
}
export interface H2H {
  homeTeam: { id: number; name: string | null; logo: string | null };
  awayTeam: { id: number; name: string | null; logo: string | null };
  record: { homeWins: number; draws: number; awayWins: number } | null;
  meetings: H2HMeeting[];
  forms: H2HTeamForm[];
}

const H2HCompetitor = z
  .object({ id: z.number(), name: z.string().nullish(), score: z.number().nullish(), imageVersion: z.number().nullish() })
  .passthrough();
const H2HGameZ = z
  .object({
    id: z.number().nullish(),
    competitionDisplayName: z.string().nullish(),
    startTime: z.string().nullish(),
    homeCompetitor: H2HCompetitor.nullish(),
    awayCompetitor: H2HCompetitor.nullish(),
  })
  .passthrough();
const H2HMain = z
  .object({ id: z.number(), name: z.string().nullish(), imageVersion: z.number().nullish(), recentGames: z.array(H2HGameZ).nullish() })
  .passthrough();
const H2HResponse = z
  .object({
    game: z
      .object({ homeCompetitor: H2HMain.nullish(), awayCompetitor: H2HMain.nullish(), h2hGames: z.array(H2HGameZ).nullish() })
      .passthrough()
      .nullish(),
  })
  .passthrough();

function h2hSide(c: z.infer<typeof H2HCompetitor> | null | undefined): H2HSide {
  return { name: c?.name ?? '', score: typeof c?.score === 'number' && c.score >= 0 ? c.score : null };
}
function scoreOf(g: z.infer<typeof H2HGameZ>, teamId: number): number | null {
  if (g.homeCompetitor?.id === teamId) return h2hSide(g.homeCompetitor).score;
  if (g.awayCompetitor?.id === teamId) return h2hSide(g.awayCompetitor).score;
  return null;
}
function toMeeting(g: z.infer<typeof H2HGameZ>): H2HMeeting {
  return {
    id: g.id ?? 0,
    competition: g.competitionDisplayName ?? null,
    date: g.startTime ?? null,
    homeId: g.homeCompetitor?.id ?? null,
    home: h2hSide(g.homeCompetitor),
    away: h2hSide(g.awayCompetitor),
  };
}

export async function getH2H(gameId: number): Promise<H2H | null> {
  if (!Number.isInteger(gameId) || gameId <= 0) return null;
  try {
    const res = await fetch(`${BASE}/games/h2h/?${COMMON}&gameId=${gameId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 600, tags: [`sport-game-${gameId}`] },
    });
    if (!res.ok) return null;
    const parsed = H2HResponse.safeParse(await res.json());
    if (!parsed.success || !parsed.data.game?.homeCompetitor || !parsed.data.game.awayCompetitor) return null;
    const g = parsed.data.game;
    const home = g.homeCompetitor as z.infer<typeof H2HMain>;
    const away = g.awayCompetitor as z.infer<typeof H2HMain>;
    const homeTeam = { id: home.id, name: home.name ?? null, logo: img('Competitors', home.id, home.imageVersion, 55) };
    const awayTeam = { id: away.id, name: away.name ?? null, logo: img('Competitors', away.id, away.imageVersion, 55) };

    const meetingsRaw = (g.h2hGames ?? []).filter((m) => m.id !== gameId);
    let homeWins = 0,
      draws = 0,
      awayWins = 0;
    for (const m of meetingsRaw) {
      const hs = scoreOf(m, home.id);
      const as = scoreOf(m, away.id);
      if (hs == null || as == null) continue;
      if (hs > as) homeWins++;
      else if (hs < as) awayWins++;
      else draws++;
    }
    const meetings = meetingsRaw.map(toMeeting);

    const buildForm = (team: { id: number; name: string | null; logo: string | null }, games: z.infer<typeof H2HGameZ>[]): H2HTeamForm => ({
      teamId: team.id,
      teamName: team.name,
      teamLogo: team.logo,
      // نحتفظ بعدد أكبر (12) كي يجد فلتر «على أرضه/خارج أرضه» مادّة كافية؛ المكوّن يعرض 5 لكلّ وضع (كـ365).
      games: games.slice(0, 12).map((rg) => {
        const ts = scoreOf(rg, team.id);
        const m = toMeeting(rg);
        const wasHome = rg.homeCompetitor?.id === team.id;
        const opp = wasHome ? h2hSide(rg.awayCompetitor).score : h2hSide(rg.homeCompetitor).score;
        const outcome: 'W' | 'D' | 'L' = ts == null || opp == null ? 'D' : ts > opp ? 'W' : ts < opp ? 'L' : 'D';
        return { ...m, outcome, wasHome };
      }),
    });
    const forms = [buildForm(homeTeam, home.recentGames ?? []), buildForm(awayTeam, away.recentGames ?? [])].filter((f) => f.games.length > 0);

    if (meetings.length === 0 && forms.length === 0) return null;
    return { homeTeam, awayTeam, record: meetings.length > 0 ? { homeWins, draws, awayWins } : null, meetings, forms };
  } catch {
    return null;
  }
}

// ===== خريطة التسديد (نمط 365 shot-chart) — `chartEvents` داخل `web/game/?gameId=` (مفحوص حيًّا) =====
// كلّ تسديدة: side(عمق نحو المرمى)/line(عرض جانبيّ) 0..100 ⇒ موضعها على الملعب (مُشتقّ بمطابقة الأهداف ببكسلات 365)،
// competitorNum(1=مضيف،2=ضيف)، outcome{y,z,name} لموضع الكرة في المرمى، subType→الوضعية (من eventSubTypes بالـvalue)،
// bodyPart/xg/xgot، واللاعب من members. صفر مراهنات (لا توجد أصلاً في chartEvents). null عند غياب التسديدات (مباراة لم تبدأ).
export interface ShotMapShot {
  key: string;
  isHome: boolean;
  side: number; // عمق نحو المرمى 0..100
  line: number; // عرض جانبيّ 0..100 (50=وسط)
  isGoal: boolean;
  outcomeName: string | null; // هدف / تم التصدي / خارج المرمى / تم اعتراض التسديدة
  goalY: number | null; // أفقيّ في المرمى 0..100 (>50=يسار، <50=يمين)
  goalZ: number | null; // ارتفاع في المرمى 0..100
  player: { id: number; name: string | null; photo: string | null };
  time: string | null;
  situation: string | null; // الوضعية (من الركنية/ضربة حرة/لعب مفتوح…)
  bodyPart: string | null; // طريقة التسديد (القدم اليمنى/رأسية…)
  xg: string | null;
  xgot: string | null;
  goalDescription: string | null; // منخفض في المنتصف…
}
export interface ShotMap {
  home: { id: number; name: string | null; color: string; logo: string | null };
  away: { id: number; name: string | null; color: string; logo: string | null };
  courtImage: string;
  shots: ShotMapShot[];
}

const SMCompetitor = z.object({ id: z.number(), name: z.string().nullish(), color: z.string().nullish(), imageVersion: z.number().nullish() }).passthrough();
const SMOutcome = z.object({ y: z.number().nullish(), z: z.number().nullish(), name: z.string().nullish() }).passthrough();
const SMEvent = z
  .object({
    key: z.union([z.string(), z.number()]).nullish(),
    competitorNum: z.number().nullish(),
    side: z.number().nullish(),
    line: z.number().nullish(),
    time: z.string().nullish(),
    playerId: z.number().nullish(),
    bodyPart: z.string().nullish(),
    goalDescription: z.string().nullish(),
    xg: z.string().nullish(),
    xgot: z.string().nullish(),
    type: z.number().nullish(),
    subType: z.number().nullish(),
    outcome: SMOutcome.nullish(),
  })
  .passthrough();
const SMLookup = z.object({ value: z.number(), name: z.string().nullish() }).passthrough();
const SMResponse = z
  .object({
    game: z
      .object({
        homeCompetitor: SMCompetitor.nullish(),
        awayCompetitor: SMCompetitor.nullish(),
        members: z.array(Member).nullish(),
        chartEvents: z
          .object({
            events: z.array(SMEvent).nullish(),
            eventTypes: z.array(SMLookup).nullish(),
            eventSubTypes: z.array(SMLookup).nullish(),
          })
          .passthrough()
          .nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

function smColor(c: string | null | undefined): string {
  if (!c) return '#64748b';
  const h = c.startsWith('#') ? c : `#${c}`;
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h : '#64748b';
}

export async function getShotMap(gameId: number): Promise<ShotMap | null> {
  if (!Number.isInteger(gameId) || gameId <= 0) return null;
  try {
    // ملاحظة: `appTypeId=3` (لا 5) عمداً — رابط مميّز عن `getGameDetail` كي لا يتصادم استهلاك جسم الاستجابة
    // في memoization الـfetch بهذا الفورك (نفس الرابط حرفيّاً ⇒ قد يُعيد جسماً مُستهلَكاً فيفشل `.json()`).
    const res = await fetch(`${BASE}/game/?${COMMON}&gameId=${gameId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 30, tags: [`sport-game-${gameId}`] },
    });
    if (!res.ok) return null;
    const parsed = SMResponse.safeParse(await res.json());
    if (!parsed.success || !parsed.data.game) return null;
    const g = parsed.data.game;
    const homeC = g.homeCompetitor;
    const awayC = g.awayCompetitor;
    const ce = g.chartEvents;
    if (!homeC || !awayC || !ce?.events || ce.events.length === 0) return null;

    const subMap = new Map<number, string>();
    for (const s of ce.eventSubTypes ?? []) if (s.name) subMap.set(s.value, s.name);
    const typeMap = new Map<number, string>();
    for (const t of ce.eventTypes ?? []) if (t.name) typeMap.set(t.value, t.name);
    const members = new Map<number, { name: string | null; photo: string | null }>();
    for (const m of g.members ?? []) {
      // نفس تطبيع Member في getGameDetail: تجاوَز فقط عند غياب id وathleteId معًا.
      const playerId = m.athleteId ?? m.id;
      if (playerId == null || m.id == null) continue;
      members.set(m.id, { name: m.shortName || m.name || null, photo: athletePhoto(playerId, m.imageVersion ?? null) });
    }

    const shots: ShotMapShot[] = ce.events
      .filter((e) => typeof e.side === 'number' && typeof e.line === 'number')
      .map((e, i) => {
        const mem = e.playerId != null ? members.get(e.playerId) : undefined;
        return {
          key: String(e.key ?? i),
          isHome: e.competitorNum === 1,
          side: e.side as number,
          line: e.line as number,
          isGoal: (e.outcome?.name ?? '').includes('هدف'),
          outcomeName: e.outcome?.name ?? null,
          goalY: typeof e.outcome?.y === 'number' ? e.outcome.y : null,
          goalZ: typeof e.outcome?.z === 'number' ? e.outcome.z : null,
          player: { id: e.playerId ?? 0, name: mem?.name ?? null, photo: mem?.photo ?? null },
          time: e.time ?? null,
          situation: (e.subType != null ? subMap.get(e.subType) : undefined) ?? (e.type != null ? typeMap.get(e.type) : undefined) ?? null,
          bodyPart: e.bodyPart ?? null,
          xg: e.xg ?? null,
          xgot: e.xgot ?? null,
          goalDescription: e.goalDescription ?? null,
        };
      });
    if (shots.length === 0) return null;

    const mk = (c: z.infer<typeof SMCompetitor>) => ({ id: c.id, name: c.name ?? null, color: smColor(c.color), logo: img('Competitors', c.id, c.imageVersion, 32) });
    return {
      home: mk(homeC),
      away: mk(awayC),
      courtImage: 'https://imagecache.365scores.com/image/upload/f_png,w_704,h_444,q_auto:eco,dpr_1/v1/Website/AssetsSVGNewBrand/court/1',
      shots,
    };
  } catch {
    return null;
  }
}

// ===== ملاحظات البطولة (نمط 365 insights) — نقطة `web/trends/?competition={id}` (مفرد competition؛ مفحوصة حيًّا 200) =====
// تُعيد كلّ تريندات مباريات البطولة القادمة دفعةً واحدة + games/competitors للتجميع. كلّ تريند: `text` (إحصاء واقعيّ يُبقى)
// + `isTop` (تريند بارز ⇒ لهب) + `competitorIds`. **يُجرَّد betCTA/odds/bookmaker تماماً** (لا تُقرأ أصلاً — العقد).
export interface InsightTrend {
  id: number;
  text: string;
  isTop: boolean;
  competitorId: number | null; // الفريق صاحب التريند (لتمييزه)
}
export interface InsightGame {
  gameId: number;
  dateShort: string; // للسلايدر: وقت اليوم/غدًا/DD/MM
  dateLong: string; // للقائمة: اليوم DD شهر - وقت
  home: { id: number | null; name: string | null; logo: string | null };
  away: { id: number | null; name: string | null; logo: string | null };
  trends: InsightTrend[];
}
export interface CompetitionInsights {
  top: InsightGame[]; // مباريات لها تريندات بارزة (isTop) — للسلايدر «أبرز التريندات»
  all: InsightGame[]; // كلّ المباريات بكلّ ترينداتها — لقائمة «شائع»
}

const InsCompetitor = z.object({ id: z.number(), name: z.string().nullish(), imageVersion: z.number().nullish() }).passthrough();
const InsTrend = z
  .object({
    id: z.number(),
    text: z.string().nullish(),
    isTop: z.boolean().nullish(),
    competitorIds: z.array(z.number()).nullish(),
    gameId: z.number().nullish(),
  })
  .passthrough();
const InsGame = z
  .object({ id: z.number(), startTime: z.string().nullish(), homeCompetitor: InsCompetitor.nullish(), awayCompetitor: InsCompetitor.nullish() })
  .passthrough();
const InsResponse = z
  .object({ trends: z.array(InsTrend).nullish(), games: z.array(InsGame).nullish(), competitors: z.array(InsCompetitor).nullish() })
  .passthrough();

function ammanYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function insightDates(iso: string | null | undefined): { short: string; long: string } {
  if (!iso) return { short: '', long: '' };
  try {
    const d = new Date(iso);
    const ymd = ammanYmd(d);
    const time = new Intl.DateTimeFormat('ar', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit' }).format(d);
    const today = ammanYmd(new Date());
    const tomorrow = ammanYmd(new Date(Date.now() + 86_400_000));
    const short = ymd === today ? time : ymd === tomorrow ? 'غدًا' : new Intl.DateTimeFormat('ar', { timeZone: 'Asia/Amman', day: '2-digit', month: '2-digit' }).format(d);
    const long = `${new Intl.DateTimeFormat('ar', { timeZone: 'Asia/Amman', weekday: 'long', day: '2-digit', month: 'long' }).format(d)} - ${time}`;
    return { short, long };
  } catch {
    return { short: '', long: '' };
  }
}

export async function getCompetitionInsights(competitionId: number): Promise<CompetitionInsights | null> {
  if (!Number.isInteger(competitionId) || competitionId <= 0) return null;
  try {
    const res = await fetch(`${BASE}/trends/?${COMMON}&competition=${competitionId}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 600, tags: [`sport-competition-${competitionId}`] },
    });
    if (!res.ok) return null;
    const parsed = InsResponse.safeParse(await res.json());
    if (!parsed.success || !parsed.data.trends || parsed.data.trends.length === 0) return null;

    const logoOf = new Map<number, string | null>();
    for (const c of parsed.data.competitors ?? []) logoOf.set(c.id, img('Competitors', c.id, c.imageVersion, 32));
    const teamOf = (c: z.infer<typeof InsCompetitor> | null | undefined) =>
      c ? { id: c.id, name: c.name ?? null, logo: logoOf.get(c.id) ?? img('Competitors', c.id, c.imageVersion, 32) } : { id: null, name: null, logo: null };

    const byGame = new Map<number, InsightTrend[]>();
    for (const t of parsed.data.trends) {
      if (t.gameId == null || !t.text) continue;
      const arr = byGame.get(t.gameId) ?? [];
      arr.push({ id: t.id, text: t.text, isTop: t.isTop === true, competitorId: t.competitorIds?.[0] ?? null });
      byGame.set(t.gameId, arr);
    }

    const all: InsightGame[] = [];
    for (const g of parsed.data.games ?? []) {
      const trends = byGame.get(g.id);
      if (!trends || trends.length === 0) continue;
      const { short, long } = insightDates(g.startTime);
      all.push({ gameId: g.id, dateShort: short, dateLong: long, home: teamOf(g.homeCompetitor), away: teamOf(g.awayCompetitor), trends });
    }
    if (all.length === 0) return null;
    const top = all.map((g) => ({ ...g, trends: g.trends.filter((t) => t.isTop) })).filter((g) => g.trends.length > 0);

    return { top, all };
  } catch {
    return null;
  }
}
