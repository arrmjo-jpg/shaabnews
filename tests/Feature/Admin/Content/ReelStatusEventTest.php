<?php

declare(strict_types=1);

use App\Actions\Admin\Content\TransitionReelStatusAction;
use App\Enums\ReelStatus;
use App\Events\Content\ReelStatusChanged;
use App\Models\MediaAsset;
use App\Models\Reel;
use App\Models\User;
use App\Support\Cache\ReelCacheTags;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    Cache::flush();
});

function rseEditor(): User
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return $u;
}

function rseReel(array $attrs = []): Reel
{
    $asset = MediaAsset::create([
        'uuid' => (string) Str::uuid(),
        'kind' => 'uploaded', 'processing_status' => 'ready',
        'disk' => 'public', 'path' => 'r-'.uniqid().'.mp4', 'filename' => 'r.mp4',
        'original_name' => 'r.mp4', 'mime_type' => 'video/mp4', 'extension' => 'mp4',
        'size' => 1, 'visibility' => 'public',
    ]);

    return Reel::create(array_merge([
        'title' => 'r-'.uniqid(), 'slug' => 'r-slug-'.uniqid(), 'locale' => 'ar',
        'status' => 'draft', 'author_id' => User::factory()->create()->id,
        'media_asset_id' => $asset->id,
    ], $attrs))->fresh();
}

it('dispatches ReelStatusChanged exactly once with the correct payload', function (): void {
    Event::fake([ReelStatusChanged::class]);
    $editor = rseEditor();
    $reel = rseReel();

    (new TransitionReelStatusAction)->handle($reel, ['status' => 'published'], $editor);

    Event::assertDispatchedTimes(ReelStatusChanged::class, 1);
    Event::assertDispatched(function (ReelStatusChanged $event) use ($reel, $editor): bool {
        return $event->reel->id === $reel->id
            && $event->from === ReelStatus::Draft
            && $event->to === ReelStatus::Published
            && $event->actor->id === $editor->id;
    });
});

it('does not dispatch ReelStatusChanged when the workflow guard denies the transition', function (): void {
    Event::fake([ReelStatusChanged::class]);
    $writer = User::factory()->create(['is_writer' => true]);
    $writer->assignRole('contributor');
    $reel = rseReel(['author_id' => $writer->id]);

    $response = (new TransitionReelStatusAction)->handle($reel, ['status' => 'published'], $writer);

    expect($response->getStatusCode())->toBe(403);
    Event::assertNotDispatched(ReelStatusChanged::class);
});

it('still flushes the reel cache tags via the real listener chain', function (): void {
    $editor = rseEditor();
    $reel = rseReel();
    $key = 'test:reel:'.uniqid();
    $tags = ReelCacheTags::invalidationTags($reel);
    Cache::tags($tags)->put($key, 'warm', 60);
    expect(Cache::tags($tags)->has($key))->toBeTrue();

    (new TransitionReelStatusAction)->handle($reel, ['status' => 'published'], $editor);

    expect(Cache::tags($tags)->has($key))->toBeFalse();
});

it('still notifies the writer via the real listener chain', function (): void {
    $writer = User::factory()->create(['is_writer' => true]);
    $reel = rseReel(['author_id' => $writer->id, 'status' => 'submitted']);
    $editor = rseEditor();

    (new TransitionReelStatusAction)->handle($reel, ['status' => 'published'], $editor);

    expect($writer->notifications()->count())->toBe(1);
    expect($writer->notifications()->first()->data['status'])->toBe('published');
});
