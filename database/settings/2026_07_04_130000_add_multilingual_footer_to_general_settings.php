<?php

declare(strict_types=1);

use Spatie\LaravelSettings\Migrations\SettingsMigration;
use Spatie\LaravelSettings\Models\SettingsProperty;

return new class extends SettingsMigration
{
    public function up(): void
    {
        // النسخة العربية تُبذَر من القيمة الأحاديّة القائمة (حفظ المحتوى الحاليّ)، والإنجليزيّة فارغة.
        // الحقل الأحاديّ (copyright_text/cookie_policy_text) يبقى كما هو للتوافق الخلفيّ ويُزامَن من _ar عند الحفظ.
        $this->migrator->add('general.copyright_text_ar', $this->existing('general.copyright_text'));
        $this->migrator->add('general.copyright_text_en', '');
        $this->migrator->add('general.cookie_policy_text_ar', $this->existing('general.cookie_policy_text'));
        $this->migrator->add('general.cookie_policy_text_en', '');
    }

    public function down(): void
    {
        $this->migrator->deleteIfExists('general.copyright_text_ar');
        $this->migrator->deleteIfExists('general.copyright_text_en');
        $this->migrator->deleteIfExists('general.cookie_policy_text_ar');
        $this->migrator->deleteIfExists('general.cookie_policy_text_en');
    }

    /** القيمة الأحاديّة الحاليّة نصًّا، أو '' إن غابت (لا يوجد get عامّ في المُهاجِر). */
    private function existing(string $property): string
    {
        if (! $this->migrator->exists($property)) {
            return '';
        }

        $value = SettingsProperty::get($property);

        return is_string($value) ? $value : '';
    }
};
