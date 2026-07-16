<?php

declare(strict_types=1);

use App\Models\Broadcast;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function bsBroadcast(array $attrs = []): Broadcast
{
    return Broadcast::create(array_merge([
        'title' => 'b-'.uniqid(), 'slug' => 'b-slug-'.uniqid(),
        'kind' => 'live', 'source_type' => 'hls', 'source_url' => 'https://example.test/stream.m3u8', 'status' => 'draft',
        'is_public' => true,
    ], $attrs));
}

it('reports its own search index name', function (): void {
    expect(bsBroadcast()->searchableAs())->toBe('broadcasts_index');
});

it('is searchable only when live or ended, and public', function (): void {
    $draft = bsBroadcast(['status' => 'draft']);
    $scheduled = bsBroadcast(['status' => 'scheduled']);
    $live = bsBroadcast(['status' => 'live']);
    $ended = bsBroadcast(['status' => 'ended']);
    $failed = bsBroadcast(['status' => 'failed']);
    $archived = bsBroadcast(['status' => 'archived']);
    $privateLive = bsBroadcast(['status' => 'live', 'is_public' => false]);

    expect($draft->shouldBeSearchable())->toBeFalse();
    expect($scheduled->shouldBeSearchable())->toBeFalse();
    expect($live->shouldBeSearchable())->toBeTrue();
    expect($ended->shouldBeSearchable())->toBeTrue();
    expect($failed->shouldBeSearchable())->toBeFalse();
    expect($archived->shouldBeSearchable())->toBeFalse();
    expect($privateLive->shouldBeSearchable())->toBeFalse();
});

it('is not searchable once soft-deleted', function (): void {
    $broadcast = bsBroadcast(['status' => 'live']);
    $broadcast->delete();

    expect($broadcast->shouldBeSearchable())->toBeFalse();
});

it('exposes the expected searchable fields using kind instead of locale', function (): void {
    $broadcast = bsBroadcast(['status' => 'live', 'kind' => 'tv', 'is_featured' => true]);

    $doc = $broadcast->toSearchableArray();

    expect($doc)->toMatchArray([
        'id' => $broadcast->id,
        'title' => $broadcast->title,
        'kind' => 'tv',
        'status' => 'live',
        'is_featured' => true,
        'is_public' => true,
    ]);
    expect($doc)->not->toHaveKey('locale');
});
