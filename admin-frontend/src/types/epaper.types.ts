/** أنواع نطاق الجريدة الرقمية — تطابق عقود الـ backend (EpaperResource + إعدادات الوحدة).
 *  لا بنية موازية: نفس عقد ApiResponse + pagination meta لبقية النطاقات. */
import type { PaginationMeta } from '@/types/users.types';

export type EpaperStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type EpaperAccessLevel = 'public' | 'subscriber' | 'private';
export type EpaperLocale = 'ar' | 'en';

export interface EpaperMediaRef {
  asset_id: number | null;
  pdf_url: string | null;
  cover_url?: string | null;
}

/** عناصر الحقول التحريريّة المنتقاة (اختياريّة لكل عدد). */
export interface EpaperBriefPoint {
  title: string;
  why?: string | null;
}
export interface EpaperHighlight {
  title: string;
  quote?: string | null;
  page?: number | null;
}
export interface EpaperInsideSection {
  label: string;
  lead?: string | null;
  page?: number | null;
}

export interface EpaperData {
  id: number;
  uuid: string;
  locale: EpaperLocale;
  issue_number: number;
  title: string;
  subtitle: string | null;
  summary: string | null;
  brief_points: EpaperBriefPoint[] | null;
  highlights: EpaperHighlight[] | null;
  inside_this_issue: EpaperInsideSection[] | null;
  slug: string;
  status: EpaperStatus;
  access_level: EpaperAccessLevel;
  publication_date: string | null;
  current_version: number;
  page_count: number | null;
  media: EpaperMediaRef;
  author?: { id: number; name: string } | null;
  canonical_path: string;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** إنشاء عدد — ميتاداتا + ملف PDF (يُرسَل multipart). */
export interface EpaperCreateFields {
  issue_number: number;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  slug?: string | null;
  publication_date: string;
  access_level?: EpaperAccessLevel;
  locale: EpaperLocale;
  note?: string | null;
}

/** تحديث ميتاداتا فقط — استبدال الـ PDF عبر نقطة نهاية منفصلة. */
export interface EpaperUpdatePayload {
  issue_number?: number;
  title?: string;
  subtitle?: string | null;
  summary?: string | null;
  slug?: string | null;
  publication_date?: string;
  access_level?: EpaperAccessLevel;
  brief_points?: EpaperBriefPoint[] | null;
  highlights?: EpaperHighlight[] | null;
  inside_this_issue?: EpaperInsideSection[] | null;
}

export interface EpapersListParams {
  page: number;
  per_page: number;
  search: string;
  status: '' | EpaperStatus;
  locale: '' | EpaperLocale;
  sort: '' | '-publication_date' | 'publication_date' | 'issue_number' | '-published_at' | '-created_at';
  trashed?: '' | 'only';
}

export interface EpapersListResult {
  data: EpaperData[];
  pagination: PaginationMeta;
}

/** إعدادات الوحدة (تفعيل + اسم معروض) — تُقرأ لتقييد التنقّل وتُبدَّل من الإعدادات. */
export interface NewspaperSettingsData {
  enabled: boolean;
  display_name: string;
  subscribe_url: string;
}

/** تحليلات القارئ (Phase 5) — تقرير أساسيّ لكل عدد (يطابق ShowEpaperAnalyticsAction). */
export interface EpaperAnalyticsData {
  issue: {
    id: number;
    title: string;
    issue_number: number;
    page_count: number | null;
  };
  totals: {
    opens: number;
    sessions: number;
    total_duration_seconds: number;
    avg_session_seconds: number;
    pages_viewed: number;
    searches: number;
    bookmarks_used: number;
    resumes_used: number;
    last_activity_at: string | null;
  };
  top_pages: { page: number; views: number }[];
  top_terms: { term: string; count: number }[];
}

/** لوحة تحليلات القارئ العابرة للأعداد (Final completion) — تطابق EpaperDashboardAnalyticsAction. */
export interface EpaperDashboardData {
  range: { period: string; from: string; to: string };
  overview: {
    opens: number;
    sessions: number;
    total_duration_seconds: number;
    avg_session_seconds: number;
    pages_viewed: number;
    searches: number;
    bookmarks_used: number;
    resumes_used: number;
    downloads: number;
    archive_searches: number;
    active_issues: number;
  };
  series: {
    date: string;
    opens: number;
    sessions: number;
    total_duration_seconds: number;
    searches: number;
    downloads: number;
    archive_searches: number;
  }[];
  top_issues: {
    id: number;
    title: string;
    issue_number: number;
    opens: number;
    sessions: number;
    total_duration_seconds: number;
    avg_session_seconds: number;
    pages_viewed: number;
    searches: number;
    bookmarks_used: number;
    resumes_used: number;
    downloads: number;
    engagement_score: number;
  }[];
  trending: {
    id: number;
    title: string;
    issue_number: number;
    recent_sessions: number;
    prior_sessions: number;
    growth: number;
  }[];
  reader_behavior: {
    top_pages: { page: number; views: number }[];
    top_terms: { term: string; count: number }[];
  };
}

/** الرؤية التشغيليّة للجريدة (Final completion — البند C) — تطابق EpaperOperationsAction. */
export interface EpaperOperationsData {
  queues: { pending: number; failed: number; media: number; analytics: number };
  delivery: { remote_enabled: boolean };
  checked_at: string;
}
