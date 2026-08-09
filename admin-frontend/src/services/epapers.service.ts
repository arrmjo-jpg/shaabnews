import { http } from './http/client';
import type { ApiSuccess } from '@/types/api';
import type { PaginationMeta } from '@/types/users.types';
import type {
  EpaperAnalyticsData,
  EpaperCreateFields,
  EpaperDashboardData,
  EpaperData,
  EpaperOperationsData,
  EpapersListParams,
  EpapersListResult,
  EpaperUpdatePayload,
  NewspaperSettingsData,
} from '@/types/epaper.types';

function buildParams(p: EpapersListParams): Record<string, string | number> {
  const params: Record<string, string | number> = { page: p.page, per_page: p.per_page };
  if (p.search) params['filter[title]'] = p.search;
  if (p.status) params['filter[status]'] = p.status;
  if (p.locale) params['filter[locale]'] = p.locale;
  if (p.sort) params.sort = p.sort;
  if (p.trashed) params.trashed = p.trashed;
  return params;
}

/** يبني FormData للإنشاء (multipart) — لا تضبط Content-Type يدوياً (المتصفّح يولّد boundary). */
function createForm(fields: EpaperCreateFields, file: File): FormData {
  const form = new FormData();
  form.append('issue_number', String(fields.issue_number));
  form.append('title', fields.title);
  form.append('publication_date', fields.publication_date);
  form.append('locale', fields.locale);
  if (fields.subtitle) form.append('subtitle', fields.subtitle);
  if (fields.summary) form.append('summary', fields.summary);
  if (fields.slug) form.append('slug', fields.slug);
  if (fields.note) form.append('note', fields.note);
  form.append('file', file);
  return form;
}

/**
 * الجريدة الرقمية — يعيد استخدام عقد الـ API نفسه (ApiResponse + pagination meta)
 * وأنماط بقية الخدمات. الإنشاء/الاستبدال multipart (الـ PDF يُرفع مباشرةً، لا media_asset_id).
 */
export const epapersService = {
  async list(p: EpapersListParams): Promise<EpapersListResult> {
    const { data } = await http.get<ApiSuccess<EpaperData[]>>('/admin/epapers', { params: buildParams(p) });
    const pagination = (data.meta as { pagination: PaginationMeta }).pagination;
    return { data: data.data, pagination };
  },

  async get(id: number): Promise<EpaperData> {
    const { data } = await http.get<ApiSuccess<EpaperData>>(`/admin/epapers/${id}`);
    return data.data;
  },

  async create(fields: EpaperCreateFields, file: File): Promise<EpaperData> {
    const { data } = await http.post<ApiSuccess<EpaperData>>('/admin/epapers', createForm(fields, file));
    return data.data;
  },

  async update(id: number, payload: EpaperUpdatePayload): Promise<EpaperData> {
    const { data } = await http.put<ApiSuccess<EpaperData>>(`/admin/epapers/${id}`, payload);
    return data.data;
  },

  async replacePdf(id: number, file: File, note?: string): Promise<EpaperData> {
    const form = new FormData();
    form.append('file', file);
    if (note) form.append('note', note);
    const { data } = await http.post<ApiSuccess<EpaperData>>(`/admin/epapers/${id}/replace-pdf`, form);
    return data.data;
  },

  /** رفع/تعيين غلاف العدد يدوياً (صورة) — يُخزَّن في conversions['cover']. */
  async setCover(id: number, cover: File): Promise<EpaperData> {
    const form = new FormData();
    form.append('cover', cover);
    const { data } = await http.post<ApiSuccess<EpaperData>>(`/admin/epapers/${id}/cover`, form);
    return data.data;
  },

  /** انتقال حالة — published_at توقيت محلّي للتطبيق (Asia/Amman) لا UTC (قرار المرحلة 1ب). */
  async transition(id: number, status: string, publishedAt?: string | null): Promise<string> {
    const { data } = await http.patch<ApiSuccess<EpaperData>>(`/admin/epapers/${id}/status`, {
      status,
      published_at: publishedAt ?? undefined,
    });
    return data.message;
  },

  async duplicate(id: number): Promise<EpaperData> {
    const { data } = await http.post<ApiSuccess<EpaperData>>(`/admin/epapers/${id}/duplicate`);
    return data.data;
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/epapers/${id}`);
    return data.message;
  },

  async restore(id: number): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(`/admin/epapers/${id}/restore`);
    return data.message;
  },

  async forceDelete(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/epapers/${id}/force`);
    return data.message;
  },

  /** تحليلات القارئ (Phase 5) — تقرير أساسيّ لكل عدد. */
  async analytics(id: number): Promise<EpaperAnalyticsData> {
    const { data } = await http.get<ApiSuccess<EpaperAnalyticsData>>(`/admin/epapers/${id}/analytics`);
    return data.data;
  },

  /** لوحة تحليلات القارئ العابرة (Final completion) — نظرة عامّة + ترتيب + سلوك + مدى زمنيّ. */
  async dashboard(params: { period: string; from?: string; to?: string }): Promise<EpaperDashboardData> {
    const q: Record<string, string> = { period: params.period };
    if (params.from) q.from = params.from;
    if (params.to) q.to = params.to;
    const { data } = await http.get<ApiSuccess<EpaperDashboardData>>('/admin/epapers/analytics', { params: q });
    return data.data;
  },

  /** الرؤية التشغيليّة للجريدة (Final completion — البند C). */
  async operations(): Promise<EpaperOperationsData> {
    const { data } = await http.get<ApiSuccess<EpaperOperationsData>>('/admin/epapers/operations');
    return data.data;
  },

  // ─── Module settings (enable toggle + display name) ──────────────────────
  async getSettings(): Promise<NewspaperSettingsData> {
    const { data } = await http.get<ApiSuccess<NewspaperSettingsData>>('/admin/epapers/settings');
    return data.data;
  },

  async updateSettings(payload: NewspaperSettingsData): Promise<string> {
    const { data } = await http.put<ApiSuccess<NewspaperSettingsData>>('/admin/epapers/settings', payload);
    return data.message;
  },
};
