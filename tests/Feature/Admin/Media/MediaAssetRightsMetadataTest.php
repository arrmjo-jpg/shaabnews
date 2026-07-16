<?php

declare(strict_types=1);

use App\Models\MediaAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function makeMediaAssetForRightsTest(array $attrs = []): MediaAsset
{
    return MediaAsset::create(array_merge([
        'uuid' => (string) Str::uuid(),
        'kind' => 'uploaded', 'processing_status' => 'ready',
        'disk' => 'public', 'path' => 'm-'.uniqid().'.jpg', 'filename' => 'm.jpg',
        'original_name' => 'm.jpg', 'mime_type' => 'image/jpeg', 'extension' => 'jpg',
        'size' => 1, 'visibility' => 'public',
    ], $attrs));
}

it('stores and casts rights metadata', function (): void {
    $asset = makeMediaAssetForRightsTest([
        'license_type' => 'editorial_use_only',
        'rights_expiry_at' => '2027-01-01 00:00:00',
        'usage_terms' => 'Web only, no reprints without written consent.',
    ]);

    $fresh = $asset->fresh();
    expect($fresh->license_type)->toBe('editorial_use_only');
    expect($fresh->rights_expiry_at)->toBeInstanceOf(Carbon::class);
    expect($fresh->rights_expiry_at->toDateString())->toBe('2027-01-01');
    expect($fresh->usage_terms)->toBe('Web only, no reprints without written consent.');
});

it('leaves rights metadata null by default (fully additive)', function (): void {
    $asset = makeMediaAssetForRightsTest();

    expect($asset->license_type)->toBeNull();
    expect($asset->rights_expiry_at)->toBeNull();
    expect($asset->usage_terms)->toBeNull();
});

it('audits changes to rights metadata', function (): void {
    $asset = makeMediaAssetForRightsTest();

    $asset->update(['license_type' => 'licensed']);

    expect(
        Activity::where('log_name', 'media')
            ->where('subject_id', $asset->id)
            ->where('event', 'updated')
            ->get()
            ->contains(fn ($a) => array_key_exists('license_type', $a->properties['attributes'] ?? []))
    )->toBeTrue();
});
