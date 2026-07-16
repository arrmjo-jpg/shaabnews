<?php

declare(strict_types=1);

use Spatie\LaravelSettings\Migrations\SettingsMigration;

return new class extends SettingsMigration
{
    public function up(): void
    {
        $this->migrator->add('general.site_name_ar', 'القلعة نيوز');
        $this->migrator->add('general.site_name_en', '');
        $this->migrator->add('general.site_description_ar', '');
        $this->migrator->add('general.site_description_en', '');
    }
};
