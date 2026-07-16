<?php

declare(strict_types=1);

use App\Actions\Admin\VideoLibrary\TransitionVideoStatusAction;
use App\Enums\VideoStatus;
use App\Events\Content\VideoStatusChanged;
use App\Models\MediaAsset;
use App\Models\User;
use App\Models\Video;
use App\Support\Cache\VideoCacheTags;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    Cache::flush();
});

function vseEditor(): User
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return $u;
}

function vseVideo(array $attrs = []): Video
{
    $asset = MediaAsset::create([
        'uuid' => (string) Str::uuid(),
        'kind' => 'uploaded', 'processing_status' => 'ready',
        'disk' => 'public', 'path' => 'v-'.uniqid().'.mp4', 'filename' => 'v.mp4',
        'original_name' => 'v.mp4', 'mime_type' => 'video/mp4', 'extension' => 'mp4',
        'size' => 1, 'visibility' => 'public',
    ]);

    return Video::create(array_merge([
        'title' => 'v-'.uniqid(), 'slug' => 'v-slug-'.uniqid(), 'locale' => 'ar',
        'status' => 'draft', 'author_id' => User::factory()->create()->id,
        'media_asset_id' => $asset->id,
    ], $attrs))->fresh();
}

it('dispatches VideoStatusChanged exactly once with the correct payload', function (): void {
    Event::fake([VideoStatusChanged::class]);
    $editor = vseEditor();
    $video = vseVideo();

    (new TransitionVideoStatusAction)->handle($video, ['status' => 'published'], $editor);

    Event::assertDispatchedTimes(VideoStatusChanged::class, 1);
    Event::assertDispatched(function (VideoStatusChanged $event) use ($video, $editor): bool {
        return $event->video->id === $video->id
            && $event->from === VideoStatus::Draft
            && $event->to === VideoStatus::Published
            && $event->actor->id === $editor->id;
    });
});

it('does not dispatch VideoStatusChanged when the workflow guard denies the transition', function (): void {
    Event::fake([VideoStatusChanged::class]);
    $writer = User::factory()->create(['is_writer' => true]);
    $writer->assignRole('contributor');
    $video = vseVideo(['author_id' => $writer->id]);

    $response = (new TransitionVideoStatusAction)->handle($video, ['status' => 'published'], $writer);

    expect($response->getStatusCode())->toBe(403);
    Event::assertNotDispatched(VideoStatusChanged::class);
});

it('still flushes the video cache tags via the real listener chain', function (): void {
    $editor = vseEditor();
    $video = vseVideo();
    $key = 'test:video:'.uniqid();
    $tags = VideoCacheTags::invalidationTags($video, categorySlug: null);
    Cache::tags($tags)->put($key, 'warm', 60);
    expect(Cache::tags($tags)->has($key))->toBeTrue();

    (new TransitionVideoStatusAction)->handle($video, ['status' => 'published'], $editor);

    expect(Cache::tags($tags)->has($key))->toBeFalse();
});

it('still notifies the writer via the real listener chain', function (): void {
    $writer = User::factory()->create(['is_writer' => true]);
    $video = vseVideo(['author_id' => $writer->id, 'status' => 'submitted']);
    $editor = vseEditor();

    (new TransitionVideoStatusAction)->handle($video, ['status' => 'published'], $editor);

    expect($writer->notifications()->count())->toBe(1);
    expect($writer->notifications()->first()->data['status'])->toBe('published');
});
