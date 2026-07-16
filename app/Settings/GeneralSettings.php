<?php

declare(strict_types=1);

namespace App\Settings;

use Spatie\LaravelSettings\Settings;

/**
 * إعدادات عامة: معلومات الموقع، البريد، الروابط الاجتماعية،
 * التتبع والتحليلات، أتمتة النسخ الاحتياطي.
 * أسماء الحقول مُنمَّطة بسوابق لتفادي التضارب داخل المجموعة.
 */
class GeneralSettings extends Settings
{
    // ─── Tab 1: معلومات الموقع ──────────────────────────────────────
    public string $site_name;

    public ?string $institutional_email_domain;

    public string $site_name_ar;

    public string $site_name_en;

    public string $site_email;

    public string $site_url;

    public string $timezone;

    public string $site_phone;

    /** جهات اتصال هاتفيّة: قائمة من {name, title, phone}. الرقم الأوّل يُزامَن مع site_phone (توافق خلفيّ). */
    public array $site_phones;

    /** وصف الموقع — يُستخدم في SEO للواجهة العامّة (meta/og description الافتراضيّ). */
    public string $site_description;

    public string $site_description_ar;

    public string $site_description_en;

    public string $copyright_text;

    public string $copyright_text_ar;

    public string $copyright_text_en;

    public string $footer_extra_text;

    public string $cookie_policy_text;

    public string $cookie_policy_text_ar;

    public string $cookie_policy_text_en;

    // العلامة (مسارات ملفات مرفوعة)
    public ?string $logo_light;

    public ?string $logo_dark;

    // شعار الموقع بالإنجليزيّة (فاتح/داكن) — يُستخدَم على واجهة اللغة الإنجليزيّة؛ يرجع للعربيّ عند غيابه.
    public ?string $logo_light_en;

    public ?string $logo_dark_en;

    public ?string $favicon;

    // العلامة المائية
    public bool $watermark_enabled;

    public ?string $watermark_image;

    public string $watermark_position;

    public int $watermark_opacity;

    public int $watermark_width;

    public int $watermark_margin;

    // الميزات
    public bool $comments_enabled;

    public bool $maintenance_mode;

    // الموقع الجغرافي
    public ?string $latitude;

    public ?string $longitude;

    // ─── Tab 2: خادم البريد ─────────────────────────────────────────
    public string $mail_mailer;

    public string $mail_host;

    public int $mail_port;

    public string $mail_encryption;

    public string $mail_from_name;

    public string $mail_from_email;

    public string $mail_username;

    public string $mail_password;

    // ─── Tab 3: روابط التواصل ───────────────────────────────────────
    public string $social_facebook;

    public string $social_facebook_page_id;

    public string $social_twitter_x;

    public string $social_instagram;

    public string $social_linkedin;

    public string $social_youtube;

    public string $social_tiktok;

    public string $social_whatsapp;

    public string $social_whatsapp_channel;

    // نبض — مُجمِّع الأخبار العربيّ (رابط قناة/صفحة الموقع على نبض).
    public string $social_nabd;

    // ─── Tab 4: التتبع والتحليلات ───────────────────────────────────
    public string $analytics_google_meta_tag;

    public string $analytics_google_analytics;

    public string $analytics_facebook_pixel;

    public string $analytics_facebook_page_id;

    public string $analytics_tiktok_pixel;

    public string $analytics_instagram_pixel;

    public string $analytics_other_meta;

    // ─── Tab 5: أتمتة النسخ الاحتياطي ──────────────────────────────
    public bool $backup_auto_daily;

    public bool $backup_auto_weekly;

    public int $backup_retention_days;

    public bool $backup_cleanup_old;

    public function getLocalizedName(?string $locale = null): string
    {
        $locale ??= app()->getLocale();

        if ($locale === 'en') {
            $name = trim($this->site_name_en ?? '');
            if ($name !== '') {
                return $name;
            }
        }

        $name = trim($this->site_name_ar ?? '');
        if ($name !== '') {
            return $name;
        }

        $name = trim($this->site_name ?? '');
        if ($name !== '') {
            return $name;
        }

        return (string) config('app.name', 'AlphaCMS');
    }

    public function getLocalizedDescription(?string $locale = null): string
    {
        $locale ??= app()->getLocale();

        if ($locale === 'en') {
            $desc = trim($this->site_description_en ?? '');
            if ($desc !== '') {
                return $desc;
            }
        }

        $desc = trim($this->site_description_ar ?? '');
        if ($desc !== '') {
            return $desc;
        }

        $desc = trim($this->site_description ?? '');
        if ($desc !== '') {
            return $desc;
        }

        return (string) config('app.name', 'AlphaCMS');
    }

    public function getLocalizedCopyright(?string $locale = null): string
    {
        $locale ??= app()->getLocale();

        if ($locale === 'en') {
            $text = trim($this->copyright_text_en ?? '');
            if ($text !== '') {
                return $text;
            }
        }

        $text = trim($this->copyright_text_ar ?? '');
        if ($text !== '') {
            return $text;
        }

        return trim($this->copyright_text ?? '');
    }

    public function getLocalizedCookiePolicy(?string $locale = null): string
    {
        $locale ??= app()->getLocale();

        if ($locale === 'en') {
            $text = trim($this->cookie_policy_text_en ?? '');
            if ($text !== '') {
                return $text;
            }
        }

        $text = trim($this->cookie_policy_text_ar ?? '');
        if ($text !== '') {
            return $text;
        }

        return trim($this->cookie_policy_text ?? '');
    }

    public function getLocalizedLogoLight(?string $locale = null): ?string
    {
        $locale ??= app()->getLocale();

        if ($locale === 'en' && ($this->logo_light_en ?? '') !== '') {
            return $this->logo_light_en;
        }

        return $this->logo_light;
    }

    public function getLocalizedLogoDark(?string $locale = null): ?string
    {
        $locale ??= app()->getLocale();

        if ($locale === 'en' && ($this->logo_dark_en ?? '') !== '') {
            return $this->logo_dark_en;
        }

        return $this->logo_dark;
    }

    public static function group(): string
    {
        return 'general';
    }

    public static function encrypted(): array
    {
        return ['mail_password'];
    }
}
