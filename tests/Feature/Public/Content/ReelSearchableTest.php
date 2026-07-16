<?php

declare(strict_types=1);

use App\Models\Reel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function rsReel(array $attrs = []): Reel
{
    return Reel::create(array_merge([
        'title' => 'r-'.uniqid(), 'slug' => 'r-slug-'.uniqid(), 'locale' => 'ar',
        'status' => 'draft', 'author_id' => User::factory()->create()->id,
    ], $attrs));
}

it('reports its own search index name', function (): void {
    expect(rsReel()->searchableAs())->toBe('reels_index');
});

it('is searchable only when published with a past published_at', function (): void {
    $draft = rsReel(['status' => 'draft']);
    $futurePublished = rsReel(['status' => 'published', 'published_at' => now()->addDay()]);
    $published = rsReel(['status' => 'published', 'published_at' => now()->subHour()]);

    expect($draft->shouldBeSearchable())->toBeFalse();
    expect($futurePublished->shouldBeSearchable())->toBeFalse();
    expect($published->shouldBeSearchable())->toBeTrue();
});

it('is not searchable once soft-deleted', function (): void {
    $reel = rsReel(['status' => 'published', 'published_at' => now()->subHour()]);
    $reel->delete();

    expect($reel->shouldBeSearchable())->toBeFalse();
});

it('exposes the expected searchable fields', function (): void {
    $reel = rsReel(['status' => 'published', 'published_at' => now()->subHour(), 'is_featured' => true]);

    $doc = $reel->toSearchableArray();

    expect($doc)->toMatchArray([
        'id' => $reel->id,
        'title' => $reel->title,
        'locale' => 'ar',
        'status' => 'published',
        'is_featured' => true,
    ]);
    expect($doc)->toHaveKeys(['description', 'author_id', 'published_at']);
});
