import { z } from 'zod';

const optUrl = z.string().url('settings:validation.url').or(z.literal(''));
const optEmail = z.string().email('settings:validation.email').or(z.literal(''));

export const generalSchema = z.object({
  site_name: z.string().min(1, 'settings:validation.required'),
  site_name_ar: z.string().min(1, 'settings:validation.required'),
  site_name_en: z.string(),
  site_email: optEmail,
  site_url: optUrl,
  timezone: z.string().min(1, 'settings:validation.required'),
  site_phone: z.string(),
  site_description: z.string(),
  site_description_ar: z.string(),
  site_description_en: z.string(),
  copyright_text: z.string(),
  copyright_text_ar: z.string(),
  copyright_text_en: z.string(),
  footer_extra_text: z.string(),
  cookie_policy_text: z.string(),
  cookie_policy_text_ar: z.string(),
  cookie_policy_text_en: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  comments_enabled: z.boolean(),
  maintenance_mode: z.boolean(),
});
export type GeneralValues = z.infer<typeof generalSchema>;

export const watermarkSchema = z.object({
  watermark_enabled: z.boolean(),
  watermark_position: z.string(),
  watermark_opacity: z.number().min(0).max(100),
  watermark_width: z.number().min(1).max(2000),
  watermark_margin: z.number().min(0).max(500),
});
export type WatermarkValues = z.infer<typeof watermarkSchema>;

export const emailSchema = z.object({
  mail_mailer: z.string(),
  mail_host: z.string(),
  mail_port: z.number().min(1).max(65535),
  mail_encryption: z.string(),
  mail_from_name: z.string(),
  mail_from_email: optEmail,
  mail_username: z.string(),
  mail_password: z.string(),
});
export type EmailValues = z.infer<typeof emailSchema>;

export const socialSchema = z.object({
  facebook: optUrl,
  facebook_page_id: z.string(),
  twitter_x: optUrl,
  instagram: optUrl,
  linkedin: optUrl,
  youtube: optUrl,
  tiktok: optUrl,
  whatsapp: z.string(),
  whatsapp_channel: z.string(),
  nabd: optUrl,
});
export type SocialValues = z.infer<typeof socialSchema>;

export const mediaStorageSchema = z.object({
  remote_enabled: z.boolean(),
  remote_driver: z.string(),
  remote_key: z.string(),
  remote_secret: z.string(),
  remote_bucket: z.string(),
  remote_region: z.string(),
  remote_endpoint: optUrl,
  remote_url: optUrl,
  remote_use_path_style: z.boolean(),
});
export type MediaStorageValues = z.infer<typeof mediaStorageSchema>;

export const analyticsSchema = z.object({
  google_meta_tag: z.string(),
  google_analytics: z.string(),
  facebook_pixel: z.string(),
  facebook_page_id: z.string(),
  tiktok_pixel: z.string(),
  instagram_pixel: z.string(),
  other_meta: z.string(),
});
export type AnalyticsValues = z.infer<typeof analyticsSchema>;
