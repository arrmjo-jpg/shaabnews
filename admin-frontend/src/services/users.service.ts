import { http } from './http/client';
import type { ApiSuccess } from '@/types/api';
import type {
  UserData,
  UsersListParams,
  UsersListResult,
  UserUpsertPayload,
  PaginationMeta,
} from '@/types/users.types';

function buildParams(p: UsersListParams): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: p.page,
    per_page: p.per_page,
  };
  if (p.search) params['filter[search]'] = p.search;
  if (p.status) params['filter[status]'] = p.status;
  if (p.role) params['filter[role]'] = p.role;
  if (p.trashed !== 'none') params['filter[trashed]'] = p.trashed;
  if (p.is_writer === 1) params['filter[is_writer]'] = 1;
  return params;
}

export const usersService = {
  async list(p: UsersListParams, signal?: AbortSignal): Promise<UsersListResult> {
    const { data } = await http.get<ApiSuccess<UserData[]>>('/admin/users', {
      params: buildParams(p),
      signal,
    });
    const pagination = (data.meta as { pagination: PaginationMeta }).pagination;
    return { data: data.data, pagination };
  },

  async get(id: number): Promise<UserData> {
    const { data } = await http.get<ApiSuccess<UserData>>(`/admin/users/${id}`);
    return data.data;
  },

  async create(payload: UserUpsertPayload): Promise<{ message: string; data: UserData }> {
    const { data } = await http.post<ApiSuccess<UserData>>('/admin/users', payload);
    return { message: data.message, data: data.data };
  },

  async update(id: number, payload: UserUpsertPayload): Promise<string> {
    const { data } = await http.put<ApiSuccess<UserData>>(`/admin/users/${id}`, payload);
    return data.message;
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/users/${id}`);
    return data.message;
  },

  async restore(id: number): Promise<string> {
    const { data } = await http.post<ApiSuccess<UserData>>(`/admin/users/${id}/restore`);
    return data.message;
  },

  async sendPasswordReset(id: number): Promise<string> {
    const { data } = await http.post<ApiSuccess<unknown>>(
      `/admin/users/${id}/password-reset`,
    );
    return data.message;
  },

  async setEmailVerified(id: number, verified: boolean): Promise<string> {
    const { data } = await http.put<ApiSuccess<UserData>>(`/admin/users/${id}`, {
      email_verified: verified,
    });
    return data.message;
  },

  async uploadAvatar(file: File): Promise<{ path: string; url: string }> {
    const form = new FormData();
    form.append('avatar', file);
    // لا تضبط Content-Type يدوياً — المتصفح يولّد boundary
    const { data } = await http.post<ApiSuccess<{ path: string; url: string }>>(
      '/admin/users/avatar',
      form,
    );
    return data.data;
  },
};
