import { http } from './http/client';
import type { ApiSuccess } from '@/types/api';
import type {
  BarSettingsData,
  CompetitionCreatePayload,
  CompetitionData,
  CompetitionUpdatePayload,
  SportMenuItemData,
  SportMenuItemPayload,
  SportSettingsData,
  SportSettingsPayload,
} from '@/types/sport.types';

type BarEndpoint = 'match-bar' | 'sports-home-bar';

async function toggleCompetitionBar(endpoint: BarEndpoint, id: number): Promise<string> {
  const { data } = await http.patch<ApiSuccess<CompetitionData>>(`/admin/competitions/${id}/${endpoint}`);
  return data.message;
}

async function reorderCompetitionsBar(endpoint: BarEndpoint, ids: number[]): Promise<string> {
  const { data } = await http.patch<ApiSuccess<unknown>>(`/admin/competitions/${endpoint}/reorder`, { ids });
  return data.message;
}

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

  toggleMatchBar: (id: number) => toggleCompetitionBar('match-bar', id),
  reorderMatchBar: (ids: number[]) => reorderCompetitionsBar('match-bar', ids),

  toggleSportsHomeBar: (id: number) => toggleCompetitionBar('sports-home-bar', id),
  reorderSportsHomeBar: (ids: number[]) => reorderCompetitionsBar('sports-home-bar', ids),
};

async function getBarSettings(endpoint: BarEndpoint): Promise<BarSettingsData> {
  const { data } = await http.get<ApiSuccess<BarSettingsData>>(`/admin/settings/${endpoint}`);
  return data.data;
}

async function updateBarSettings(endpoint: BarEndpoint, enabled: boolean): Promise<string> {
  const { data } = await http.put<ApiSuccess<BarSettingsData>>(`/admin/settings/${endpoint}`, { enabled });
  return data.message;
}

export const matchBarSettingsService = {
  get: () => getBarSettings('match-bar'),
  update: (enabled: boolean) => updateBarSettings('match-bar', enabled),
};

export const sportsHomeBarSettingsService = {
  get: () => getBarSettings('sports-home-bar'),
  update: (enabled: boolean) => updateBarSettings('sports-home-bar', enabled),
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
