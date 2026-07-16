import { http } from './http/client';
import type { ApiSuccess } from '@/types/api';
import type {
  CompetitionCreatePayload,
  CompetitionData,
  CompetitionUpdatePayload,
  MatchBarSettingsData,
  MatchBarSource,
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
