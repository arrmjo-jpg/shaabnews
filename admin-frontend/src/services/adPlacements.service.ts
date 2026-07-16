import { http } from './http/client';
import type { ApiSuccess } from '@/types/api';
import type { PaginationMeta } from '@/types/users.types';
import type {
  AdPlacementAttachPayload,
  AdPlacementData,
  AdPlacementsListParams,
  AdPlacementsListResult,
  AdPlacementUpdatePayload,
} from '@/types/advertising.types';

function buildParams(p: AdPlacementsListParams): Record<string, string | number> {
  const params: Record<string, string | number> = { page: p.page, per_page: p.per_page };
  if (p.ad_zone_id) params['filter[ad_zone_id]'] = p.ad_zone_id;
  if (p.ad_creative_id) params['filter[ad_creative_id]'] = p.ad_creative_id;
  if (p.is_active !== '') params['filter[is_active]'] = p.is_active;
  if (p.sort) params.sort = p.sort;
  return params;
}

/**
 * إسنادات الإعلانات (إبداع ↔ مساحة). الإسناد (attach) يفرض التوافق + منع التكرار في الـ
 * backend (يُعيد 422 يُعرَض عبر toast). فصل (detach) حذف صلب — لا حذف ناعم على الروابط.
 */
export const adPlacementsService = {
  async list(p: AdPlacementsListParams, signal?: AbortSignal): Promise<AdPlacementsListResult> {
    const { data } = await http.get<ApiSuccess<AdPlacementData[]>>('/admin/ad-placements', {
      params: buildParams(p),
      signal,
    });
    const pagination = (data.meta as { pagination: PaginationMeta }).pagination;
    return { data: data.data, pagination };
  },

  async attach(payload: AdPlacementAttachPayload): Promise<string> {
    const { data } = await http.post<ApiSuccess<AdPlacementData>>('/admin/ad-placements', payload);
    return data.message;
  },

  async update(id: number, payload: AdPlacementUpdatePayload): Promise<string> {
    const { data } = await http.put<ApiSuccess<AdPlacementData>>(`/admin/ad-placements/${id}`, payload);
    return data.message;
  },

  async detach(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/ad-placements/${id}`);
    return data.message;
  },
};
