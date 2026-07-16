/** أنواع نطاق المحتوى — تطابق عقود الـ backend (ArticleResource, CategoryResource). */
import type { PaginationMeta } from '@/types/users.types';

// ─── المقالات ────────────────────────────────────────────────────────────

export type ArticleType = 'news' | 'opinion' | 'live';

/** Live event lifecycle (only meaningful for type=live). */
export type LiveEventStatus = 'scheduled' | 'live' | 'paused' | 'completed';

/** Universal engagement metrics (platform-wide, polymorphic). */
export interface EngagementMetrics {
  views: number;
  likes: number;
  dislikes: number;
  favorites: number;
}

export type ArticleStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'archived';

export type ContentLocale = 'ar' | 'en';

export interface ArticleAuthorRef {
  id: number;
  name: string;
  avatar?: string | null;
}

export interface ArticleCategoryRef {
  id: number;
  name: string;
  slug: string;
}

export interface ArticleMediaItem {
  id: number;
  url: string;
  thumb?: string;
  medium?: string;
  name?: string;
  alt?: string | null;
}

export interface ArticleSeo {
  title: string | null;
  description: string | null;
  keywords: string | null;
  canonical_url: string | null;
  robots: string | null;
}

export interface ArticleData {
  id: number;
  type: ArticleType;
  status: ArticleStatus;
  locale: ContentLocale;
  translation_group: string | null;
  title: string;
  subtitle: string | null;
  slug: string;
  short_url: string | null;
  excerpt: string | null;
  content_json: unknown;
  content_html: string | null;
  tags?: string[];
  seo: ArticleSeo;
  canonical_path: string | null;
  is_featured: boolean;
  is_breaking: boolean;
  is_pinned: boolean;
  is_header: boolean;
  is_editor_pick: boolean;
  is_squares: boolean;
  event_status?: LiveEventStatus | null;
  og_image_id?: number | null;
  og_image?: string | null;
  comments_enabled: boolean;
  published_at: string | null;
  deleted_at?: string | null;
  views_count: number;
  /** Universal engagement metrics (present when eager-loaded). */
  metrics?: EngagementMetrics;
  author?: ArticleAuthorRef;
  primary_category?: ArticleCategoryRef;
  secondary_categories?: ArticleCategoryRef[];
  media?: {
    cover: ArticleMediaItem | null;
    gallery: ArticleMediaItem[];
    inline: ArticleMediaItem[];
    video: Array<{
      id: number;
      uuid?: string | null;
      url: string;
      mime: string;
      name?: string | null;
      is_external?: boolean;
      provider?: string | null;
      poster?: string | null;
      processing_status?: VideoProcessingStatus | null;
      duration?: number | null;
      hls?: string | null;
    }>;
  };
  created_at: string;
  updated_at: string;
}

export interface ArticlesListParams {
  page: number;
  per_page: number;
  search: string;
  status: '' | ArticleStatus;
  type: '' | ArticleType;
  locale: '' | ContentLocale;
  /** Matches primary OR secondary (pivot) category. */
  category: number | '';
  author_id?: number | '';
  /** فلتر نوع العرض: مثبّت/عاجل/سلايدر/الهيدر/تريندنغ/مربعات — يُرسَل كـ filter[<flag>]=1. */
  placement: '' | 'is_pinned' | 'is_breaking' | 'is_featured' | 'is_header' | 'is_editor_pick' | 'is_squares';
  sort: '' | '-created_at' | '-published_at' | 'title' | 'id';
  trashed?: '' | 'only';
}

export interface ArticlesListResult {
  data: ArticleData[];
  pagination: PaginationMeta;
}

// ─── Reels (first-class content type) ──────────────────────────────────────

export type ReelStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'archived';

export interface ReelMediaRef {
  id: number;
  uuid: string;
  processing_status: string | null;
}

