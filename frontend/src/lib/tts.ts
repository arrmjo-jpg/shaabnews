import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// توفّر ميزة «الاستماع للمقال» (Gemini TTS): GET /api/v1/tts/config → { enabled }.
// enabled = (مُفعَّلة في الإدارة ∧ المفتاح مضبوط) — تقرّر الواجهة إظهار الزرّ. لا أسرار.
const TtsSchema = z.object({ enabled: z.boolean().default(false) });

export type TtsConfig = z.infer<typeof TtsSchema>;

const EnvelopeSchema = z.object({ data: TtsSchema.nullish() }).passthrough();

// Cached + deduped per request؛ tag-revalidatable. أي فشل ⇒ null (الزرّ يُخفى ببساطة).
export const getTtsConfig = cache(async (): Promise<TtsConfig | null> => {
  if (!env.apiBaseUrl) return null;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/tts/config`, {
      next: { revalidate: 36000, tags: ['tts-config'] }, // ISR — سقف أمان فقط؛ إبطال حدثيّ عبر UpdateThirdPartySettingsAction.
    });
    if (!res.ok) return null;
    const parsed = EnvelopeSchema.safeParse(await res.json());
    return parsed.success ? (parsed.data.data ?? null) : null;
  } catch {
    return null;
  }
});
