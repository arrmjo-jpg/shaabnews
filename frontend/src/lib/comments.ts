import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { env } from './env';

// قراءة تعليقات مقال (المعتمَدة فقط، ردود مستوى واحد) — إعادة استخدام نقطة GET /{locale}/articles/{slug}/comments.
// النقطة مبوَّبة خادميّاً (تُعيد فارغاً عند الإطفاء)؛ والواجهة تُخفي القسم أصلاً عبر commentsEnabled (CommentGuard).
// فشل/غياب ⇒ [] (لا تلفيق). الإنشاء عبر BFF منفصل (يتطلّب تمرير المصادقة).

const enc = encodeURIComponent;

export interface CommentItem {
  id: number;
  body: string;
  authorName: string;
  createdAt: string | null;
  replies: CommentItem[];
}

const ReplySchema = z
  .object({
    id: z.number(),
    body: z.string(),
    author_name: z.string().nullish(),
    created_at: z.string().nullish(),
  })
  .passthrough();

// تعشيش مستوى واحد فقط (عقد الباك إند) — تعليق أعلى + رُدوده.
const CommentSchema = ReplySchema.extend({ replies: z.array(ReplySchema).nullish() }).passthrough();
const CommentsEnvelope = z.object({ data: z.array(CommentSchema).nullish() }).passthrough();

function mapReply(c: z.infer<typeof ReplySchema>): CommentItem {
  return {
    id: c.id,
    body: c.body,
    authorName: (c.author_name ?? '').trim() || 'زائر',
    createdAt: c.created_at ?? null,
    replies: [],
  };
}

function mapComment(c: z.infer<typeof CommentSchema>): CommentItem {
  return { ...mapReply(c), replies: (c.replies ?? []).map(mapReply) };
}

/** تعليقات مقال معتمَدة (أحدث أولاً + ردودها). غير مفعّلة/فشل ⇒ []. */
export const getComments = cache(async (slug: string, locale = 'ar'): Promise<CommentItem[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${enc(locale)}/articles/${enc(slug)}/comments?per_page=50`, {
      headers: env.internalHeaders,
      next: { revalidate: 36000, tags: ['comments', `comments:${slug}`] }, // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ.
    });
    if (!res.ok) return [];
    const parsed = CommentsEnvelope.safeParse(await res.json());
    if (!parsed.success) return [];
    return (parsed.data.data ?? []).map(mapComment);
  } catch {
    return [];
  }
});
