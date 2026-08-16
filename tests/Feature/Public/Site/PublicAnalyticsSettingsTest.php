<?php

declare(strict_types=1);

use App\Models\User;
use App\Settings\GeneralSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

it('forwards saved analytics/verification ids from the admin panel to the public site API', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

    $this->withToken($token)->putJson('/api/v1/admin/settings/general', [
        'analytics_google_analytics' => 'G-ABC123',
        'analytics_facebook_pixel' => '1234567890',
        'analytics_tiktok_pixel' => 'TT-XYZ',
        'analytics_google_meta_tag' => 'google-site-verification=abc',
    ])->assertOk();

    $this->getJson('/api/v1/site?locale=ar')
        ->assertOk()
        ->assertJsonPath('data.analytics.google_analytics_id', 'G-ABC123')
        ->assertJsonPath('data.analytics.meta_pixel_id', '1234567890')
        ->assertJsonPath('data.analytics.tiktok_pixel_id', 'TT-XYZ')
        ->assertJsonPath('data.verification.google', 'google-site-verification=abc');
});

it('extracts name/content pairs from raw meta tags pasted into the "extra meta tags" field', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

    $this->withToken($token)->putJson('/api/v1/admin/settings/general', [
        'analytics_other_meta' => '<meta name="google-adsense-account" content="ca-pub-4713226751106731">'
            ."\n"
            .'<meta content="abc123" name="another-verification">',
    ])->assertOk();

    $this->getJson('/api/v1/site?locale=ar')
        ->assertOk()
        ->assertJsonPath('data.verification.other.google-adsense-account', 'ca-pub-4713226751106731')
        ->assertJsonPath('data.verification.other.another-verification', 'abc123');
});

it('returns empty objects (not null/missing keys) for analytics/verification when unset', function (): void {
    $settings = app(GeneralSettings::class);
    $settings->analytics_google_analytics = '';
    $settings->analytics_facebook_pixel = '';
    $settings->analytics_tiktok_pixel = '';
    $settings->analytics_google_meta_tag = '';
    $settings->save();

    $response = $this->getJson('/api/v1/site?locale=ar')->assertOk();
    $response->assertJsonPath('data.analytics', []);
    $response->assertJsonPath('data.verification', []);
});
