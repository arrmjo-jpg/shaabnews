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
  fixtures_count: number;

  is_featured_tournament: boolean;
  featured_until: string | null;
  show_in_match_bar: boolean;
  match_bar_sort_order: number | null;

  show_in_sports_home_bar: boolean;
  sports_home_bar_sort_order: number | null;

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
  show_in_sports_home_bar?: boolean;
  sports_home_bar_sort_order?: number | null;
}

/** مشتركة بين Match Bar وSports Home Bar — نفس الشكل لكليهما. */
export interface BarSettingsData {
  enabled: boolean;
  eligible_competitions_count: number;
}

/** عقد SportMenuItemResource — شجرة بمستوى واحد من التداخل (children عبر whenLoaded). */
export interface SportMenuItemData {
  id: number;
  parent_id: number | null;
  locale: string;
  title: string;
  type: 'category' | 'section';
  category_id: number | null;
  section_key: string | null;
  icon: string | null;
  order: number;
  enabled: boolean;
  created_at: string | null;
  children?: SportMenuItemData[];
}

export interface SportMenuItemPayload {
  locale?: string;
  title?: string;
  type?: 'category' | 'section';
  category_id?: number | null;
  section_key?: string | null;
  parent_id?: number | null;
  icon?: string | null;
  order?: number;
  enabled?: boolean;
}

/** عقد ShowSportSettingsAction — الحقول الـ11 كاملة دائمًا (لا partial على القراءة). */
export interface SportSettingsData {
  sport_primary_color: string | null;
  sport_secondary_color: string | null;
  sport_default_theme: 'light' | 'dark' | 'system';
  sport_allow_theme_switch: boolean;
  sport_theme_cookie: string;
  sport_default_sport: string | null;
  sport_default_country: string | null;
  sport_default_competition: string | null;
  sport_prediction_enabled: boolean;
  sport_search_enabled: boolean;
  sport_live_scores_enabled: boolean;
}

export type SportSettingsPayload = Partial<SportSettingsData>;
