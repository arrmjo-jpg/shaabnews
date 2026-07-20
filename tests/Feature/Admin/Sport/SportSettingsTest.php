<?php

declare(strict_types=1);

use App\Settings\SportSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('boots with the exact safe defaults from the settings migration', function (): void {
    $settings = app(SportSettings::class);

    expect($settings->sport_primary_color)->toBeNull();
    expect($settings->sport_secondary_color)->toBeNull();
    expect($settings->sport_default_theme)->toBe('dark');
    expect($settings->sport_allow_theme_switch)->toBeTrue();
    expect($settings->sport_theme_cookie)->toBe('sport_theme');
    expect($settings->sport_default_sport)->toBeNull();
    expect($settings->sport_default_country)->toBeNull();
    expect($settings->sport_default_competition)->toBeNull();
    expect($settings->sport_prediction_enabled)->toBeFalse(); // الميزة لا وجود لها بعد
    expect($settings->sport_search_enabled)->toBeTrue();
    expect($settings->sport_live_scores_enabled)->toBeTrue();
});
