import { http } from './http/client';
import type { ApiSuccess } from '@/types/api';
import type { PaginationMeta } from '@/types/users.types';
import type {
  PlaylistsListParams,
  PlaylistsListResult,
  VideoPlaylistData,
  VideoPlaylistUpsertPayload,
} from '@/types/videoLibrary.types';

function buildParams(p: PlaylistsListParams): Record<string, string | number> {
  const params: Record<string, string | number> = { page: p.page, per_page: p.per_page };
  if (p.search) params['filter[title]'] = p.search;
  if (p.status) params['filter[status]'] = p.status;
  if (p.locale) params['filter[locale]'] = p.locale;
  if (p.sort) params.sort = p.sort;
  if (p.trashed) params.trashed = p.trashed;
  return params;
}

/**
 * قوائم تشغيل الفيديو (VideoPlaylistController) — CRUD + إسناد/فكّ + إعادة ترتيب
 * (drag) عبر pivot.position. نفس عقد الـ API ومعايير الخدمات.
 */
export const videoPlaylistsService = {
  async list(p: PlaylistsListParams, signal?: AbortSignal): Promise<PlaylistsListResult> {
    const { data } = await http.get<ApiSuccess<VideoPlaylistData[]>>('/admin/video-playlists', {
      params: buildParams(p),
      signal,
    });
    const pagination = (data.meta as { pagination: PaginationMeta }).pagination;
    return { data: data.data, pagination };
  },

  async get(id: number): Promise<VideoPlaylistData> {
    const { data } = await http.get<ApiSuccess<VideoPlaylistData>>(`/admin/video-playlists/${id}`);
    return data.data;
  },

  async create(payload: VideoPlaylistUpsertPayload): Promise<VideoPlaylistData> {
    const { data } = await http.post<ApiSuccess<VideoPlaylistData>>('/admin/video-playlists', payload);
    return data.data;
  },

  async update(id: number, payload: VideoPlaylistUpsertPayload): Promise<VideoPlaylistData> {
    const { data } = await http.put<ApiSuccess<VideoPlaylistData>>(`/admin/video-playlists/${id}`, payload);
    return data.data;
  },

  async attach(id: number, videoIds: number[]): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(`/admin/video-playlists/${id}/videos`, {
      video_ids: videoIds,
    });
    return data.message;
  },

  async detach(id: number, videoId: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(
      `/admin/video-playlists/${id}/videos/${videoId}`,
    );
    return data.message;
  },

  async reorder(id: number, orderedIds: number[]): Promise<string> {
    const { data } = await http.patch<ApiSuccess<unknown>>(`/admin/video-playlists/${id}/reorder`, {
      ordered_ids: orderedIds,
    });
    return data.message;
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/video-playlists/${id}`);
    return data.message;
  },

  async restore(id: number): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(`/admin/video-playlists/${id}/restore`);
    return data.message;
  },

  async forceDelete(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/video-playlists/${id}/force`);
    return data.message;
  },
};
