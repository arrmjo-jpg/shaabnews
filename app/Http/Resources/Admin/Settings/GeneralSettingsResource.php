<?php

declare(strict_types=1);

namespace App\Http\Resources\Admin\Settings;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مورد الإعدادات العامة. الأسرار لا تُعاد كنص صريح —
 * تُقنَّع مع علم بوجودها عبر *_configured.
 */
class GeneralSettingsResource extends JsonResource
{
    private function masked(?string $value): ?string
    {
        return ($value === null || $value === '') ? null : '********';
    }

    private function isSet(?string $value): bool
    {
        return $value !== null && $value !== '';
    }

    public function toArray(Request $request): array
    {
        $s = $this->resource;

        return [
            'site' => [
                'site_name' => $s->site_name,
                'site_name_ar' => $s->site_name_ar,
                'site_name_en' => $s->site_name_en,
                'site_email' => $s->site_email,
                'site_url' => $s->site_url,
                'timezone' => $s->timezone,
                'site_phone' => $s->site_phone,
                'site_phones' => $s->site_phones,
                'site_description' => $s->site_description,
                'site_description_ar' => $s->site_description_ar,
                'site_description_en' => $s->site_description_en,
                'copyright_text' => $s->copyright_text,
                'copyright_text_ar' => $s->copyright_text_ar,
                'copyright_text_en' => $s->copyright_text_en,
                'footer_extra_text' => $s->footer_extra_text,
                'cookie_policy_text' => $s->cookie_policy_text,
                'cookie_policy_text_ar' => $s->cookie_policy_text_ar,
                'cookie_policy_text_en' => $s->cookie_policy_text_en,
                'logo_light' => $s->logo_light,
                'logo_dark' => $s->logo_dark,
                'logo_light_en' => $s->logo_light_en,
                'logo_dark_en' => $s->logo_dark_en,
                'favicon' => $s->favicon,
                'watermark_enabled' => $s->watermark_enabled,
                'watermark_image' => $s->watermark_image,
                'watermark_position' => $s->watermark_position,
                'watermark_opacity' => $s->watermark_opacity,
                'watermark_width' => $s->watermark_width,
                'watermark_margin' => $s->watermark_margin,
                'comments_enabled' => $s->comments_enabled,
                'maintenance_mode' => $s->maintenance_mode,
                'latitude' => $s->latitude,
                'longitude' => $s->longitude,
            ],
            'mail' => [
                'mail_mailer' => $s->mail_mailer,
                'mail_host' => $s->mail_host,
                'mail_port' => $s->mail_port,
                'mail_encryption' => $s->mail_encryption,
                'mail_from_name' => $s->mail_from_name,
                'mail_from_email' => $s->mail_from_email,
                'mail_username' => $s->mail_username,
                'mail_password' => $this->masked($s->mail_password),
                'mail_password_configured' => $this->isSet($s->mail_password),
            ],
            'social' => [
                'facebook' => $s->social_facebook,
                'facebook_page_id' => $s->social_facebook_page_id,
                'twitter_x' => $s->social_twitter_x,
                'instagram' => $s->social_instagram,
                'linkedin' => $s->social_linkedin,
                'youtube' => $s->social_youtube,
                'tiktok' => $s->social_tiktok,
                'whatsapp' => $s->social_whatsapp,
                'whatsapp_channel' => $s->social_whatsapp_channel,
                'nabd' => $s->social_nabd,
            ],
            'analytics' => [
                'google_meta_tag' => $s->analytics_google_meta_tag,
                'google_analytics' => $s->analytics_google_analytics,
                'facebook_pixel' => $s->analytics_facebook_pixel,
                'facebook_page_id' => $s->analytics_facebook_page_id,
                'tiktok_pixel' => $s->analytics_tiktok_pixel,
                'instagram_pixel' => $s->analytics_instagram_pixel,
                'other_meta' => $s->analytics_other_meta,
            ],
            'backups' => [
                'auto_backup_daily' => $s->backup_auto_daily,
                'auto_backup_weekly' => $s->backup_auto_weekly,
                'retention_days' => $s->backup_retention_days,
                'cleanup_old_backups' => $s->backup_cleanup_old,
            ],
        ];
    }
}
