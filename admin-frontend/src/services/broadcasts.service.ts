import { http } from './http/client';
import type { AnalyticsRangeKey, BroadcastEntityAnalytics } from '@/types/analytics.types';
import type { ApiSuccess } from '@/types/api';
import type { PaginationMeta } from '@/types/users.types';
import type {
  BroadcastData,
  BroadcastDashboardData,
  BroadcastLifecycleAction,
  BroadcastLifecycleBody,
  BroadcastModerationAction,
  BroadcastModerationBody,
  BroadcastsListParams,
  BroadcastsListResult,
  BroadcastUpsertPayload,
} from '@/types/broadcast.types';

function buildParams(p: BroadcastsListParams): Record<string, string | number> {
  const params: Record<string, string | number> = { page: p.page, per_page: p.per_page };
  if (p.search) params['filter[title]'] = p.search;
  if (p.status) params['filter[status]'] = p.status;
  if (p.kind) params['filter[kind]'] = p.kind;
  if (p.source_type) params['filter[source_type]'] = p.source_type;
  if (p.category_id !== '') params['filter[category_id]'] = p.category_id;
  if (p.is_featured) params['filter[is_featured]'] = p.is_featured;
  if (p.is_public) params['filter[is_public]'] = p.is_public;
  if (p.sort) params.sort = p.sort;
  if (p.trashed) params.trashed = p.trashed;
  return params;
}

/**
 * مركز عمليات البثّ — نطاق مستقل (بثّ خارجي موثوق فقط). يعيد استخدام عقد الـ API نفسه
 * (ApiResponse + pagination meta) وأنماط بقية الخدمات (videos). لا بنية موازية.
 */
export const broadcastsService = {
  async list(p: BroadcastsListParams, signal?: AbortSignal): Promise<BroadcastsListResult> {
    const { data } = await http.get<ApiSuccess<BroadcastData[]>>('/admin/broadcasts', {
      params: buildParams(p),
      signal,
    });
    const pagination = (data.meta as { pagination: PaginationMeta }).pagination;
    return { data: data.data, pagination };
  },

  async dashboard(): Promise<BroadcastDashboardData> {
    const { data } = await http.get<ApiSuccess<BroadcastDashboardData>>('/admin/broadcasts/dashboard');
    return data.data;
  },

  /** تحليلات بثّ واحد (سياقيّة) — نطاق زمني عبر range/from/to. */
  async entityAnalytics(
    id: number,
    range: AnalyticsRangeKey,
    from?: string,
    to?: string,
  ): Promise<BroadcastEntityAnalytics> {
    const params: Record<string, string> = { range };
    if (range === 'custom' && from) params.from = from;
    if (range === 'custom' && to) params.to = to;
    const { data } = await http.get<ApiSuccess<BroadcastEntityAnalytics>>(
      `/admin/broadcasts/${id}/analytics`,
      { params },
    );
    return data.data;
  },

  async get(id: number): Promise<BroadcastData> {
    const { data } = await http.get<ApiSuccess<BroadcastData>>(`/admin/broadcasts/${id}`);
    return data.data;
  },

  async create(payload: BroadcastUpsertPayload): Promise<BroadcastData> {
    const { data } = await http.post<ApiSuccess<BroadcastData>>('/admin/broadcasts', payload);
    return data.data;
  },

  async update(id: number, payload: BroadcastUpsertPayload): Promise<BroadcastData> {
    const { data } = await http.put<ApiSuccess<BroadcastData>>(`/admin/broadcasts/${id}`, payload);
    return data.data;
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/broadcasts/${id}`);
    return data.message;
  },

  /** انتقال دورة الحياة (schedule/start/offline/resume/end/fail/archive) — يعيد رسالة النجاح. */
  async transition(
    id: number,
    action: BroadcastLifecycleAction,
    body?: BroadcastLifecycleBody,
  ): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(`/admin/broadcasts/${id}/${action}`, body ?? {});
    return data.message;
  },

  /** إجراء إشراف على الجمهور (kick/ban/unban/close/reopen/emergency-shutdown). */
  async moderation(
    id: number,
    action: BroadcastModerationAction,
    body?: BroadcastModerationBody,
  ): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(
      `/admin/broadcasts/${id}/moderation/${action}`,
      body ?? {},
    );
    return data.message;
  },
};
