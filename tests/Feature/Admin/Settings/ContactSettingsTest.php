<?php

declare(strict_types=1);

use App\Models\User;
use App\Settings\GeneralSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function contactAdminToken(): string
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return $admin->createToken('admin-token', ['admin'])->plainTextToken;
}

it('exposes multi-phone and nabd properties on the settings model', function (): void {
    $settings = app(GeneralSettings::class);

    expect(property_exists($settings, 'site_phones'))->toBeTrue();
    expect(property_exists($settings, 'social_nabd'))->toBeTrue();
});

it('saves multiple contact phones (cleaned) and mirrors the first to site_phone', function (): void {
    $token = contactAdminToken();

    $this->withToken($token)->putJson('/api/v1/admin/settings/general', [
        'site_phones' => [
            ['name' => 'أحمد', 'title' => 'مدير التحرير', 'phone' => '+962 6 5000 100'],
            ['name' => '', 'title' => '', 'phone' => '   '],
            ['name' => 'سارة', 'title' => 'الإعلانات', 'phone' => '079 999 9999'],
        ],
    ])->assertOk();

    $response = $this->withToken($token)->getJson('/api/v1/admin/settings/general');
    $response->assertOk();
    // entry with a blank phone is dropped; order + name/title preserved
    $response->assertJsonPath('data.site.site_phones', [
        ['name' => 'أحمد', 'title' => 'مدير التحرير', 'phone' => '+962 6 5000 100'],
        ['name' => 'سارة', 'title' => 'الإعلانات', 'phone' => '079 999 9999'],
    ]);
    // first phone mirrors to the legacy single field (backward compatibility)
    $response->assertJsonPath('data.site.site_phone', '+962 6 5000 100');
});

it('saves the nabd social link and returns it via admin + public APIs', function (): void {
    $token = contactAdminToken();

    $this->withToken($token)->putJson('/api/v1/admin/settings/general', [
        'social_nabd' => 'https://nabd.com/alqalah-news',
    ])->assertOk();

    $this->withToken($token)->getJson('/api/v1/admin/settings/general')
        ->assertOk()
        ->assertJsonPath('data.social.nabd', 'https://nabd.com/alqalah-news');

    $this->getJson('/api/v1/site?locale=ar')
        ->assertOk()
        ->assertJsonPath('data.social.nabd', 'https://nabd.com/alqalah-news');
});

it('returns the phones array and primary phone from the public site API', function (): void {
    $settings = app(GeneralSettings::class);
    $settings->site_phones = [
        ['name' => 'أحمد', 'title' => 'مدير التحرير', 'phone' => '+962 6 5000 100'],
        ['name' => 'سارة', 'title' => 'الإعلانات', 'phone' => '079 999 9999'],
    ];
    $settings->site_phone = '+962 6 5000 100';
    $settings->save();

    $this->getJson('/api/v1/site?locale=ar')
        ->assertOk()
        ->assertJsonPath('data.phones', [
            ['name' => 'أحمد', 'title' => 'مدير التحرير', 'phone' => '+962 6 5000 100'],
            ['name' => 'سارة', 'title' => 'الإعلانات', 'phone' => '079 999 9999'],
        ])
        ->assertJsonPath('data.phone', '+962 6 5000 100');
});

it('normalizes legacy string phone entries to contact objects on read', function (): void {
    $settings = app(GeneralSettings::class);
    $settings->site_phones = ['0791234567']; // old flat-string shape
    $settings->save();

    $this->getJson('/api/v1/site?locale=ar')
        ->assertOk()
        ->assertJsonPath('data.phones', [['name' => '', 'title' => '', 'phone' => '0791234567']])
        ->assertJsonPath('data.phone', '0791234567');
});

it('rejects an invalid nabd url', function (): void {
    $token = contactAdminToken();

    $this->withToken($token)->putJson('/api/v1/admin/settings/general', [
        'social_nabd' => 'not-a-url',
    ])->assertStatus(422);
});
