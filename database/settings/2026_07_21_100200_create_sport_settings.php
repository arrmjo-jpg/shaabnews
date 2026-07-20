<?php

declare(strict_types=1);

use Spatie\LaravelSettings\Migrations\SettingsMigration;

/**
 * قيم افتراضية آمنة لمحرّك الرياضة — sport_prediction_enabled=false لأنّ الميزة لا وجود لها بعد
 * (§14)، الباقي مفعَّل بأمان (§13.7 حلّل بنية الإشعارات الفورية، لا علاقة لها بهذه الأعلام).
 */
return new class extends SettingsMigration
{
    public function up(): void
    {
        $this->migrator->add('sport.sport_primary_color', null);
        $this->migrator->add('sport.sport_secondary_color', null);
        $this->migrator->add('sport.sport_default_theme', 'dark');
        $this->migrator->add('sport.sport_allow_theme_switch', true);
        $this->migrator->add('sport.sport_theme_cookie', 'sport_theme');
        $this->migrator->add('sport.sport_default_sport', null);
        $this->migrator->add('sport.sport_default_country', null);
        $this->migrator->add('sport.sport_default_competition', null);
        $this->migrator->add('sport.sport_prediction_enabled', false);
        $this->migrator->add('sport.sport_search_enabled', true);
        $this->migrator->add('sport.sport_live_scores_enabled', true);
    }

    /**
     * لا تعريف down() في match_bar/general المعاصرة (نمط أحاديّ الاتجاه)، لكنّ تجربة تراجُع
     * فعليّة (rollback ثم إعادة migrate) هنا كشفت أنّ غيابه يترك صفوف settings يتيمة بعد
     * rollback (يُزال سجلّ التتبّع فقط، لا الصفوف) فيفشل up() لاحقاً بـ SettingAlreadyExists.
     * down() صريح هنا يمنع تكرار ذلك مستقبلاً لهذا الملف تحديداً.
     */
    public function down(): void
    {
        $this->migrator->delete('sport.sport_primary_color');
        $this->migrator->delete('sport.sport_secondary_color');
        $this->migrator->delete('sport.sport_default_theme');
        $this->migrator->delete('sport.sport_allow_theme_switch');
        $this->migrator->delete('sport.sport_theme_cookie');
        $this->migrator->delete('sport.sport_default_sport');
        $this->migrator->delete('sport.sport_default_country');
        $this->migrator->delete('sport.sport_default_competition');
        $this->migrator->delete('sport.sport_prediction_enabled');
        $this->migrator->delete('sport.sport_search_enabled');
        $this->migrator->delete('sport.sport_live_scores_enabled');
    }
};
