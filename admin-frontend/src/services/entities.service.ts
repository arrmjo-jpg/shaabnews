import { http } from './http/client';
import type { ApiSuccess } from '@/types/api';

export type EntityType = 'person' | 'organization' | 'place' | 'topic';

export interface EntitySuggestion {
  id: number;
  type: EntityType;
  name: string;
  slug: string;
  description: string | null;
}

export type EntityContentType = 'article' | 'video' | 'reel';

const syncPath: Record<EntityContentType, (id: number) => string> = {
  article: (id) => `/admin/articles/${id}/entities`,
  video: (id) => `/admin/videos/${id}/entities`,
  reel: (id) => `/admin/reels/${id}/entities`,
};

export const entitiesService = {
  /** Search/typeahead — optionally filtered by type. */
  async search(q: string, type?: EntityType, limit = 20): Promise<EntitySuggestion[]> {
    const { data } = await http.get<ApiSuccess<EntitySuggestion[]>>('/admin/entities', {
      params: { q, type, limit },
    });
    return data.data;
  },

  /** Create a new canonical entity (name+type duplicate-checked server-side). */
  async create(payload: { type: EntityType; name: string; description?: string }): Promise<EntitySuggestion> {
    const { data } = await http.post<ApiSuccess<EntitySuggestion>>('/admin/entities', payload);
    return data.data;
  },

  /** Current entities tagged on a piece of content (read-only, GET). */
  async currentFor(contentType: EntityContentType, contentId: number): Promise<EntitySuggestion[]> {
    const { data } = await http.get<ApiSuccess<EntitySuggestion[]>>(syncPath[contentType](contentId));
    return data.data;
  },

  /** Replace the full set of entities tagged on a piece of content. */
  async sync(contentType: EntityContentType, contentId: number, entityIds: number[]): Promise<EntitySuggestion[]> {
    const { data } = await http.patch<ApiSuccess<EntitySuggestion[]>>(syncPath[contentType](contentId), {
      entity_ids: entityIds,
    });
    return data.data;
  },
};
