<?php

declare(strict_types=1);

use App\Enums\UserStatus;
use App\Models\MediaAsset;
use App\Models\User;
use App\Settings\GeneralSettings;
use App\Settings\ThirdPartySettings;
use App\Support\Cache\CacheKeys;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    Storage::fake('public');
    Storage::fake('local');
});

function mediaAdminToken(): array
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return [$admin, $admin->createToken('admin-token', ['admin'])->plainTextToken];
}

function validServiceAccountJson(): string
{
    return json_encode([
        'type' => 'service_account',
        'project_id' => 'alpha-fb-001',
        'private_key' => '-----BEGIN PRIVATE KEY-----x-----END PRIVATE KEY-----',
        'client_email' => 'sa@alpha-fb-001.iam.gserviceaccount.com',
    ], JSON_THROW_ON_ERROR);
}

// ─── Branding ──────────────────────────────────────────────────────────

it('uploads branding successfully and creates a media asset', function (): void {
    [, $token] = mediaAdminToken();

    $response = $this->withToken($token)->post('/api/v1/admin/settings/media/branding', [
        'logo_light' => UploadedFile::fake()->image('logo.png'),
    ], ['Accept' => 'application/json']);

    $response->assertOk();
    assertSuccessContract($response);
    $response->assertJsonStructure(['data' => [['id', 'visibility', 'url', 'mime_type']]]);

    $asset = MediaAsset::first();
    expect($asset->visibility->value)->toBe('public');
    Storage::disk('public')->assertExists($asset->path);
    expect(app(GeneralSettings::class)->logo_light)->toBe($asset->path);
});

it('uploads sports logo branding and persists it in general settings', function (): void {
    [, $token] = mediaAdminToken();

    $response = $this->withToken($token)->post('/api/v1/admin/settings/media/branding', [
        'logo_light_sports' => UploadedFile::fake()->image('sports-light.png'),
        'logo_dark_sports' => UploadedFile::fake()->image('sports-dark.png'),
    ], ['Accept' => 'application/json']);

    $response->assertOk();
    assertSuccessContract($response);

    $lightAsset = MediaAsset::where('metadata->field', 'logo_light_sports')->first();
    $darkAsset = MediaAsset::where('metadata->field', 'logo_dark_sports')->first();

    expect($lightAsset)->not->toBeNull();
    expect($darkAsset)->not->toBeNull();
    Storage::disk('public')->assertExists($lightAsset->path);
    Storage::disk('public')->assertExists($darkAsset->path);
    expect(app(GeneralSettings::class)->logo_light_sports)->toBe($lightAsset->path);
    expect(app(GeneralSettings::class)->logo_dark_sports)->toBe($darkAsset->path);
});

it('rejects invalid branding payload', function (): void {
    [, $token] = mediaAdminToken();

    $response = $this->withToken($token)->post('/api/v1/admin/settings/media/branding', [
        'logo_light' => UploadedFile::fake()->create('virus.txt', 10, 'text/plain'),
    ], ['Accept' => 'application/json']);

    $response->assertStatus(422);
    assertErrorContract($response);
});

it('replacing branding deletes the old asset', function (): void {
    [, $token] = mediaAdminToken();

    $first = $this->withToken($token)->post('/api/v1/admin/settings/media/branding', [
        'logo_light' => UploadedFile::fake()->image('logo1.png'),
    ], ['Accept' => 'application/json'])->assertOk();

    $oldAsset = MediaAsset::first();
    $oldPath = $oldAsset->path;

    $this->withToken($token)->post('/api/v1/admin/settings/media/branding', [
        'logo_light' => UploadedFile::fake()->image('logo2.png'),
    ], ['Accept' => 'application/json'])->assertOk();

    Storage::disk('public')->assertMissing($oldPath);
    expect(MediaAsset::where('uuid', $oldAsset->uuid)->exists())->toBeFalse();
    expect(MediaAsset::where('metadata->field', 'logo_light')->count())->toBe(1);
});

// ─── Firebase ──────────────────────────────────────────────────────────

