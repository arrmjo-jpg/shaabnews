<?php

declare(strict_types=1);

use App\Settings\GeneralSettings;
use App\Settings\SportSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('exposes sport theme fields and sport logos on the public site endpoint', function (): void {
    $sport = app(SportSettings::class);
    $sport->sport_primary_color = '#151e22';
    $sport->sport_secondary_color = '#e11d48';
    $sport->sport_default_theme = 'dark';
    $sport->sport_allow_theme_switch = true;
    $sport->sport_theme_cookie = 'sport_theme';
    $sport->save();

    $general = app(GeneralSettings::class);
    $general->logo_light_sports = 'branding/logos/sport-light.png';
    $general->logo_dark_sports = 'branding/logos/sport-dark.png';
    $general->save();

    $res = $this->getJson('/api/v1/site?locale=ar')->assertOk();

    $res->assertJsonPath('data.sport.primary_color', '#151e22');
    $res->assertJsonPath('data.sport.secondary_color', '#e11d48');
    $res->assertJsonPath('data.sport.default_theme', 'dark');
    $res->assertJsonPath('data.sport.allow_theme_switch', true);
    $res->assertJsonPath('data.sport.theme_cookie', 'sport_theme');
    expect($res->json('data.sport.logo_light'))->toContain('sport-light.png');
    expect($res->json('data.sport.logo_dark'))->toContain('sport-dark.png');
});

it('returns null sport logos and colors when unset, without breaking the response', function (): void {
    $res = $this->getJson('/api/v1/site?locale=ar')->assertOk();

    $res->assertJsonPath('data.sport.primary_color', null);
    $res->assertJsonPath('data.sport.secondary_color', null);
    $res->assertJsonPath('data.sport.logo_light', null);
    $res->assertJsonPath('data.sport.logo_dark', null);
});

it('respects sport_allow_theme_switch=false', function (): void {
    app(SportSettings::class)->sport_allow_theme_switch = false;
    app(SportSettings::class)->save();

    $res = $this->getJson('/api/v1/site?locale=ar')->assertOk();
    $res->assertJsonPath('data.sport.allow_theme_switch', false);
});

it('locks the sport object to exactly its documented 7 keys — any expansion must be intentional and update this test', function (): void {
    $res = $this->getJson('/api/v1/site?locale=ar')->assertOk();

    expect(array_keys($res->json('data.sport')))->toBe([
        'primary_color', 'secondary_color', 'default_theme',
        'allow_theme_switch', 'theme_cookie', 'logo_light', 'logo_dark',
    ]);
});

it('does not expose sport feature flags or defaults — not needed by Header/Footer, out of scope for Phase 2.1', function (): void {
    $res = $this->getJson('/api/v1/site?locale=ar')->assertOk();

    $sport = $res->json('data.sport');
    expect($sport)->not->toHaveKey('prediction_enabled');
    expect($sport)->not->toHaveKey('search_enabled');
    expect($sport)->not->toHaveKey('live_scores_enabled');
    expect($sport)->not->toHaveKey('default_sport');
    expect($sport)->not->toHaveKey('default_country');
    expect($sport)->not->toHaveKey('default_competition');
});

it('keeps every pre-existing top-level field unchanged — additive only', function (): void {
    $res = $this->getJson('/api/v1/site?locale=ar')->assertOk();

    $res->assertJsonStructure([
        'data' => [
            'site_name', 'description', 'copyright', 'cookie_policy',
            'phone', 'phones', 'email', 'latitude', 'longitude',
            'logo_light', 'logo_dark', 'favicon', 'social',
            'nav_categories', 'newspaper_enabled', 'sport',
        ],
    ]);
});
