import { http } from './http/client';
import type {
  AnalyticsRangeKey,
  ReelEntityAnalytics,
  ReelFleetAnalytics,
} from '@/types/analytics.types';
import type { ApiSuccess } from '@/types/api';
import type {
  ReelData,
  ReelsListParams,
  ReelsListResult,
  ReelStats,
  ReelUpsertPayload,
} from '@/types/content.types';
import type { PaginationMeta } from '@/types/users.types';

function buildParams(p: ReelsListParams): Record<string, string | number> {
  const params: Record<string, string | number> = { page: p.page, per_page: p.per_page };
  if (p.search) params['filter[title]'] = p.search;
  if (p.status) params['filter[status]'] = p.status;
  if (p.locale) params['filter[locale]'] = p.locale;
  if (p.sort) params.sort = p.sort;
  if (p.trashed) params.trashed = p.trashed;
  return params;
}

/**
 * الريلز — نوع محتوى من الدرجة الأولى. يعيد استخدام نفس عقد الـ API
 * (ApiResponse + pagination meta) وأنماط بقية الخدمات. لا بنية موازية.
 */
export const reelsService = {
  async list(p: ReelsListParams, signal?: AbortSignal): Promise<ReelsListResult> {
    const { data } = await http.get<ApiSuccess<ReelData[]>>('/admin/reels', {
      params: buildParams(p),
      signal,
    });
    const pagination = (data.meta as { pagination: PaginationMeta }).pagination;
    return { data: data.data, pagination };
  },

  async stats(): Promise<ReelStats> {
    const { data } = await http.get<ApiSuccess<ReelStats>>('/admin/reels/stats');
    return data.data;
  },

  /** تحليلات أسطول الريلز (مجاميع + متصدّرون + وقت نشر + لغة + أثر تمييز). */
  async analytics(): Promise<ReelFleetAnalytics> {
    const { data } = await http.get<ApiSuccess<ReelFleetAnalytics>>('/admin/reels/analytics');
    return data.data;
  },

  /** تحليلات ريل واحد (سياقيّة) — نطاق زمني عبر range/from/to. */
  async entityAnalytics(
    id: number,
    range: AnalyticsRangeKey,
    from?: string,
    to?: string,
  ): Promise<ReelEntityAnalytics> {
    const params: Record<string, string> = { range };
    if (range === 'custom' && from) params.from = from;
    if (range === 'custom' && to) params.to = to;
    const { data } = await http.get<ApiSuccess<ReelEntityAnalytics>>(`/admin/reels/${id}/analytics`, {
      params,
    });
    return data.data;
  },

  async get(id: number): Promise<ReelData> {
    const { data } = await http.get<ApiSuccess<ReelData>>(`/admin/reels/${id}`);
    return data.data;
  },

  async create(payload: ReelUpsertPayload): Promise<ReelData> {
    const { data } = await http.post<ApiSuccess<ReelData>>('/admin/reels', payload);
    return data.data;
  },

  async update(id: number, payload: ReelUpsertPayload): Promise<ReelData> {
    const { data } = await http.put<ApiSuccess<ReelData>>(`/admin/reels/${id}`, payload);
    return data.data;
  },

  async transition(id: number, status: string, publishedAt?: string | null): Promise<string> {
    const { data } = await http.patch<ApiSuccess<ReelData>>(`/admin/reels/${id}/status`, {
      status,
      published_at: publishedAt ?? undefined,
    });
    return data.message;
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/reels/${id}`);
    return data.message;
  },

  async restore(id: number): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(`/admin/reels/${id}/restore`);
    return data.message;
  },

  async forceDelete(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/reels/${id}/force`);
    return data.message;
  },
};
