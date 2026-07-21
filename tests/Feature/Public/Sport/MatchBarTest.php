<?php

declare(strict_types=1);

use App\Models\Competition;
use App\Models\Fixture;
use App\Settings\MatchBarSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeMatchBarCompetition(array $attrs = []): Competition
{
    static $seq = 0;
    $seq++;

    return Competition::create(array_merge([
        'provider' => '365scores',
        'provider_id' => 900000 + $seq,
        'name' => 'دوري تجريبي '.$seq,
        'is_active' => true,
        'is_tracked' => true,
        'show_in_match_bar' => false,
        'match_bar_sort_order' => null,
    ], $attrs));
}

function makeMatchBarFixture(Competition $competition, array $attrs = []): Fixture
{
    static $seq = 0;
    $seq++;

    return Fixture::create(array_merge([
        'provider' => '365scores',
        'provider_id' => 800000 + $seq,
        'competition_id' => $competition->id,
        'home_name' => 'الفريق أ',
        'away_name' => 'الفريق ب',
        'status' => 'scheduled',
        'kickoff_at' => now()->addHour(),
    ], $attrs));
}

it('returns disabled with no matches when the match bar setting is off', function (): void {
    app(MatchBarSettings::class)->enabled = false;
    app(MatchBarSettings::class)->save();

    $res = $this->getJson('/api/v1/match-bar')->assertOk();
    assertSuccessContract($res);
    expect($res->json('data.enabled'))->toBeFalse();
    expect($res->json('data.matches'))->toBe([]);
});

it('returns disabled when enabled but no competition has show_in_match_bar', function (): void {
    app(MatchBarSettings::class)->enabled = true;
    app(MatchBarSettings::class)->save();

    makeMatchBarCompetition(['show_in_match_bar' => false]);

    $res = $this->getJson('/api/v1/match-bar')->assertOk();
    expect($res->json('data.enabled'))->toBeFalse();
});

it('lists only show_in_match_bar competitions ordered by match_bar_sort_order then kickoff_at, ignoring the old featured flags entirely', function (): void {
    app(MatchBarSettings::class)->enabled = true;
    app(MatchBarSettings::class)->save();

    $second = makeMatchBarCompetition(['show_in_match_bar' => true, 'match_bar_sort_order' => 2]);
    $first = makeMatchBarCompetition(['show_in_match_bar' => true, 'match_bar_sort_order' => 1]);
    $hidden = makeMatchBarCompetition(['show_in_match_bar' => false]);
    $featuredButNotShown = makeMatchBarCompetition([
        'show_in_match_bar' => false,
        'is_featured_tournament' => true,
        'featured_until' => null,
    ]);

    makeMatchBarFixture($second, ['home_name' => 'ترتيب-2']);
    makeMatchBarFixture($first, ['home_name' => 'ترتيب-1']);
    makeMatchBarFixture($hidden, ['home_name' => 'مخفيّة']);
    makeMatchBarFixture($featuredButNotShown, ['home_name' => 'مميّزة-لكن-غير-معروضة']);

    $res = $this->getJson('/api/v1/match-bar')->assertOk();
    expect($res->json('data.enabled'))->toBeTrue();

    $names = collect($res->json('data.matches'))->pluck('home.name')->all();
    expect($names)->toBe(['ترتيب-1', 'ترتيب-2']);
});

it('keeps the public JSON contract shape identical to before this change', function (): void {
    app(MatchBarSettings::class)->enabled = true;
    app(MatchBarSettings::class)->save();

    $c = makeMatchBarCompetition(['show_in_match_bar' => true, 'match_bar_sort_order' => 1]);
    makeMatchBarFixture($c);

    $res = $this->getJson('/api/v1/match-bar')->assertOk();
    assertSuccessContract($res);
    $res->assertJsonStructure([
        'data' => [
            'enabled',
            'matches' => [
                '*' => [
                    'id', 'kind', 'status_text', 'kickoff_at',
                    'home' => ['name', 'logo', 'score'],
                    'away' => ['name', 'logo', 'score'],
                ],
            ],
        ],
    ]);
});