it('uploads valid firebase credentials privately', function (): void {
    [, $token] = mediaAdminToken();

    $file = UploadedFile::fake()->createWithContent('sa.json', validServiceAccountJson());

    $response = $this->withToken($token)->post('/api/v1/admin/settings/media/firebase', [
        'service_account' => $file,
    ], ['Accept' => 'application/json']);

    $response->assertOk();
    $response->assertJsonPath('data.visibility', 'private');
    $response->assertJsonPath('data.url', null);

    Storage::disk('local')->assertExists('private/firebase/service-account.json');
    Storage::disk('public')->assertMissing('private/firebase/service-account.json');
    expect(app(ThirdPartySettings::class)->firebase_project_id)->toBe('alpha-fb-001');
});

it('rejects non-json firebase content', function (): void {
    [, $token] = mediaAdminToken();

    $file = UploadedFile::fake()->createWithContent('bad.json', 'not-json-at-all');

    $this->withToken($token)->post('/api/v1/admin/settings/media/firebase', [
        'service_account' => $file,
    ], ['Accept' => 'application/json'])->assertStatus(422);
});

it('rejects firebase json missing required keys', function (): void {
    [, $token] = mediaAdminToken();

    $file = UploadedFile::fake()->createWithContent('partial.json', json_encode([
        'type' => 'service_account', 'project_id' => 'x',
    ]));

    $this->withToken($token)->post('/api/v1/admin/settings/media/firebase', [
        'service_account' => $file,
    ], ['Accept' => 'application/json'])->assertStatus(422);
});

it('keeps firebase storage private and never public', function (): void {
    [, $token] = mediaAdminToken();
    $file = UploadedFile::fake()->createWithContent('sa.json', validServiceAccountJson());

    $this->withToken($token)->post('/api/v1/admin/settings/media/firebase', [
        'service_account' => $file,
    ], ['Accept' => 'application/json'])->assertOk();

    $asset = MediaAsset::where('metadata->collection', 'firebase')->first();
    expect($asset->disk)->toBe('local');
    expect($asset->url())->toBeNull();
});

// ─── Delete ────────────────────────────────────────────────────────────

it('deletes a media asset successfully', function (): void {
    [, $token] = mediaAdminToken();

    $upload = $this->withToken($token)->post('/api/v1/admin/settings/media/branding', [
        'logo_light' => UploadedFile::fake()->image('logo.png'),
    ], ['Accept' => 'application/json'])->assertOk();

    $id = $upload->json('data.0.id');
    $asset = MediaAsset::where('uuid', $id)->first();

    $this->withToken($token)->deleteJson("/api/v1/admin/settings/media/{$id}")
        ->assertOk();

    Storage::disk('public')->assertMissing($asset->path);
    expect(MediaAsset::where('uuid', $id)->exists())->toBeFalse();
    expect(app(GeneralSettings::class)->logo_light)->toBeNull();
});

// ─── Cache invalidation ────────────────────────────────────────────────

it('invalidates the general settings cache after branding upload', function (): void {
    [, $token] = mediaAdminToken();

    $this->withToken($token)->getJson('/api/v1/admin/settings/general')->assertOk();
    expect(Cache::tags(['settings'])->has(CacheKeys::settings('general')))->toBeTrue();

    $this->withToken($token)->post('/api/v1/admin/settings/media/branding', [
        'logo_light' => UploadedFile::fake()->image('logo.png'),
    ], ['Accept' => 'application/json'])->assertOk();

    expect(Cache::tags(['settings'])->has(CacheKeys::settings('general')))->toBeFalse();
});

// ─── Security ──────────────────────────────────────────────────────────

it('denies media upload without a token', function (): void {
    $this->postJson('/api/v1/admin/settings/media/branding', [])->assertStatus(401);
});

it('denies a public user-ability token', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $userToken = $admin->createToken('public-token', ['user'])->plainTextToken;

    $this->withToken($userToken)
        ->postJson('/api/v1/admin/settings/media/branding', [])
        ->assertStatus(403);
});

it('denies an admin lacking settings.edit', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('reviewer');
    $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/v1/admin/settings/media/branding', [])
        ->assertStatus(403);
});

it('denies an inactive admin', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;
    $admin->update(['status' => UserStatus::Suspended]);

    $this->withToken($token)
        ->postJson('/api/v1/admin/settings/media/branding', [])
        ->assertStatus(403);
});
