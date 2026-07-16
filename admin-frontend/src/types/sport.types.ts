/** أنواع نطاق الرياضة — تطابق عقود الـ backend (CompetitionResource، ShowMatchBarSettingsAction).
 *  التغطية (is_tracked) وأعلام شريط المباريات مستقلّان بنيويًّا — راجع Competition::class. */

export interface CompetitionData {
  id: number;
  provider: string;
  provider_id: number;
  name: string;
  logo_url: string | null;
  is_active: boolean;

  is_tracked: boolean;
  last_synced_at: string | null;

  is_featured_tournament: boolean;
  featured_until: string | null;
  show_in_match_bar: boolean;
  match_bar_sort_order: number | null;

  created_at: string | null;
}

export interface CompetitionCreatePayload {
  provider: string;
  provider_id: number;
  name: string;
  logo_url?: string | null;
}

export interface CompetitionUpdatePayload {
  name?: string;
  logo_url?: string | null;
  is_active?: boolean;
  is_tracked?: boolean;
  is_featured_tournament?: boolean;
  featured_until?: string | null;
  show_in_match_bar?: boolean;
  match_bar_sort_order?: number | null;
}

export type MatchBarSource = 'disabled' | 'featured_competitions' | 'regular_leagues';

export interface MatchBarSettingsData {
  source: MatchBarSource;
  eligible_competitions_count: number;
}
