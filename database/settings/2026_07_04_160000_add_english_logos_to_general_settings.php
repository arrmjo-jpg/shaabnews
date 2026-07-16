<?php

declare(strict_types=1);

use Spatie\LaravelSettings\Migrations\SettingsMigration;

return new class extends SettingsMigration
{
    public function up(): void
    {
        // شعار الموقع بالإنجليزيّة (فاتح/داكن) — مسارات ملفات مرفوعة، فارغة حتى يرفعها الأدمن.
        $this->migrator->add('general.logo_light_en', null);
        $this->migrator->add('general.logo_dark_en', null);
    }

    public function down(): void
    {
        $this->migrator->deleteIfExists('general.logo_light_en');
        $this->migrator->deleteIfExists('general.logo_dark_en');
    }
};
