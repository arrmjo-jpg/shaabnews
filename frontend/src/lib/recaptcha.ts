import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// Public reCAPTCHA config: GET /api/v1/recaptcha/config → { enabled, version, site_key }.
// Public site key only (no secrets). Used to decide whether the reCAPTCHA notice/badge is shown.
const RecaptchaSchema = z.object({
  enabled: z.boolean().default(false),
  version: z.string().nullish(),
  site_key: z.string().nullish(),
});

export type RecaptchaConfig = z.infer<typeof RecaptchaSchema>;

const EnvelopeSchema = z.object({ data: RecaptchaSchema.nullish() }).passthrough();

// Cached + deduped per request; tag-revalidatable. Any failure → null (notice simply hidden).
export const getRecaptchaConfig = cache(async (): Promise<RecaptchaConfig | null> => {
  if (!env.apiBaseUrl) return null;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/recaptcha/config`, {
      next: { revalidate: 36000, tags: ['recaptcha-config'] }, // ISR — سقف أمان فقط؛ إبطال حدثيّ عبر UpdateThirdPartySettingsAction.
    });
    if (!res.ok) return null;
    const parsed = EnvelopeSchema.safeParse(await res.json());
    return parsed.success ? (parsed.data.data ?? null) : null;
  } catch {
    return null;
  }
});
