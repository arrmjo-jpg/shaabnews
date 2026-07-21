import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// عقد GET /api/v1/sport-menu (Commit 4 — الباك إند): شجرة الجذور المفعّلة بلغة الطلب + أبناؤها
// المفعّلون بنفس اللغة فقط. لا `.passthrough()` هنا (نفس قرار Commit 3 لـ SportPublicSettingsSchema):
// عقد صغير محدَّد، لا استجابة عامّة — حقل غير مُعرَّف يُسقَط بصمت بدل أن يُمرَّر دون تنبّه أحد.
export interface SportMenuItemNode {
  id: number;
  title: string;
  type: 'category' | 'section';
  category_id: number | null;
  section_key: string | null;
  icon: string | null;
  children: SportMenuItemNode[];
}

const SportMenuItemSchema: z.ZodType<SportMenuItemNode> = z.lazy(() =>
  z.object({
    id: z.number(),
    title: z.string(),
    type: z.enum(['category', 'section']),
    category_id: z.number().nullable(),
    section_key: z.string().nullable(),
    icon: z.string().nullable(),
    children: z.array(SportMenuItemSchema).default([]),
  }),
);

const EnvelopeSchema = z.object({ data: z.array(SportMenuItemSchema).nullish() });

// نفس نمط getSiteSettings تمامًا: cache() لكلّ طلب + Data Cache قابلة للإبطال بوسم مخصّص.
export const getSportMenu = cache(async (locale = 'ar'): Promise<SportMenuItemNode[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/sport-menu?locale=${encodeURIComponent(locale)}`, {
      next: { revalidate: 300, tags: ['sport-menu'] },
    });
    if (!res.ok) return [];
    const parsed = EnvelopeSchema.safeParse(await res.json());
    return parsed.success ? (parsed.data.data ?? []) : [];
  } catch {
    return [];
  }
});
