import { http } from './http/client';
import type {
  AnalyticsRangeKey,
  ArticleEntityAnalytics,
  ArticleFleetAnalytics,
} from '@/types/analytics.types';
import type { ApiSuccess } from '@/types/api';
import type {
  ArticleData,
  ArticlePreview,
  ArticleStats,
  ArticleUpsertPayload,
  ArticlesListParams,
  ArticlesListResult,
  SlugCheckResult,
} from '@/types/content.types';
import type { PaginationMeta } from '@/types/users.types';

function buildParams(p: ArticlesListParams): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: p.page,
    per_page: p.per_page,
  };
  if (p.search) params['filter[title]'] = p.search;
  if (p.status) params['filter[status]'] = p.status;
  if (p.type) params['filter[type]'] = p.type;
  if (p.locale) params['filter[locale]'] = p.locale;
  if (p.category !== '') {
    params['filter[category]'] = p.category;
  }
  if (p.author_id) {
    params['filter[author_id]'] = p.author_id;
  }
  // فلتر نوع العرض: مثبّت/عاجل/سلايدر/الهيدر → filter[is_pinned|is_breaking|…]=1
  if (p.placement) params[`filter[${p.placement}]`] = 1;
  if (p.sort) params['sort'] = p.sort;
  if (p.trashed) params['trashed'] = p.trashed;
  return params;
}

export const articlesService = {
  async list(p: ArticlesListParams, signal?: AbortSignal): Promise<ArticlesListResult> {
    const { data } = await http.get<ApiSuccess<ArticleData[]>>('/admin/articles', {
      params: buildParams(p),
      signal,
    });
    const pagination = (data.meta as { pagination: PaginationMeta }).pagination;
    return { data: data.data, pagination };
  },

  async get(id: number): Promise<ArticleData> {
    const { data } = await http.get<ApiSuccess<ArticleData>>(`/admin/articles/${id}`);
    return data.data;
  },

  async create(payload: ArticleUpsertPayload): Promise<ArticleData> {
    const { data } = await http.post<ApiSuccess<ArticleData>>('/admin/articles', payload);
    return data.data;
  },

  async update(id: number, payload: ArticleUpsertPayload): Promise<ArticleData> {
    const { data } = await http.put<ApiSuccess<ArticleData>>(`/admin/articles/${id}`, payload);
    return data.data;
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/articles/${id}`);
    return data.message;
  },

  /** Restore a soft-deleted article. */
  async restore(id: number): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(`/admin/articles/${id}/restore`);
    return data.message;
  },

  /** Permanently delete an article (irreversible). */
  async forceDelete(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/articles/${id}/force`);
    return data.message;
  },

  /** Clear the "breaking" flag from every article in one shot. */
  async clearBreaking(): Promise<string> {
    const { data } = await http.post<ApiSuccess<{ cleared: number }>>(
      '/admin/articles/clear-breaking',
    );
    return data.message;
  },

  /** Clear the "pinned" flag from every article in one shot. */
  async clearPinned(): Promise<string> {
    const { data } = await http.post<ApiSuccess<{ cleared: number }>>(
      '/admin/articles/clear-pinned',
    );
    return data.message;
  },

  /** Quick counts for the list-page stat cards. */
  async stats(): Promise<ArticleStats> {
    const { data } = await http.get<ApiSuccess<ArticleStats>>('/admin/articles/stats');
    return data.data;
  },

  /** تحليلات أسطول المقالات (مجاميع + متصدّرون + وقت نشر + لغة + أثر تمييز). */
  async analytics(): Promise<ArticleFleetAnalytics> {
    const { data } = await http.get<ApiSuccess<ArticleFleetAnalytics>>('/admin/articles/analytics');
    return data.data;
  },

  /** تحليلات مقال واحد (سياقيّة) — نطاق زمني عبر range/from/to. */
  async entityAnalytics(
    id: number,
    range: AnalyticsRangeKey,
    from?: string,
    to?: string,
  ): Promise<ArticleEntityAnalytics> {
    const params: Record<string, string> = { range };
    if (range === 'custom' && from) params.from = from;
    if (range === 'custom' && to) params.to = to;
    const { data } = await http.get<ApiSuccess<ArticleEntityAnalytics>>(
      `/admin/articles/${id}/analytics`,
      { params },
    );
    return data.data;
  },

  async transition(id: number, status: string, scheduledAt?: string | null): Promise<string> {
    const { data } = await http.patch<ApiSuccess<ArticleData>>(
      `/admin/articles/${id}/status`,
      { status, scheduled_at: scheduledAt ?? undefined },
    );
    return data.message;
  },

  /** Upload media into one of the article's collections (cover/gallery/inline/video). */
  async uploadMedia(
    id: number,
    collection: 'cover' | 'gallery' | 'inline' | 'video',
    file: File,
  ): Promise<ArticleData> {
    const form = new FormData();
    form.append('collection', collection);
    form.append('file', file);
    const { data } = await http.post<ApiSuccess<ArticleData>>(
      `/admin/articles/${id}/media`,
      form,
    );
    return data.data;
  },

  /** True preview: exact public payload (+ SEO guidance) for any status. */
  async preview(id: number): Promise<ArticlePreview> {
    const { data } = await http.get<ApiSuccess<ArticlePreview>>(
      `/admin/articles/${id}/preview`,
    );
    return data.data;
  },

  /** Live slug availability + suggestion. */
  async slugCheck(slug: string, locale: string, ignoreId?: number | null): Promise<SlugCheckResult> {
    const { data } = await http.get<ApiSuccess<SlugCheckResult>>('/admin/articles/slug-check', {
      params: { slug, locale, ignore_id: ignoreId ?? undefined },
    });
    return data.data;
  },

  /** Resolve a paste-URL into an allow-listed embed payload. */
  async resolveEmbed(url: string): Promise<{
    provider: string;
    embed_url: string;
    id: string | null;
  }> {
    const { data } = await http.post<
      ApiSuccess<{ provider: string; embed_url: string; id: string | null }>
    >('/admin/articles/embeds/resolve', { url });
    return data.data;
  },
};
