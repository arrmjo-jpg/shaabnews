<?php

declare(strict_types=1);

use App\Models\User;
use App\Settings\ThirdPartySettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function enableRecaptcha(string $version = 'v3', float $score = 0.5): void
{
    $s = app(ThirdPartySettings::class);
    $s->recaptcha_enabled = true;
    $s->recaptcha_version = $version;
    $s->recaptcha_site_key = 'site-key-public';
    $s->recaptcha_secret_key = 'secret-key';
    $s->recaptcha_score = $score;
    $s->save();
}

function fakeSiteverify(array $body): void
{
    Http::fake(['www.google.com/recaptcha/*' => Http::response($body, 200)]);
}

// ─── Public config endpoint (no auth, no secrets) ──────────────────────

it('exposes public recaptcha config without secrets and without auth', function (): void {
    enableRecaptcha('v3', 0.6);

    $response = $this->getJson('/api/v1/recaptcha/config');

    $response->assertOk();
    assertSuccessContract($response);
    $response->assertJsonPath('data.enabled', true);
    $response->assertJsonPath('data.version', 'v3');
    $response->assertJsonPath('data.site_key', 'site-key-public');

    $raw = $response->getContent();
    expect($raw)->not->toContain('secret-key');
    expect($response->json('data'))->not->toHaveKey('secret_key');
});

// ─── Gating ────────────────────────────────────────────────────────────

it('passes through when recaptcha is disabled (no token required)', function (): void {
    User::factory()->create(['email' => 'a@a.test', 'password' => Hash::make('password123')]);

    // معطّلة افتراضياً — لا token مطلوب
    $this->postJson('/api/v1/auth/login', [
        'email' => 'a@a.test', 'password' => 'password123',
    ])->assertOk();
});

// ─── Enforcement: public login ─────────────────────────────────────────

it('rejects login when recaptcha enabled and token missing', function (): void {
    enableRecaptcha();
    User::factory()->create(['email' => 'a@a.test', 'password' => Hash::make('password123')]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'a@a.test', 'password' => 'password123',
    ])->assertStatus(422);
});

it('accepts login with a valid v3 token (score + action ok)', function (): void {
    enableRecaptcha('v3', 0.5);
    fakeSiteverify(['success' => true, 'score' => 0.9, 'action' => 'login']);
    User::factory()->create(['email' => 'a@a.test', 'password' => Hash::make('password123')]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'a@a.test', 'password' => 'password123', 'recaptcha_token' => 'tok',
    ])->assertOk();
});

it('rejects when google verification fails', function (): void {
    enableRecaptcha();
    fakeSiteverify(['success' => false]);
    User::factory()->create(['email' => 'a@a.test', 'password' => Hash::make('password123')]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'a@a.test', 'password' => 'password123', 'recaptcha_token' => 'tok',
    ])->assertStatus(422);
});

it('rejects v3 when score below threshold', function (): void {
    enableRecaptcha('v3', 0.7);
    fakeSiteverify(['success' => true, 'score' => 0.2, 'action' => 'login']);
    User::factory()->create(['email' => 'a@a.test', 'password' => Hash::make('password123')]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'a@a.test', 'password' => 'password123', 'recaptcha_token' => 'tok',
    ])->assertStatus(422);
});

it('rejects v3 when action mismatches', function (): void {
    enableRecaptcha('v3', 0.5);
    fakeSiteverify(['success' => true, 'score' => 0.9, 'action' => 'something_else']);
    User::factory()->create(['email' => 'a@a.test', 'password' => Hash::make('password123')]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'a@a.test', 'password' => 'password123', 'recaptcha_token' => 'tok',
    ])->assertStatus(422);
});

it('accepts v2 with success only (no score/action check)', function (): void {
    enableRecaptcha('v2');
    fakeSiteverify(['success' => true]);
    User::factory()->create(['email' => 'a@a.test', 'password' => Hash::make('password123')]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'a@a.test', 'password' => 'password123', 'recaptcha_token' => 'tok',
    ])->assertOk();
});

// ─── Enforcement: admin login ──────────────────────────────────────────

it('protects admin login with recaptcha', function (): void {
    enableRecaptcha('v3', 0.5);
    $admin = User::factory()->create(['email' => 'admin@a.test', 'password' => Hash::make('password123')]);
    $admin->assignRole('super_admin');

    // بلا token → مرفوض
    $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'admin@a.test', 'password' => 'password123',
    ])->assertStatus(422);

    // بـ token صحيح + action مطابق → ينجح
    fakeSiteverify(['success' => true, 'score' => 0.9, 'action' => 'admin_login']);
    $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'admin@a.test', 'password' => 'password123', 'recaptcha_token' => 'tok',
    ])->assertOk();
});

// ─── Enforcement: mobile login (معفى عمداً من reCAPTCHA) ───────────────

it('exempts mobile login from recaptcha even when enabled', function (): void {
    enableRecaptcha('v3', 0.5);
    $admin = User::factory()->create(['email' => 'admin@a.test', 'password' => Hash::make('password123')]);
    $admin->assignRole('super_admin');

    // بلا recaptcha_token إطلاقًا → ينجح رغم أن الحماية مفعّلة
    $this->postJson('/api/v1/admin/auth/mobile-login', [
        'email' => 'admin@a.test', 'password' => 'password123',
    ])->assertOk();
});

it('keeps web admin login enforcing recaptcha independently of the mobile exemption', function (): void {
    enableRecaptcha('v3', 0.5);
    $admin = User::factory()->create(['email' => 'admin@a.test', 'password' => Hash::make('password123')]);
    $admin->assignRole('super_admin');

    // مسار الويب /login لا يتأثر بوجود /mobile-login — يبقى يرفض بلا token
    $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'admin@a.test', 'password' => 'password123',
    ])->assertStatus(422);
});
