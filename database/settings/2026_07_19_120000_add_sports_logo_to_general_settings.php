<?php

declare(strict_types=1);

use Spatie\LaravelSettings\Migrations\SettingsMigration;

return new class extends SettingsMigration
{
    public function up(): void
    {
        // شعار قسم الرياضة (فاتح/داكن) — مسارات ملفات مرفوعة، فارغة حتى يرفعها الأدمن.
        $this->migrator->add('general.logo_light_sports', null);
        $this->migrator->add('general.logo_dark_sports', null);
    }

    public function down(): void
    {
        $this->migrator->deleteIfExists('general.logo_light_sports');
        $this->migrator->deleteIfExists('general.logo_dark_sports');
    }
};
