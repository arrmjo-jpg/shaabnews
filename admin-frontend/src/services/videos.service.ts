import { http } from './http/client';
import type { AnalyticsRangeKey, VideoEntityAnalytics } from '@/types/analytics.types';
import type { ApiSuccess } from '@/types/api';
import type { PaginationMeta } from '@/types/users.types';
import type {
  VideoAnalyticsData,
  VideoBulkPayload,
  VideoBulkResult,
  VideoData,
  VideoDashboardData,
  VideoOperationsData,
  VideosListParams,
  VideosListResult,
  VideoStats,
  VideoUpsertPayload,
} from '@/types/videoLibrary.types';

function buildParams(p: VideosListParams): Record<string, string | number> {
  const params: Record<string, string | number> = { page: p.page, per_page: p.per_page };
  if (p.search) params['filter[title]'] = p.search;
  if (p.status) params['filter[status]'] = p.status;
  if (p.visibility) params['filter[visibility]'] = p.visibility;
  if (p.source_type) params['filter[source_type]'] = p.source_type;
  if (p.locale) params['filter[locale]'] = p.locale;
  if (p.video_category_id) params['filter[video_category_id]'] = p.video_category_id;
  if (p.sort) params.sort = p.sort;
  if (p.trashed) params.trashed = p.trashed;
  return params;
}

/**
 * مكتبة الفيديو — نوع محتوى من الدرجة الأولى. يعيد استخدام عقد الـ API نفسه
 * (ApiResponse + pagination meta) وأنماط بقية الخدمات (reels/articles). لا بنية موازية.
 */
export const videosService = {
  async list(p: VideosListParams, signal?: AbortSignal): Promise<VideosListResult> {
    const { data } = await http.get<ApiSuccess<VideoData[]>>('/admin/videos', {
      params: buildParams(p),
      signal,
    });
    const pagination = (data.meta as { pagination: PaginationMeta }).pagination;
    return { data: data.data, pagination };
  },

  async stats(): Promise<VideoStats> {
    const { data } = await http.get<ApiSuccess<VideoStats>>('/admin/videos/stats');
    return data.data;
  },

  async dashboard(): Promise<VideoDashboardData> {
    const { data } = await http.get<ApiSuccess<VideoDashboardData>>('/admin/videos/dashboard');
    return data.data;
  },

  async analytics(): Promise<VideoAnalyticsData> {
    const { data } = await http.get<ApiSuccess<VideoAnalyticsData>>('/admin/videos/analytics');
    return data.data;
  },

  async operations(): Promise<VideoOperationsData> {
    const { data } = await http.get<ApiSuccess<VideoOperationsData>>('/admin/videos/operations');
    return data.data;
  },

  /** تحليلات فيديو واحد (سياقيّة) — نطاق زمني عبر range/from/to. */
  async entityAnalytics(
    id: number,
    range: AnalyticsRangeKey,
    from?: string,
    to?: string,
  ): Promise<VideoEntityAnalytics> {
    const params: Record<string, string> = { range };
    if (range === 'custom' && from) params.from = from;
    if (range === 'custom' && to) params.to = to;
    const { data } = await http.get<ApiSuccess<VideoEntityAnalytics>>(
      `/admin/videos/${id}/analytics`,
      { params },
    );
    return data.data;
  },

  /** إعادة معالجة وسائط فيديو مرفوع (retry) — يعيد رسالة النجاح. */
  async reprocess(id: number): Promise<string> {
    const { data } = await http.post<ApiSuccess<VideoData>>(`/admin/videos/${id}/reprocess`);
    return data.message;
  },

  async get(id: number): Promise<VideoData> {
    const { data } = await http.get<ApiSuccess<VideoData>>(`/admin/videos/${id}`);
    return data.data;
  },

  async create(payload: VideoUpsertPayload): Promise<VideoData> {
    const { data } = await http.post<ApiSuccess<VideoData>>('/admin/videos', payload);
    return data.data;
  },

  async update(id: number, payload: VideoUpsertPayload): Promise<VideoData> {
    const { data } = await http.put<ApiSuccess<VideoData>>(`/admin/videos/${id}`, payload);
    return data.data;
  },

  async transition(id: number, status: string, publishedAt?: string | null): Promise<string> {
    const { data } = await http.patch<ApiSuccess<VideoData>>(`/admin/videos/${id}/status`, {
      status,
      published_at: publishedAt ?? undefined,
    });
    return data.message;
  },

  async bulk(payload: VideoBulkPayload): Promise<{ message: string; result: VideoBulkResult }> {
    const { data } = await http.post<ApiSuccess<VideoBulkResult>>('/admin/videos/bulk', payload);
    return { message: data.message, result: data.data };
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/videos/${id}`);
    return data.message;
  },

  async restore(id: number): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(`/admin/videos/${id}/restore`);
    return data.message;
  },

  async forceDelete(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/videos/${id}/force`);
    return data.message;
  },
};
