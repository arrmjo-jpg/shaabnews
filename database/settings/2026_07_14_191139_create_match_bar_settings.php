<?php

declare(strict_types=1);

use Spatie\LaravelSettings\Migrations\SettingsMigration;

/**
 * مصدر شريط المباريات — قيمة واحدة حصريّة (disabled | featured_competitions | regular_leagues)
 * تُقرَأ عبر MatchBarSource. لا يوجد وضع دمج بين البطولات المميَّزة والدوريّات — مُتعمَّد.
 */
return new class extends SettingsMigration
{
    public function up(): void
    {
        $this->migrator->add('match_bar.source', 'disabled');
    }
};
