<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Settings;

use App\Enums\WatermarkPosition;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class UpdateGeneralSettingsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Site
            'site_name' => ['sometimes', 'string', 'min:2', 'max:150'],
            'site_name_ar' => ['sometimes', 'string', 'min:2', 'max:150'],
            'site_name_en' => ['sometimes', 'nullable', 'string', 'max:150'],
            'site_email' => ['sometimes', 'email', 'max:255'],
            'site_url' => ['sometimes', 'nullable', 'url', 'max:255'],
            'timezone' => ['sometimes', 'timezone'],
            'site_phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'site_phones' => ['sometimes', 'array', 'max:20'],
            'site_phones.*' => ['array'],
            'site_phones.*.name' => ['nullable', 'string', 'max:100'],
            'site_phones.*.title' => ['nullable', 'string', 'max:100'],
            'site_phones.*.phone' => ['nullable', 'string', 'max:50'],
            'site_description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'site_description_ar' => ['sometimes', 'nullable', 'string', 'max:500'],
            'site_description_en' => ['sometimes', 'nullable', 'string', 'max:500'],
            'copyright_text' => ['sometimes', 'nullable', 'string', 'max:500'],
            'copyright_text_ar' => ['sometimes', 'nullable', 'string', 'max:500'],
            'copyright_text_en' => ['sometimes', 'nullable', 'string', 'max:500'],
            'footer_extra_text' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'cookie_policy_text' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'cookie_policy_text_ar' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'cookie_policy_text_en' => ['sometimes', 'nullable', 'string', 'max:5000'],

            // Watermark
            'watermark_enabled' => ['sometimes', 'boolean'],
            'watermark_position' => ['sometimes', Rule::enum(WatermarkPosition::class)],
            'watermark_opacity' => ['sometimes', 'integer', 'between:0,100'],
            'watermark_width' => ['sometimes', 'integer', 'min:1', 'max:2000'],
            'watermark_margin' => ['sometimes', 'integer', 'min:0', 'max:500'],

            // Features
            'comments_enabled' => ['sometimes', 'boolean'],
            'maintenance_mode' => ['sometimes', 'boolean'],

            // Location
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],

            // Mail
            'mail_mailer' => ['sometimes', 'string', 'in:smtp,sendmail,ses,postmark,log,array'],
            'mail_host' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mail_port' => ['sometimes', 'integer', 'between:1,65535'],
            'mail_encryption' => ['sometimes', 'nullable', 'string', 'in:tls,ssl,null'],
            'mail_from_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'mail_from_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'mail_username' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mail_password' => ['sometimes', 'nullable', 'string', 'max:255'],

            // Social
            'social_facebook' => ['sometimes', 'nullable', 'url', 'max:255'],
            'social_facebook_page_id' => ['sometimes', 'nullable', 'string', 'max:100'],
            'social_twitter_x' => ['sometimes', 'nullable', 'url', 'max:255'],
            'social_instagram' => ['sometimes', 'nullable', 'url', 'max:255'],
            'social_linkedin' => ['sometimes', 'nullable', 'url', 'max:255'],
            'social_youtube' => ['sometimes', 'nullable', 'url', 'max:255'],
            'social_tiktok' => ['sometimes', 'nullable', 'url', 'max:255'],
            'social_whatsapp' => ['sometimes', 'nullable', 'string', 'max:50'],
            'social_whatsapp_channel' => ['sometimes', 'nullable', 'string', 'max:255'],
            'social_nabd' => ['sometimes', 'nullable', 'url', 'max:255'],

            // Analytics
            'analytics_google_meta_tag' => ['sometimes', 'nullable', 'string', 'max:500'],
            'analytics_google_analytics' => ['sometimes', 'nullable', 'string', 'max:100'],
            'analytics_facebook_pixel' => ['sometimes', 'nullable', 'string', 'max:100'],
            'analytics_facebook_page_id' => ['sometimes', 'nullable', 'string', 'max:100'],
            'analytics_tiktok_pixel' => ['sometimes', 'nullable', 'string', 'max:100'],
            'analytics_instagram_pixel' => ['sometimes', 'nullable', 'string', 'max:100'],
            'analytics_other_meta' => ['sometimes', 'nullable', 'string', 'max:2000'],

            // Backup automation (settings only — operations are a separate module)
            'backup_auto_daily' => ['sometimes', 'boolean'],
            'backup_auto_weekly' => ['sometimes', 'boolean'],
            'backup_retention_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'backup_cleanup_old' => ['sometimes', 'boolean'],
        ];
    }
}
