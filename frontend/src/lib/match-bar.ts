import 'server-only';
import { z } from 'zod';

import { env } from './env';
import type { SportMatch } from './sport/games';

// شريط المباريات — يُقرأ حصريًّا من Laravel (GET /api/v1/match-bar)، لا من 365Scores مباشرة.
// Laravel هو مصدر الحقيقة (Competition::is_tracked يُزامَن دوريًّا)؛ هذا الجالب مجرّد استهلاك،
// بلا أي منطق تصفية/دمج هنا — القرار (معطَّل/بطولات مميَّزة/دوريّات) بالكامل في BuildMatchBarAction.
const SideSchema = z.object({
  name: z.string(),
  logo: z.string().nullish(),
  score: z.number().nullish(),
});

const MatchSchema = z
  .object({
    id: z.number(),
    kind: z.enum(['live', 'finished', 'upcoming']),
    status_text: z.string().nullish(),
    kickoff_at: z.string().nullish(),
    home: SideSchema,
    away: SideSchema,
  })
  .passthrough();

const EnvelopeSchema = z.object({
  data: z.object({ enabled: z.boolean(), matches: z.array(MatchSchema) }).nullish(),
});

function toSide(s: z.infer<typeof SideSchema>): SportMatch['home'] {
  return { name: s.name, score: s.score ?? null, color: null, logo: s.logo ?? null };
}

// enabled:false أو أيّ فشل ⇒ [] (لا شريط) — نفس عزل الفشل المتّبع في بقية جالبات lib/.
export const getMatchBar = async (): Promise<SportMatch[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/match-bar`, {
      headers: env.internalHeaders,
      next: { revalidate: 60, tags: ['match-bar'] },
    });
    if (!res.ok) return [];
    const parsed = EnvelopeSchema.safeParse(await res.json());
    if (!parsed.success || !parsed.data.data?.enabled) return [];

    return parsed.data.data.matches.map((m) => ({
      id: m.id,
      kind: m.kind,
      statusText: m.status_text ?? null,
      minute: null,
      startTime: m.kickoff_at ?? null,
      home: toSide(m.home),
      away: toSide(m.away),
    }));
  } catch {
    return [];
  }
};
