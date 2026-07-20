import { http } from './http/client';
import type { ApiSuccess } from '@/types/api';
import type {
  CompetitionCreatePayload,
  CompetitionData,
  CompetitionUpdatePayload,
  MatchBarSettingsData,
  MatchBarSource,
  SportMenuItemData,
  SportMenuItemPayload,
  SportSettingsData,
  SportSettingsPayload,
} from '@/types/sport.types';

export const competitionsService = {
  async list(): Promise<CompetitionData[]> {
    const { data } = await http.get<ApiSuccess<CompetitionData[]>>('/admin/competitions');
    return data.data;
  },

  async create(payload: CompetitionCreatePayload): Promise<string> {
    const { data } = await http.post<ApiSuccess<CompetitionData>>('/admin/competitions', payload);
    return data.message;
  },

  async update(id: number, payload: CompetitionUpdatePayload): Promise<string> {
    const { data } = await http.put<ApiSuccess<CompetitionData>>(`/admin/competitions/${id}`, payload);
    return data.message;
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/competitions/${id}`);
    return data.message;
  },
};

export const matchBarSettingsService = {
  async get(): Promise<MatchBarSettingsData> {
    const { data } = await http.get<ApiSuccess<MatchBarSettingsData>>('/admin/settings/match-bar');
    return data.data;
  },

  async update(source: MatchBarSource): Promise<string> {
    const { data } = await http.put<ApiSuccess<MatchBarSettingsData>>('/admin/settings/match-bar', { source });
    return data.message;
  },
};

export const sportMenuItemsService = {
  async list(): Promise<SportMenuItemData[]> {
    const { data } = await http.get<ApiSuccess<SportMenuItemData[]>>('/admin/sport-menu-items');
    return data.data;
  },

  async create(payload: SportMenuItemPayload): Promise<string> {
    const { data } = await http.post<ApiSuccess<SportMenuItemData>>('/admin/sport-menu-items', payload);
    return data.message;
  },

  async update(id: number, payload: SportMenuItemPayload): Promise<string> {
    const { data } = await http.put<ApiSuccess<SportMenuItemData>>(`/admin/sport-menu-items/${id}`, payload);
    return data.message;
  },

  async remove(id: number): Promise<string> {
    const { data } = await http.delete<ApiSuccess<unknown>>(`/admin/sport-menu-items/${id}`);
    return data.message;
  },

  async reorder(ids: number[]): Promise<string> {
    const { data } = await http.patch<ApiSuccess<unknown>>('/admin/sport-menu-items/reorder', { ids });
    return data.message;
  },
};

export const sportSettingsService = {
  async get(): Promise<SportSettingsData> {
    const { data } = await http.get<ApiSuccess<SportSettingsData>>('/admin/settings/sport');
    return data.data;
  },

  async update(payload: SportSettingsPayload): Promise<string> {
    const { data } = await http.put<ApiSuccess<SportSettingsData>>('/admin/settings/sport', payload);
    return data.message;
  },
};
