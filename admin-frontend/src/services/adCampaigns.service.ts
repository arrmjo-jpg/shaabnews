import { http } from './http/client';
import type { ApiSuccess } from '@/types/api';
import type { PaginationMeta } from '@/types/users.types';
import type {
  AdCampaignData,
  AdCampaignsListParams,
  AdCampaignsListResult,
  AdCampaignUpsertPayload,
} from '@/types/advertising.types';

function buildParams(p: AdCampaignsListParams): Record<string, string | number> {
  const params: Record<string, string | number> = { page: p.page, per_page: p.per_page };
  if (p.search) params['filter[name]'] = p.search;
  if (p.status) params['filter[status]'] = p.status;
  if (p.pacing_mode) params['filter[pacing_mode]'] = p.pacing_mode;
  if (p.sort) params.sort = p.sort;
  if (p.trashed) params.trashed = p.trashed;
  return params;
}

/**
 * الحملات الإعلانية — مرقَّمة. الإنشاء يُفرض مسودّةً في الـ backend؛ انتقالات الحالة عبر
 * مسار status مستقلّ (آلة الحالة + حارس النافذة). حذف ناعم + استرجاع + حذف نهائيّ.
 */
export const adCampaignsService = {
  async list(p: AdCampaignsListParams, signal?: AbortSignal): Promise<AdCampaignsListResult> {
    const { data } = await http.get<ApiSuccess<AdCampaignData[]>>('/admin/campaigns', {
      params: buildParams(p),
      signal,
    });
    const pagination = (data.meta as { pagination: PaginationMeta }).pagination;
    return { data: data.data, pagination };
  },

  async get(id: number): Promise<AdCampaignData> {
    const { data } = await http.get<ApiSuccess<AdCampaignData>>(`/admin/campaigns/${id}`);
    return data.data;
  },

  async create(payload: AdCampaignUpsertPayload): Promise<AdCampaignData> {
    const { data } = await http.post<ApiSuccess<AdCampaignData>>('/admin/campaigns', payload);
    return data.data;
  },

  async update(id: number, payload: AdCampaignUpsertPayload): Promise<AdCampaignData> {
    const { data } = await http.put<ApiSuccess<AdCampaignData>>(`/admin/campaigns/${id}`, payload);
    return data.data;
  },

  /** انتقال حالة (آلة الحالة في الـ backend) — يعيد رسالة النجاح. */
  async transition(id: number, status: string): Promise<string> {
    const { data } = await http.patch<ApiSuccess<unknown>>(`/admin/campaigns/${id}/status`, { status });
    return data.message;
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/campaigns/${id}`);
    return data.message;
  },

  async restore(id: number): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(`/admin/campaigns/${id}/restore`);
    return data.message;
  },

  async forceDelete(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/campaigns/${id}/force`);
    return data.message;
  },
};
