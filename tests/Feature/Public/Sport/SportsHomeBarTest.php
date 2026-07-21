<?php

declare(strict_types=1);

use App\Models\Competition;
use App\Models\Fixture;
use App\Settings\MatchBarSettings;
use App\Settings\SportsHomeBarSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeSportsHomeBarCompetition(array $attrs = []): Competition
{
    static $seq = 0;
    $seq++;

    return Competition::create(array_merge([
        'provider' => '365scores',
        'provider_id' => 700000 + $seq,
        'name' => 'دوري تجريبي '.$seq,
        'is_active' => true,
        'is_tracked' => true,
        'show_in_sports_home_bar' => false,
        'sports_home_bar_sort_order' => null,
    ], $attrs));
}

function makeSportsHomeBarFixture(Competition $competition, array $attrs = []): Fixture
{
    static $seq = 0;
    $seq++;

    return Fixture::create(array_merge([
        'provider' => '365scores',
        'provider_id' => 600000 + $seq,
        'competition_id' => $competition->id,
        'home_name' => 'الفريق أ',
        'away_name' => 'الفريق ب',
        'status' => 'scheduled',
        'kickoff_at' => now()->addHour(),
    ], $attrs));
}

it('returns disabled with no matches when the sports home bar setting is off', function (): void {
    app(SportsHomeBarSettings::class)->enabled = false;
    app(SportsHomeBarSettings::class)->save();

    $res = $this->getJson('/api/v1/sports-home-bar')->assertOk();
    assertSuccessContract($res);
    expect($res->json('data.enabled'))->toBeFalse();
    expect($res->json('data.matches'))->toBe([]);
});

it('returns disabled when enabled but no competition has show_in_sports_home_bar', function (): void {
    app(SportsHomeBarSettings::class)->enabled = true;
    app(SportsHomeBarSettings::class)->save();

    makeSportsHomeBarCompetition(['show_in_sports_home_bar' => false]);

    $res = $this->getJson('/api/v1/sports-home-bar')->assertOk();
    expect($res->json('data.enabled'))->toBeFalse();
});

it('lists only show_in_sports_home_bar competitions ordered by sports_home_bar_sort_order then kickoff_at', function (): void {
    app(SportsHomeBarSettings::class)->enabled = true;
    app(SportsHomeBarSettings::class)->save();

    $second = makeSportsHomeBarCompetition(['show_in_sports_home_bar' => true, 'sports_home_bar_sort_order' => 2]);
    $first = makeSportsHomeBarCompetition(['show_in_sports_home_bar' => true, 'sports_home_bar_sort_order' => 1]);
    $hidden = makeSportsHomeBarCompetition(['show_in_sports_home_bar' => false]);

    makeSportsHomeBarFixture($second, ['home_name' => 'ترتيب-2']);
    makeSportsHomeBarFixture($first, ['home_name' => 'ترتيب-1']);
    makeSportsHomeBarFixture($hidden, ['home_name' => 'مخفيّة']);

    $res = $this->getJson('/api/v1/sports-home-bar')->assertOk();
    expect($res->json('data.enabled'))->toBeTrue();

    $names = collect($res->json('data.matches'))->pluck('home.name')->all();
    expect($names)->toBe(['ترتيب-1', 'ترتيب-2']);
});

it('is fully independent from the match bar setting and selection', function (): void {
    app(SportsHomeBarSettings::class)->enabled = true;
    app(SportsHomeBarSettings::class)->save();
    app(MatchBarSettings::class)->enabled = false;
    app(MatchBarSettings::class)->save();

    $c = makeSportsHomeBarCompetition([
        'show_in_sports_home_bar' => true, 'sports_home_bar_sort_order' => 0,
        'show_in_match_bar' => false,
    ]);
    makeSportsHomeBarFixture($c);

    $sportsHomeBar = $this->getJson('/api/v1/sports-home-bar')->assertOk();
    $matchBar = $this->getJson('/api/v1/match-bar')->assertOk();

    expect($sportsHomeBar->json('data.enabled'))->toBeTrue();
    expect($matchBar->json('data.enabled'))->toBeFalse(); // معطَّل بإعداده الخاصّ، رغم تفعيل الشريط الآخر
});

it('keeps the same public JSON contract shape as the match bar endpoint, including the competition field', function (): void {
    app(SportsHomeBarSettings::class)->enabled = true;
    app(SportsHomeBarSettings::class)->save();

    $c = makeSportsHomeBarCompetition(['show_in_sports_home_bar' => true, 'sports_home_bar_sort_order' => 0]);
    makeSportsHomeBarFixture($c);

    $res = $this->getJson('/api/v1/sports-home-bar')->assertOk();
    assertSuccessContract($res);
    $res->assertJsonStructure([
        'data' => [
            'enabled',
            'matches' => [
                '*' => [
                    'id', 'kind', 'status_text', 'kickoff_at',
                    'home' => ['name', 'logo', 'score'],
                    'away' => ['name', 'logo', 'score'],
                    'competition' => ['id', 'name', 'logo'],
                ],
            ],
        ],
    ]);
});
