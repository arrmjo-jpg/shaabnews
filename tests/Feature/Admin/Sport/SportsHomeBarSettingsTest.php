<?php

declare(strict_types=1);

use App\Models\Competition;
use App\Models\User;
use App\Settings\MatchBarSettings;
use App\Settings\SportsHomeBarSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function sportsHomeBarAdminToken(): array
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return [$u, $u->createToken('admin-token', ['admin'])->plainTextToken];
}

it('shows the enabled boolean and eligible count contract for an authorized admin', function (): void {
    [, $token] = sportsHomeBarAdminToken();

    $res = $this->withToken($token)->getJson('/api/v1/admin/settings/sports-home-bar')->assertOk();
    assertSuccessContract($res);
    $res->assertJsonStructure(['data' => ['enabled', 'eligible_competitions_count']]);
    expect($res->json('data.enabled'))->toBeFalse(); // القيمة الافتراضيّة من settings migration
});

it('updates the enabled flag independently from match bar settings', function (): void {
    [, $token] = sportsHomeBarAdminToken();

    $this->withToken($token)
        ->putJson('/api/v1/admin/settings/sports-home-bar', ['enabled' => true])
        ->assertOk();

    expect(app(SportsHomeBarSettings::class)->enabled)->toBeTrue();
    expect(app(MatchBarSettings::class)->enabled)->toBeFalse(); // إعداد مستقلّ تمامًا، لم يتأثّر
});

it('computes eligible_competitions_count from show_in_sports_home_bar only, ignoring show_in_match_bar', function (): void {
    [, $token] = sportsHomeBarAdminToken();

    Competition::create([
        'provider' => '365scores', 'provider_id' => 1, 'name' => 'أ',
        'show_in_sports_home_bar' => true, 'show_in_match_bar' => false,
    ]);
    Competition::create([
        'provider' => '365scores', 'provider_id' => 2, 'name' => 'ب',
        'show_in_sports_home_bar' => false, 'show_in_match_bar' => true,
    ]);

    $this->withToken($token)->putJson('/api/v1/admin/settings/sports-home-bar', ['enabled' => true])->assertOk();

    $res = $this->withToken($token)->getJson('/api/v1/admin/settings/sports-home-bar')->assertOk();
    expect($res->json('data.eligible_competitions_count'))->toBe(1);
});

it('toggles show_in_sports_home_bar on, auto-appending to the end of the selected list', function (): void {
    [, $token] = sportsHomeBarAdminToken();

    $first = Competition::create([
        'provider' => '365scores', 'provider_id' => 1, 'name' => 'أ',
        'show_in_sports_home_bar' => true, 'sports_home_bar_sort_order' => 0,
    ]);
    $second = Competition::create([
        'provider' => '365scores', 'provider_id' => 2, 'name' => 'ب',
        'show_in_sports_home_bar' => false,
    ]);

    $this->withToken($token)
        ->patchJson("/api/v1/admin/competitions/{$second->id}/sports-home-bar")
        ->assertOk();

    $second->refresh();
    expect($second->show_in_sports_home_bar)->toBeTrue();
    expect($second->sports_home_bar_sort_order)->toBe(1); // بعد $first (0) مباشرة

    // لم يتأثّر عمود Match Bar إطلاقًا — فصل بنيويّ بين الشريطين.
    expect($second->show_in_match_bar)->toBeFalse();
});

it('toggles show_in_sports_home_bar off without touching its previous sort order', function (): void {
    [, $token] = sportsHomeBarAdminToken();

    $c = Competition::create([
        'provider' => '365scores', 'provider_id' => 1, 'name' => 'أ',
        'show_in_sports_home_bar' => true, 'sports_home_bar_sort_order' => 5,
    ]);

    $this->withToken($token)->patchJson("/api/v1/admin/competitions/{$c->id}/sports-home-bar")->assertOk();

    $c->refresh();
    expect($c->show_in_sports_home_bar)->toBeFalse();
    expect($c->sports_home_bar_sort_order)->toBe(5); // يبقى كما هو، لا يُصفَّر
});

it('reorders selected competitions via the shared bulk endpoint, without affecting match_bar_sort_order', function (): void {
    [, $token] = sportsHomeBarAdminToken();

    $a = Competition::create([
        'provider' => '365scores', 'provider_id' => 1, 'name' => 'أ',
        'show_in_sports_home_bar' => true, 'sports_home_bar_sort_order' => 0,
        'show_in_match_bar' => true, 'match_bar_sort_order' => 9,
    ]);
    $b = Competition::create([
        'provider' => '365scores', 'provider_id' => 2, 'name' => 'ب',
        'show_in_sports_home_bar' => true, 'sports_home_bar_sort_order' => 1,
    ]);

    $this->withToken($token)
        ->patchJson('/api/v1/admin/competitions/sports-home-bar/reorder', ['ids' => [$b->id, $a->id]])
        ->assertOk();

    $a->refresh();
    $b->refresh();
    expect($b->sports_home_bar_sort_order)->toBe(0);
    expect($a->sports_home_bar_sort_order)->toBe(1);
    expect($a->match_bar_sort_order)->toBe(9); // عمود شريط آخر، لم يُلمَس
});
