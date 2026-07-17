import 'server-only';
import { cache } from 'react';
import { z } from 'zod';

import { apiFetch } from './auth';
import { env } from './env';

// Public categories tree (GET /api/v1/{locale}/categories). Flattened to a dropdown list.
interface CategoryNode {
  id: number;
  name: string;
  children?: CategoryNode[] | null;
}

export interface CategoryOption {
  id: number;
  name: string;
  depth: number;
}

const NodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z
    .object({
      id: z.number(),
      name: z.string(),
      // مرونة دفاعيّة: children مشوّه (مثل كائن غير محلول) يتدهور إلى undefined
      // بدل إسقاط الحمولة كاملةً فتختفي كلّ التصنيفات.
      children: z.array(NodeSchema).nullish().catch(undefined),
    })
    .passthrough(),
);

const EnvelopeSchema = z.object({ data: z.array(NodeSchema).nullish() }).passthrough();

function flatten(nodes: CategoryNode[], depth = 0, out: CategoryOption[] = []): CategoryOption[] {
  for (const node of nodes) {
    out.push({ id: node.id, name: node.name, depth });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}

export const getCategories = cache(async (locale = 'ar'): Promise<CategoryOption[]> => {
  if (!env.apiBaseUrl) return [];
  try {
    const res = await fetch(`${env.apiBaseUrl}/api/v1/${encodeURIComponent(locale)}/categories`, {
      next: { revalidate: 36000, tags: ['categories'] }, // ISR — سقف أمان فقط؛ التحديث الفعليّ حدثيّ.
    });
    if (!res.ok) return [];
    const parsed = EnvelopeSchema.safeParse(await res.json());
    return parsed.success ? flatten(parsed.data.data ?? []) : [];
  } catch {
    return [];
  }
});

// تصنيفات نموذج الكاتب مفلترةً حسب النوع (GET /api/v1/article-categories?type=).
// مصادَقة الكاتب عبر apiFetch (الكوكي)؛ قائمة مسطّحة قابلة للاختيار، نفس قاعدة نطاق الخادم.
const WriterCategorySchema = z.object({ id: z.number(), name: z.string() }).passthrough();

export async function getArticleCategories(
  type: 'news' | 'opinion',
  locale = 'ar',
): Promise<CategoryOption[]> {
  const res = await apiFetch(`/api/v1/article-categories?type=${type}&locale=${encodeURIComponent(locale)}`);
  if (!res?.ok) return [];
  const json = await res.json().catch(() => null);
  const arr = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((x) => {
    const p = WriterCategorySchema.safeParse(x);
    return p.success ? [{ id: p.data.id, name: p.data.name, depth: 0 }] : [];
  });
}
