<?php

declare(strict_types=1);

use App\Models\User;
use App\Settings\SportSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function sportSettingsAdminToken(): array
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return [$u, $u->createToken('admin-token', ['admin'])->plainTextToken];
}

it('shows all 11 sport settings fields for an authorized admin', function (): void {
    [, $token] = sportSettingsAdminToken();

    $res = $this->withToken($token)->getJson('/api/v1/admin/settings/sport')->assertOk();
    assertSuccessContract($res);
    $res->assertJsonStructure(['data' => [
        'sport_primary_color', 'sport_secondary_color', 'sport_default_theme',
        'sport_allow_theme_switch', 'sport_theme_cookie', 'sport_default_sport',
        'sport_default_country', 'sport_default_competition', 'sport_prediction_enabled',
        'sport_search_enabled', 'sport_live_scores_enabled',
    ]]);
    expect($res->json('data.sport_default_theme'))->toBe('dark');
});

it('updates a subset of fields and leaves the rest untouched', function (): void {
    [, $token] = sportSettingsAdminToken();

    $this->withToken($token)
        ->putJson('/api/v1/admin/settings/sport', ['sport_default_theme' => 'light', 'sport_primary_color' => '#123456'])
        ->assertOk();

    $settings = app(SportSettings::class);
    expect($settings->sport_default_theme)->toBe('light');
    expect($settings->sport_primary_color)->toBe('#123456');
    expect($settings->sport_search_enabled)->toBeTrue(); // لم يُرسَل — يبقى على الافتراضي
});

it('rejects an invalid sport_default_theme value', function (): void {
    [, $token] = sportSettingsAdminToken();

    $this->withToken($token)
        ->putJson('/api/v1/admin/settings/sport', ['sport_default_theme' => 'purple'])
        ->assertStatus(422);
});

it('denies write access to a role without settings.edit', function (): void {
    $u = User::factory()->create();
    $u->assignRole('reviewer');
    $token = $u->createToken('t', ['admin'])->plainTextToken;

    $this->withToken($token)
        ->putJson('/api/v1/admin/settings/sport', ['sport_search_enabled' => false])
        ->assertStatus(403);
});