export interface ReelData {
  id: number;
  uuid: string;
  status: ReelStatus;
  is_featured: boolean;
  locale: ContentLocale;
  title: string;
  slug: string;
  description: string | null;
  duration_seconds: number | null;
  sort_order: number;
  seo: {
    title: string | null;
    description: string | null;
    keywords: string | null;
    canonical_url: string | null;
    robots: string | null;
  };
  canonical_path: string;
  share_image?: string | null;
  metrics?: EngagementMetrics;
  media_asset_id: number | null;
  media?: ReelMediaRef | null;
  author?: { id: number; name: string } | null;
  published_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReelUpsertPayload {
  title?: string;
  is_featured?: boolean;
  locale?: ContentLocale;
  author_id?: number | null;
  media_asset_id?: number | null;
  slug?: string | null;
  description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  canonical_url?: string | null;
  robots?: string | null;
  sort_order?: number;
}

export interface ReelsListParams {
  page: number;
  per_page: number;
  search: string;
  status: '' | ReelStatus;
  locale: '' | ContentLocale;
  sort: '' | '-created_at' | '-published_at' | 'title' | 'sort_order';
  trashed?: '' | 'only';
}

export interface ReelsListResult {
  data: ReelData[];
  pagination: PaginationMeta;
}

/** Per-status counts for the reels dashboard stat cards. */
export interface ReelStats {
  draft: number;
  scheduled: number;
  published: number;
  archived: number;
  total: number;
  trashed: number;
}

// ─── Pages (CMS-managed static pages) ─────────────────────────────────────

export type PageStatus = 'draft' | 'published' | 'archived';

export interface PageAuthorRef {
  id: number;
  name: string;
}

export interface PageSeo {
  title: string | null;
  description: string | null;
  keywords: string | null;
  canonical_url: string | null;
  robots: string | null;
}

export interface PageData {
  id: number;
  uuid: string;
  status: PageStatus;
  locale: ContentLocale;
  translation_group: string | null;
  title: string;
  slug: string;
  content_html: string | null;
  template: string | null;
  show_in_header: boolean;
  show_in_footer: boolean;
  sort_order: number;
  seo: PageSeo;
  canonical_path: string | null;
  author?: PageAuthorRef | null;
  published_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PagesListParams {
  page: number;
  per_page: number;
  search: string;
  status: '' | PageStatus;
  locale: '' | ContentLocale;
  show_in_header: '' | '0' | '1';
  show_in_footer: '' | '0' | '1';
  sort: '' | '-created_at' | '-published_at' | 'title' | 'sort_order' | 'id';
  trashed?: '' | 'only' | 'with';
}

export interface PagesListResult {
  data: PageData[];
  pagination: PaginationMeta;
}

// ─── Tags management ─────────────────────────────────────────────────────────

export interface ManagedTag {
  id: number;
  name: Record<string, string>;
  slug: Record<string, string>;
  type: string | null;
  usage_count: number;
  created_at: string | null;
}

export interface TagsListParams {
  page: number;
  per_page: number;
  q: string;
  locale: ContentLocale;
}

export interface TagsListResult {
  data: ManagedTag[];
  pagination: PaginationMeta;
}

export interface TagUpdatePayload {
  name: { ar?: string; en?: string };
}

/**
 * StorePageRequest / UpdatePageRequest payload — every field is `sometimes`
 * server-side; on create, title + locale + content are required.
 */
export interface PageUpsertPayload {
  title?: string;
  locale?: ContentLocale;
  author_id?: number | null;
  slug?: string | null;
  content?: string | null;
  template?: string | null;
  show_in_header?: boolean;
  show_in_footer?: boolean;
  sort_order?: number;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  canonical_url?: string | null;
  robots?: string | null;
}

/** Quick article counts for the list-page stat cards. */
export interface ArticleStats {
  total: number;
  published: number;
  draft: number;
  deleted: number;
  featured: number;
}

/**
 * StoreArticleRequest / UpdateArticleRequest payload.
 * Backend treats every field as 'sometimes' on update; on create, title/locale/type/
 * primary_category_id/content_json are required.
 */
export interface ArticleUpsertPayload {
  title?: string;
  locale?: ContentLocale;
  type?: ArticleType;
  author_id?: number | null;
  primary_category_id?: number;
  secondary_category_ids?: number[];
  slug?: string | null;
  subtitle?: string | null;
  short_url?: string | null;
  excerpt?: string | null;
  content_json?: unknown;
  tags?: string[];
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  canonical_url?: string | null;
  robots?: string | null;
  og_image_id?: number | null;
  is_featured?: boolean;
  is_breaking?: boolean;
  is_pinned?: boolean;
  is_header?: boolean;
  is_editor_pick?: boolean;
  is_squares?: boolean;
  comments_enabled?: boolean;
  views_count?: number;
  /** Attach-on-save: full set of media attachments (omit to leave untouched). */
  media?: ArticleMediaAttachment[];
}

// ─── AI Editorial Copilot ──────────────────────────────────────────────────

export type AiRewriteMode =
  | 'journalistic'
  | 'formal'
  | 'concise'
  | 'stronger'
  | 'simplified'
  | 'professional'
  | 'seo';

/** Whether a result came from the AI provider or the deterministic fallback. */
export type AiSource = 'ai' | 'auto';

/** Shared editorial context sent to the copilot endpoints. */
export interface AiEditorialContext {
  title?: string;
  subtitle?: string;
  excerpt?: string;
  body?: string;
  type?: ArticleType;
  categories?: string[];
  locale?: ContentLocale;
}

export interface AiHeadlineSuggestions {
  news: string[];
  editorial: string[];
  seo: string[];
}

export interface AiTagSuggestions {
  source?: AiSource;
  people: string[];
  locations: string[];
  organizations: string[];
  topics: string[];
}

/** AI editorial quality analysis (suggestions only — never mutates content). */
export interface AiContentAnalysis {
  score: number;
  readability: string;
  issues: string[];
  suggestions: string[];
}

export interface AiExcerptResult {
  excerpt: string;
  source: AiSource;
}

export interface AiSeoAnalysis {
  source?: AiSource;
  score: number;
  title_feedback: string;
  description_feedback: string;
  missing_keywords: string[];
  suggestions: string[];
}

// ─── التصنيفات ───────────────────────────────────────────────────────────

export type CategoryScope = 'news' | 'opinion' | 'both';

export type CategoryStatus = 'active' | 'hidden';

export interface CategoryData {
  id: number;
  parent_id: number | null;
  locale: ContentLocale;
  translation_group: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  scope: CategoryScope;
  status: CategoryStatus;
  show_in_header: boolean;
  show_in_body: boolean;
  show_in_footer: boolean;
  sort_order: number;
  created_at: string;
  /** Total articles (primary + secondary) — list endpoint only. */
  articles_count?: number;
  children: CategoryData[];
}

/** A soft-deleted category (flat trash list). */
export interface TrashedCategory {
  id: number;
  name: string;
  slug: string;
  locale: ContentLocale;
  scope: CategoryScope;
  parent_id: number | null;
  parent_name: string | null;
  deleted_at: string | null;
}

/** Fields editable in a bulk category action. */
export interface CategoryBulkPayload {
  status?: CategoryStatus;
  show_in_header?: boolean;
  show_in_body?: boolean;
  show_in_footer?: boolean;
}

/**
 * StoreCategoryRequest / UpdateCategoryRequest payload.
 * Backend treats every field as 'sometimes' on update; on create, name + locale
 * are required.
 */
export interface CategoryUpsertPayload {
  name?: string;
  locale?: ContentLocale;
  parent_id?: number | null;
  slug?: string | null;
  description?: string | null;
  icon?: string | null;
  scope?: CategoryScope;
  status?: CategoryStatus;
  show_in_header?: boolean;
  show_in_body?: boolean;
  show_in_footer?: boolean;
  sort_order?: number;
}

// ─── Unified Media Studio (P9 — central shared assets) ─────────────────────

export type VideoProvider =
  | 'youtube'
  | 'vimeo'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'mp4';

/** A central library asset (MediaAssetResource). */
export interface MediaAssetData {
  id: number;
  uuid: string;
  kind: 'file' | 'external';
  url: string | null;
  thumb: string | null;
  medium: string | null;
  mime_type: string;
  is_image: boolean;
  is_external: boolean;
  is_video: boolean;
  provider: VideoProvider | null;
  provider_id: string | null;
  embed_url: string | null;
  source_url: string | null;
  poster: string | null;
  processing_status: VideoProcessingStatus | null;
  /** Granular transcoding checklist (uploaded video only — null otherwise). */
  processing?: TranscodeProgress | null;
  duration: number | null;
  hls: string | null;
  /** Progressive MP4 renditions (reel profile) — empty otherwise. */
  renditions?: Record<string, string>;
  /** Thumbnail urls (reel profile): jpg always, webp when available. */
  thumbnail?: { jpg: string | null; webp: string | null } | null;
  width: number | null;
  height: number | null;
  size: number;
  original_name: string;
  filename?: string | null;
  extension?: string | null;
  checksum?: string | null;
  alt: string | null;
  caption: string | null;
  credit: string | null;
  source: string | null;
  created_at: string | null;
  /** Usage governance — present in list (count) and detail (count + where-used). */
  usage_count?: number;
  usages?: MediaAssetUsage[];
}

/** State of one transcoding artifact in the granular checklist. */
export type TranscodeArtifactState = 'ready' | 'pending' | 'failed' | 'skipped';

/** One artifact row (key maps to an i18n label; order = production order). */
export interface TranscodeArtifact {
  key: string;
  state: TranscodeArtifactState;
  optional: boolean;
}

/** Granular transcoding progress derived server-side from media state. */
export interface TranscodeProgress {
  status: VideoProcessingStatus | null;
  profile: 'reel' | null;
  total: number;
  completed: number;
  /** Stage where processing failed (only when status === 'failed'). */
  failed_stage: string | null;
  /** Diagnosable failure reason key (only when status === 'failed'). */
  error?: string | null;
  artifacts: TranscodeArtifact[];
}

/** A single "where used" reference for a library asset (detail view). */
export interface MediaAssetUsage {
  context: 'article' | 'live_update';
  id: number;
  title: string | null;
  type?: string;
  article_id?: number;
}

/** Uploaded-video processing lifecycle (null for images / external). */
export type VideoProcessingStatus = 'queued' | 'processing' | 'ready' | 'failed';

/** Resolved external-video preview (resolve endpoint). */
export interface ExternalVideoResolved {
  provider: VideoProvider;
  provider_id: string | null;
  embed_url: string;
  source_url: string;
  poster_url: string | null;
}

export type MediaLibraryFilterType = 'image' | 'video' | 'external' | '';

export interface MediaLibraryListParams {
  type?: MediaLibraryFilterType;
  provider?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

/** Metadata-only edit payload (PATCH /admin/media/{uuid}). */
export interface MediaMetadataPayload {
  alt?: string | null;
  caption?: string | null;
  credit?: string | null;
  source?: string | null;
}

export interface MediaLibraryListResult {
  data: MediaAssetData[];
  pagination: PaginationMeta;
}

/** Pivot collection an asset is attached to within an article. */
export type StagedCollection = 'cover' | 'gallery' | 'inline' | 'video';

/**
 * A media attachment held in client state before the article is saved
 * (client-stage → attach-on-save). Display fields are denormalised so the
 * studio can render uniformly across upload / library / edit-seed sources.
 */
export interface StagedMediaItem {
  assetId: number;
  uuid?: string | null;
  collection: StagedCollection;
  position: number;
  url: string | null;
  thumb: string | null;
  isImage: boolean;
  mime: string | null;
  name: string | null;
  /** External video metadata (provider-backed assets). */
  external?: boolean;
  provider?: VideoProvider | null;
  embedUrl?: string | null;
  poster?: string | null;
  /** Uploaded-video processing lifecycle. */
  processingStatus?: VideoProcessingStatus | null;
  duration?: number | null;
  hls?: string | null;
}

/** Attach-on-save payload entry sent with the article create/update. */
export interface ArticleMediaAttachment {
  asset_id: number;
  collection: StagedCollection;
  position: number;
}

// ─── Live coverage updates (P8) ──────────────────────────────────────────

export interface LiveUpdateAuthorRef {
  id: number;
  name: string;
}

export interface LiveUpdateData {
  id: number;
  article_id: number;
  title: string | null;
  content_json: unknown;
  content_html: string | null;
  is_pinned: boolean;
  is_breaking: boolean;
  is_featured: boolean;
  happened_at: string | null;
  author?: LiveUpdateAuthorRef;
  /** Shared media block (same shape as article media). */
  media?: ArticleData['media'];
  created_at: string;
  updated_at: string;
}

export interface LiveUpdatesListResult {
  data: LiveUpdateData[];
  pagination: PaginationMeta;
}

export interface LiveUpdateCreatePayload {
  title?: string | null;
  content_json: unknown;
  is_pinned?: boolean;
  is_breaking?: boolean;
  is_featured?: boolean;
  happened_at?: string | null;
  media?: ArticleMediaAttachment[];
}

export interface LiveUpdateUpdatePayload {
  title?: string | null;
  content_json?: unknown;
  is_pinned?: boolean;
  is_breaking?: boolean;
  is_featured?: boolean;
  happened_at?: string | null;
  media?: ArticleMediaAttachment[];
}

// ملاحظة: أُزيلت أنواع «التنسيبات التحريرية» (PlacementZone/PlacementData/…) —
// مكان عرض الخبر صار بأعلام is_featured/is_breaking/is_header/is_editor_pick على
// جدول الأخبار، تُضبط من نموذج الخبر مباشرةً.

// ─── News closure: true preview + SEO guidance + slug-check ──────────────────

export interface SeoGuidanceItem {
  key: string;
  severity: 'ok' | 'info' | 'warn';
  detail?: Record<string, unknown>;
}

/** The exact public-facing article payload returned by the preview endpoint. */
export interface ArticlePreviewDoc {
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  content_html: string;
  locale: ContentLocale;
  type: ArticleType;
  published_at?: string | null;
  media?: {
    cover?: { url?: string; medium?: string; thumb?: string; alt?: string | null } | null;
  } | null;
  seo?: { structured_data?: Record<string, unknown>; canonical_url?: string } & Record<string, unknown>;
}

export interface ArticlePreview {
  preview: ArticlePreviewDoc;
  seo_guidance: SeoGuidanceItem[];
}

export interface SlugCheckResult {
  available: boolean;
  slug: string;
  suggestion: string;
}
