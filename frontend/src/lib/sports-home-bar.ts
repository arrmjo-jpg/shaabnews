import 'server-only';
import { z } from 'zod';

import { env } from './env';
import { shiftYmd } from './sport/day';
import type { CompetitionGroup, SportMatch } from './sport/games';
import type { MatchDay } from '@/components/home/today-matches';

// شريط الصفحة الرئيسية للرياضة — يُقرأ حصريًّا من Laravel (GET /api/v1/sports-home-bar)، لا من
// 365Scores مباشرة. ميزة مستقلّة تمامًا عن شريط المباريات العام (lib/match-bar.ts) — بطولات
// مختارة خاصّة بها (Competition::show_in_sports_home_bar)، رغم تطابق شكل الاستجابة والمعالجة
// حرفيًّا (BuildCompetitionBarAction المشترك بالباك إند). القرار (معطَّل/بطولات مختارة) بالكامل
// هناك — هذا الجالب مجرّد استهلاك، بلا أي منطق تصفية/دمج هنا.
const SideSchema = z.object({
  name: z.string(),
  logo: z.string().nullish(),
  score: z.number().nullish(),
});

const CompetitionRefSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string().nullish(),
});

const MatchSchema = z
  .object({
    id: z.number(),
    kind: z.enum(['live', 'finished', 'upcoming']),
    status_text: z.string().nullish(),
    kickoff_at: z.string().nullish(),
    home: SideSchema,
    away: SideSchema,
    competition: CompetitionRefSchema.nullish(),
  })
  .passthrough();
type Match = z.infer<typeof MatchSchema>;

const EnvelopeSchema = z.object({
  data: z.object({ enabled: z.boolean(), matches: z.array(MatchSchema) }).nullish(),
});

function toSide(s: z.infer<typeof SideSchema>): SportMatch['home'] {
  return { name: s.name, score: s.score ?? null, color: null, logo: s.logo ?? null };
}

function toSportMatch(m: Match): SportMatch {
  return {
    id: m.id,
    kind: m.kind,
    statusText: m.status_text ?? null,
    minute: null,
    startTime: m.kickoff_at ?? null,
    home: toSide(m.home),
    away: toSide(m.away),
  };
}

// يوم المباراة بتوقيت عمّان (نفس منطق todayAmman/shiftYmd) — kickoff_at مُخزَّن UTC.
function ymdAmman(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );
}

// enabled:false أو أيّ فشل ⇒ [] — نفس عزل الفشل المتّبع في بقية جالبات lib/.
async function fetchMatches(): Promise<Match[]> {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/sports-home-bar`, {
      headers: env.internalHeaders,
      next: { revalidate: 60, tags: ['sports-home-bar'] },
    });
    if (!res.ok) return [];
    const parsed = EnvelopeSchema.safeParse(await res.json());
    if (!parsed.success || !parsed.data.data?.enabled) return [];

    return parsed.data.data.matches;
  } catch {
    return [];
  }
}

/** قائمة مسطّحة (لشريط أفقي مثل LeagueMatchesTicker إن احتيج لاحقًا). */
export const getSportsHomeBar = async (): Promise<SportMatch[]> => {
  const matches = await fetchMatches();
  return matches.map(toSportMatch);
};

const DAY_OFFSETS = [-1, 0, 1, 2] as const;
const DAY_LABELS: Record<(typeof DAY_OFFSETS)[number], string> = {
  [-1]: 'أمس',
  0: 'اليوم',
  1: 'غداً',
  2: 'بعد غد',
};

/**
 * بديل getArabMatchesByCompetition لودجت الهوم «الدوريات العربية» — نفس شكل MatchDay[] بالضبط
 * (أمس/اليوم/غداً/بعد غد، مُجمَّعة بالبطولة)، لكن المصدر بطولات الإدارة المختارة
 * (show_in_sports_home_bar) بدل فلتر ثابت على اسم دولة البطولة. جلب واحد فقط (لا 4 نداءات) ثمّ
 * تقسيم/تجميع محليّ — الأرشيف الكامل من BuildCompetitionBarAction بلا نافذة زمنيّة أصلًا.
 */
export async function getSportsHomeBarDays(today: string): Promise<MatchDay[]> {
  const all = await fetchMatches();

  const dayKeys = DAY_OFFSETS.map((offset) => shiftYmd(today, offset));
  const groupsByDay = new Map<string, Map<number, CompetitionGroup>>(dayKeys.map((k) => [k, new Map()]));
  const orderByDay = new Map<string, number[]>(dayKeys.map((k) => [k, []]));

  for (const m of all) {
    if (!m.kickoff_at) continue;
    const dayKey = ymdAmman(m.kickoff_at);
    const groups = groupsByDay.get(dayKey);
    const order = orderByDay.get(dayKey);
    if (!groups || !order) continue; // خارج نافذة الأيّام الأربعة المعروضة

    const cid = m.competition?.id ?? -1;
    if (!groups.has(cid)) {
      groups.set(cid, {
        id: cid,
        name: m.competition?.name ?? '',
        logo: m.competition?.logo ?? null,
        country: null,
        matches: [],
      });
      order.push(cid);
    }
    groups.get(cid)!.matches.push(toSportMatch(m));
  }

  return DAY_OFFSETS.map((offset, i) => {
    const key = dayKeys[i];
    const order = orderByDay.get(key) ?? [];
    const groups = groupsByDay.get(key)!;
    return { key, label: DAY_LABELS[offset], groups: order.map((id) => groups.get(id)!) };
  });
}
