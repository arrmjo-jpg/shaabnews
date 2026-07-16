/** أنواع نطاق مكتبة الفيديو — تطابق عقود الـ backend (VideoResource, VideoCategoryResource,
 *  VideoPlaylistResource, VideoDashboardAction, VideoStatsAction). لا بنية موازية. */
import type { ContentLocale, EngagementMetrics } from '@/types/content.types';
import type { PaginationMeta } from '@/types/users.types';

export type VideoStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'archived';
export type VideoVisibility = 'public' | 'unlisted' | 'private';
export type VideoSourceType = 'uploaded' | 'youtube' | 'vimeo' | 'direct_mp4';
export type VideoProcessingStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface VideoMediaRef {
  id: number;
  uuid: string;
  kind: string;
  provider: string | null;
  processing_status: VideoProcessingStatus | null;
  embed_url: string | null;
  poster_url: string | null;
}

export interface VideoCategoryRef {
  id: number;
  name: string;
  slug: string;
}

export interface VideoSeo {
  title: string | null;
  description: string | null;
  keywords: string | null;
  canonical_url: string | null;
  robots: string | null;
}

export interface VideoData {
  id: number;
  uuid: string;
  status: VideoStatus;
  visibility: VideoVisibility;
  source_type: VideoSourceType;
  is_featured: boolean;
  locale: ContentLocale;
  translation_group: string | null;
  title: string;
  slug: string;
  description: string | null;
  excerpt: string | null;
  duration_seconds: number | null;
  views_count: number;
  sort_order: number;
  seo: VideoSeo;
  canonical_path: string;
  share_image?: string | null;
  metrics?: EngagementMetrics;
  category?: VideoCategoryRef | null;
  video_category_id: number | null;
  media_asset_id: number | null;
  media?: VideoMediaRef | null;
  author?: { id: number | null; name: string | null };
  published_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** StoreVideoRequest / UpdateVideoRequest — على الإنشاء يلزم title + locale + مصدر
 *  (media_asset_id أو source_url)؛ على التحديث كل الحقول 'sometimes'. */
export interface VideoUpsertPayload {
  title?: string;
  locale?: ContentLocale;
  source_url?: string | null;
  media_asset_id?: number | null;
  video_category_id?: number | null;
  visibility?: VideoVisibility;
  is_featured?: boolean;
  slug?: string | null;
  description?: string | null;
  excerpt?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  canonical_url?: string | null;
  robots?: string | null;
  sort_order?: number;
}

export interface VideosListParams {
  page: number;
  per_page: number;
  search: string;
  status: '' | VideoStatus;
  visibility: '' | VideoVisibility;
  source_type: '' | VideoSourceType;
  locale: '' | ContentLocale;
  video_category_id?: '' | number;
  sort: '' | '-created_at' | '-published_at' | 'title' | '-views_count' | 'sort_order';
  trashed?: '' | 'only';
}

export interface VideosListResult {
  data: VideoData[];
  pagination: PaginationMeta;
}

/** عدّادات بطاقات قائمة الفيديو (VideoStatsAction). */
export interface VideoStats {
  total: number;
  published: number;
  draft: number;
  scheduled: number;
  archived: number;
  processing: number;
  failed_processing: number;
  featured: number;
  total_views: number;
}

/** عملية جماعية (BulkVideoRequest). */
export type VideoBulkAction =
  | 'publish'
  | 'unpublish'
  | 'feature'
  | 'move_category'
  | 'add_to_playlist'
  | 'delete';

export interface VideoBulkPayload {
  action: VideoBulkAction;
  ids: number[];
  value?: boolean;
  video_category_id?: number | null;
  playlist_id?: number;
}

export interface VideoBulkResult {
  action: VideoBulkAction;
  requested: number;
  processed: number;
  skipped: Array<{ id: number; reason: string }>;
}

// ─── Dashboard (VideoDashboardAction) ──────────────────────────────────────

export interface VideoDashboardTopVideo {
  id: number;
  title: string;
  slug: string;
  locale: ContentLocale;
  views_count: number;
}

export interface VideoDashboardTopCategory {
  id: number;
  name: string;
  slug: string;
  videos_count: number;
}

export interface VideoDashboardData {
  status_counts: {
    total: number;
    draft: number;
    scheduled: number;
    published: number;
    archived: number;
  };
  source_distribution: {
    uploaded: number;
    youtube: number;
    vimeo: number;
    direct_mp4: number;
  };
  processing_health: {
    processing: number;
    failed: number;
    ready: number;
  };
  featured: number;
  total_views: number;
  playlists: { total: number; published: number; featured: number };
  categories: { total: number; active: number };
  top_videos: VideoDashboardTopVideo[];
  top_categories: VideoDashboardTopCategory[];
}

// ─── Video categories (tree) ───────────────────────────────────────────────

export interface VideoCategoryData {
  id: number;
  parent_id: number | null;
  locale: ContentLocale;
  name: string;
  slug: string;
  description: string | null;
  cover_media_id: number | null;
  cover_url?: string | null;
  is_active: boolean;
  sort_order: number;
  seo: { title: string | null; description: string | null };
  videos_count?: number;
  children: VideoCategoryData[];
  deleted_at: string | null;
  created_at: string;
}

export interface VideoCategoryUpsertPayload {
  name?: string;
  locale?: ContentLocale;
  parent_id?: number | null;
  slug?: string | null;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
  seo_title?: string | null;
  seo_description?: string | null;
}

/** PATCH /move — نقل ضمن الإخوة بالاتجاه (مرآة تصنيفات الأخبار). */
export type VideoCategoryDirection = 'up' | 'down';

// ─── Playlists ─────────────────────────────────────────────────────────────

export interface VideoPlaylistData {
  id: number;
  uuid: string;
  status: VideoStatus;
  visibility: VideoVisibility;
  is_featured: boolean;
  locale: ContentLocale;
  title: string;
  slug: string;
  description: string | null;
  cover_media_id: number | null;
  cover_url?: string | null;
  sort_order: number;
  seo: VideoSeo;
  canonical_path: string;
  videos_count?: number;
  videos?: VideoData[];
  author?: { id: number | null; name: string | null };
  published_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface VideoPlaylistUpsertPayload {
  title?: string;
  locale?: ContentLocale;
  status?: VideoStatus;
  visibility?: VideoVisibility;
  is_featured?: boolean;
  slug?: string | null;
  description?: string | null;
  cover_media_id?: number | null;
  sort_order?: number;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  canonical_url?: string | null;
  robots?: string | null;
}

export interface PlaylistsListParams {
  page: number;
  per_page: number;
  search: string;
  status: '' | VideoStatus;
  locale: '' | ContentLocale;
  sort: '' | '-created_at' | '-published_at' | 'title' | 'sort_order';
  trashed?: '' | 'only';
}

export interface PlaylistsListResult {
  data: VideoPlaylistData[];
  pagination: PaginationMeta;
}

// ─── Analytics (VideoAnalyticsAction) — مجاميع تفاعل حقيقية ─────────────────

export interface VideoAnalyticsEngagement {
  views: number;
  likes: number;
  dislikes: number;
  favorites: number;
}

export interface VideoAnalyticsTopPlaylist {
  id: number;
  title: string;
  slug: string;
  locale: ContentLocale;
  videos_count: number;
}

export interface VideoAnalyticsTrending {
  id: number;
  title: string;
  slug: string;
  locale: ContentLocale;
  views_count: number;
  score: number;
}

export interface VideoAnalyticsData {
  engagement: VideoAnalyticsEngagement;
  top_playlists: VideoAnalyticsTopPlaylist[];
  trending: VideoAnalyticsTrending[];
}

// ─── Operations (VideoOperationsAction) — رؤية تشغيلية قابلة للتنفيذ ────────

export interface VideoOperationsAttentionItem {
  id: number;
  title: string;
  locale: ContentLocale;
  media_uuid: string | null;
  processing_status: VideoProcessingStatus | null;
  updated_at: string | null;
}

export interface VideoOperationsQueueItem {
  id: number;
  title: string;
  locale: ContentLocale;
  published_at: string | null;
  overdue: boolean;
}

export interface VideoOperationsData {
  processing_health: { processing: number; failed: number };
  needs_attention: VideoOperationsAttentionItem[];
  publish_queue: {
    scheduled_total: number;
    due_now: number;
    upcoming: VideoOperationsQueueItem[];
  };
}
