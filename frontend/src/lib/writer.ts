import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// بروفيل الكاتب العامّ — `GET /{locale}/writers/{id}` (الباك إند يبوّبه بـ is_writer نشِط؛ غيره ⇒ 404).
// حقول آمنة للنشر فقط: الاسم/الصورة/النبذة/روابط السوشيل. فشل/404 ⇒ null.
const WriterSchema = z
  .object({
    data: z
      .object({
        id: z.number(),
        name: z.string(),
        avatar: z.string().nullish(),
        bio: z.string().nullish(),
        social_links: z.record(z.string(), z.string()).nullish(),
      })
      .nullish(),
  })
  .passthrough();

export interface WriterProfile {
  id: number;
  name: string;
  avatar: string | null;
  bio: string | null;
  social: Record<string, string>;
}

export const getWriterProfile = cache(async (id: number, locale = 'ar'): Promise<WriterProfile | null> => {
  if (!env.apiBaseUrl || !Number.isFinite(id)) return null;
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/writers/${id}`, {
      next: { revalidate: 36000, tags: ['writers', `writer:${id}`] }, // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ.
    });
    if (!res.ok) return null;
    const parsed = WriterSchema.safeParse(await res.json());
    const d = parsed.success ? parsed.data.data : null;
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      avatar: d.avatar ?? null,
      bio: d.bio?.trim() || null,
      social: d.social_links ?? {},
    };
  } catch {
    return null;
  }
});
