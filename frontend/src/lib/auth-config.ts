import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// Public social-login config: GET /api/v1/auth/social/config → { providers: [{id, redirect_url}] }.
// Only ENABLED providers are returned (no secrets). `redirect_url` starts the backend OAuth flow.
const ProviderSchema = z.object({ id: z.string(), redirect_url: z.string() });

export type SocialProvider = z.infer<typeof ProviderSchema>;

const EnvelopeSchema = z
  .object({ data: z.object({ providers: z.array(ProviderSchema).nullish() }).nullish() })
  .passthrough();

// Cached + deduped per request; tag-revalidatable. Any failure → [] (login page renders single-column).
export const getSocialAuthConfig = cache(async (): Promise<SocialProvider[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/auth/social/config`, {
      next: { revalidate: 36000, tags: ['social-config'] }, // ISR — سقف أمان فقط؛ إبطال حدثيّ عبر UpdateThirdPartySettingsAction.
    });
    if (!res.ok) return [];
    const parsed = EnvelopeSchema.safeParse(await res.json());
    return parsed.success ? (parsed.data.data?.providers ?? []) : [];
  } catch {
    return [];
  }
});
