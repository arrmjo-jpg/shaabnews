<?php

declare(strict_types=1);

use Spatie\LaravelSettings\Migrations\SettingsMigration;
use Spatie\LaravelSettings\Models\SettingsProperty;

return new class extends SettingsMigration
{
    public function up(): void
    {
        // قائمة الهواتف تُبذَر من الرقم الأحاديّ القائم (إن وُجد) كي لا يُفقَد رقم التواصل الحاليّ.
        $phone = $this->migrator->exists('general.site_phone')
            ? SettingsProperty::get('general.site_phone')
            : null;
        $seed = is_string($phone) && trim($phone) !== '' ? [trim($phone)] : [];

        $this->migrator->add('general.site_phones', $seed);
        $this->migrator->add('general.social_nabd', '');
    }

    public function down(): void
    {
        $this->migrator->deleteIfExists('general.site_phones');
        $this->migrator->deleteIfExists('general.social_nabd');
    }
};
