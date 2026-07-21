<?php

declare(strict_types=1);

use App\Models\Competition;
use App\Models\User;
use App\Settings\MatchBarSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function matchBarAdminToken(): array
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return [$u, $u->createToken('admin-token', ['admin'])->plainTextToken];
}

it('shows the enabled boolean and eligible count contract for an authorized admin', function (): void {
    [, $token] = matchBarAdminToken();

    $res = $this->withToken($token)->getJson('/api/v1/admin/settings/match-bar')->assertOk();
    assertSuccessContract($res);
    $res->assertJsonStructure(['data' => ['enabled', 'eligible_competitions_count']]);
    expect($res->json('data.enabled'))->toBeFalse(); // القيمة الافتراضيّة من settings migration
});

it('updates the enabled flag via the new boolean payload and rejects the old source payload', function (): void {
    [, $token] = matchBarAdminToken();

    $this->withToken($token)
        ->putJson('/api/v1/admin/settings/match-bar', ['enabled' => true])
        ->assertOk();

    expect(app(MatchBarSettings::class)->enabled)->toBeTrue();

    // العقد القديم (source) لم يعد صالحًا — يجب أن يُرفَض بخطأ تحقّق.
    $this->withToken($token)
        ->putJson('/api/v1/admin/settings/match-bar', ['source' => 'regular_leagues'])
        ->assertStatus(422);
});

it('computes eligible_competitions_count from show_in_match_bar only, ignoring is_featured_tournament', function (): void {
    [, $token] = matchBarAdminToken();

    Competition::create([
        'provider' => '365scores', 'provider_id' => 1, 'name' => 'أ',
        'show_in_match_bar' => true, 'is_featured_tournament' => false,
    ]);
    Competition::create([
        'provider' => '365scores', 'provider_id' => 2, 'name' => 'ب',
        'show_in_match_bar' => false, 'is_featured_tournament' => true,
    ]);

    $this->withToken($token)->putJson('/api/v1/admin/settings/match-bar', ['enabled' => true])->assertOk();

    $res = $this->withToken($token)->getJson('/api/v1/admin/settings/match-bar')->assertOk();
    expect($res->json('data.eligible_competitions_count'))->toBe(1);
});
