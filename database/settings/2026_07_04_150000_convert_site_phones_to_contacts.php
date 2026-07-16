<?php

declare(strict_types=1);

use Spatie\LaravelSettings\Migrations\SettingsMigration;

return new class extends SettingsMigration
{
    // نحوّل site_phones من قائمة نصوص (أرقام فقط) إلى قائمة كائنات {name, title, phone}.
    // العناصر الموجودة (نصّ أو كائن) تُطبَّع؛ الرقم يُحفَظ داخل phone بلا فقدان.
    public function up(): void
    {
        $this->migrator->update('general.site_phones', function ($phones): array {
            if (! is_array($phones)) {
                return [];
            }

            return array_values(array_map(static function ($p): array {
                $p = is_array($p) ? $p : ['phone' => $p];

                return [
                    'name' => (string) ($p['name'] ?? ''),
                    'title' => (string) ($p['title'] ?? ''),
                    'phone' => trim((string) ($p['phone'] ?? '')),
                ];
            }, $phones));
        });
    }

    // العودة: نستخرج الأرقام فقط كنصوص.
    public function down(): void
    {
        $this->migrator->update('general.site_phones', function ($phones): array {
            if (! is_array($phones)) {
                return [];
            }

            return array_values(array_filter(array_map(
                static fn ($p): string => is_array($p) ? trim((string) ($p['phone'] ?? '')) : trim((string) $p),
                $phones
            ), static fn (string $s): bool => $s !== ''));
        });
    }
};
