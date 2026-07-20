<?php

declare(strict_types=1);

namespace App\Settings;

use Spatie\LaravelSettings\Settings;

/**
 * إعدادات محرّك الرياضة (Sports Engine — Approved Architecture Baseline v1.0, §17).
 *
 * ما لا يوجد هنا عن قصد (قرارات سابقة موثَّقة في §16/§0):
 * - sport_name / sport_slug: يملكها تصنيف "الرياضة" الجذر في CMS، لا إعداد منفصل يكرّرها.
 * - أيّ حقل شعار (sport_logo_*): يُعاد استخدام GeneralSettings::logo_light_sports/logo_dark_sports
 *   الموجودَين أصلاً (غير مستخدَمين اليوم) — بلا حقول جديدة.
 * - sport_header_background: قيمة تصميم ثابتة #151e22، ليست إعدادًا قابلاً للتعديل مطلقًا.
 * - sport_content_menu: استُبدل بالكامل بكيان SportMenuItem (جدول sport_menu_items)، فقائمة لا إعداد.
 */
class SportSettings extends Settings
{
    public ?string $sport_primary_color;

    public ?string $sport_secondary_color;

    public string $sport_default_theme;

    public bool $sport_allow_theme_switch;

    public string $sport_theme_cookie;

    public ?string $sport_default_sport;

    public ?string $sport_default_country;

    public ?string $sport_default_competition;

    public bool $sport_prediction_enabled;

    public bool $sport_search_enabled;

    public bool $sport_live_scores_enabled;

    public static function group(): string
    {
        return 'sport';
    }
}
