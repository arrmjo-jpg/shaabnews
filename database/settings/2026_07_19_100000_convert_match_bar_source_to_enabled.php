<?php

declare(strict_types=1);

use Spatie\LaravelSettings\Migrations\SettingsMigration;

/**
 * تحويل شريط المباريات من وضع مصدر واحد حصريّ (source: disabled|featured_competitions|
 * regular_leagues) إلى مفتاح تفعيل/تعطيل بسيط (enabled: bool). أيّ قيمة سابقة غير
 * "disabled" ⇒ enabled=true — اختيار البطولات المعروضة صار حصريًّا عبر
 * Competition::show_in_match_bar (راجع BuildMatchBarAction).
 */
return new class extends SettingsMigration
{
    public function up(): void
    {
        $enabled = true;

        $this->migrator->update('match_bar.source', function (string $source) use (&$enabled): string {
            $enabled = $source !== 'disabled';

            return $source;
        });

        $this->migrator->add('match_bar.enabled', $enabled);
        $this->migrator->delete('match_bar.source');
    }
};
