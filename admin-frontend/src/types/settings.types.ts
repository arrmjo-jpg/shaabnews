/** جهة اتصال هاتفيّة واحدة: اسم الشخص + المسمى الوظيفي + الرقم. */
export interface ContactPhone {
  name: string;
  title: string;
  phone: string;
}

export interface GeneralSiteData {
  site_name: string;
  site_name_ar: string;
  site_name_en: string;
  site_email: string;
  site_url: string;
  timezone: string;
  site_phone: string;
  site_phones: ContactPhone[];
  site_description: string;
  site_description_ar: string;
  site_description_en: string;
  copyright_text: string;
  copyright_text_ar: string;
  copyright_text_en: string;
  footer_extra_text: string;
  cookie_policy_text: string;
  cookie_policy_text_ar: string;
  cookie_policy_text_en: string;
  logo_light: string | null;
  logo_dark: string | null;
  logo_light_en: string | null;
  logo_dark_en: string | null;
  favicon: string | null;
  watermark_enabled: boolean;
  watermark_image: string | null;
  watermark_position: string;
  watermark_opacity: number;
  watermark_width: number;
  watermark_margin: number;
  comments_enabled: boolean;
  maintenance_mode: boolean;
  latitude: string | null;
  longitude: string | null;
}

export interface GeneralMailData {
  mail_mailer: string;
  mail_host: string;
  mail_port: number;
  mail_encryption: string;
  mail_from_name: string;
  mail_from_email: string;
  mail_username: string;
  mail_password: string | null;
  mail_password_configured: boolean;
}

export interface GeneralSocialData {
  facebook: string;
  facebook_page_id: string;
  twitter_x: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  tiktok: string;
  whatsapp: string;
  whatsapp_channel: string;
  nabd: string;
}

export interface GeneralAnalyticsData {
  google_meta_tag: string;
  google_analytics: string;
  facebook_pixel: string;
  facebook_page_id: string;
  tiktok_pixel: string;
  instagram_pixel: string;
  other_meta: string;
}

export interface GeneralSettingsData {
  site: GeneralSiteData;
  mail: GeneralMailData;
  social: GeneralSocialData;
  analytics: GeneralAnalyticsData;
}

/** حمولة التحديث مسطّحة (UpdateGeneralSettingsRequest) */
export type GeneralUpdatePayload = Record<string, string | number | boolean | null | string[] | ContactPhone[]>;

export interface MediaAssetResponse {
  id: string;
  original_name: string;
  mime_type: string;
  extension: string;
  size: number;
  visibility: string;
  url: string | null;
  created_at: string;
}

// ─── Hybrid media storage (remote mirror) ──────────────────────────────────

/** إعدادات التخزين الهجين — الأسرار مُقنَّعة (********) ولا تُكشف قيمتها. */
export interface MediaStorageSettingsData {
  remote_enabled: boolean;
  remote_driver: string;
  remote_key: string | null;
  remote_key_configured: boolean;
  remote_secret: string | null;
  remote_secret_configured: boolean;
  remote_bucket: string;
  remote_region: string;
  remote_endpoint: string;
  remote_url: string;
  remote_use_path_style: boolean;
}

/** عدّادات حالة المزامنة الحيّة للمتراكم التشغيلي. */
export interface MediaStorageBacklog {
  pending: number;
  syncing: number;
  failed: number;
  synced: number;
  disabled: number;
  unsynced: number;
}

/** أصل فشلت مزامنته البعيدة — مع سبب الفشل لعرضه للأدمن. */
export interface MediaStorageFailure {
  id: number;
  name: string;
  error: string | null;
  at: string | null;
}

export interface MediaStorageStatus {
  settings: MediaStorageSettingsData;
  backlog: MediaStorageBacklog;
  failures: MediaStorageFailure[];
  remote_healthy: boolean | null;
}

/** حمولة التحديث/الاختبار مسطّحة. */
export type MediaStorageUpdatePayload = Record<string, string | number | boolean | null>;
