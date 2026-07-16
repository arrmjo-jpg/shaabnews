<?php

declare(strict_types=1);

use App\Health\Checks\ArticleSearchHealthCheck;
use App\Health\Checks\BroadcastSearchHealthCheck;
use App\Health\Checks\ReelSearchHealthCheck;
use App\Health\Checks\VideoSearchHealthCheck;
use App\Models\Article;
use App\Models\Broadcast;
use App\Models\Category;
use App\Models\MediaAsset;
use App\Models\Reel;
use App\Models\User;
use App\Models\Video;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function cshcArticle(array $attrs = []): Article
{
    $cat = Category::create(['name' => 'c-'.uniqid(), 'locale' => 'ar', 'status' => 'active']);

    return Article::create(array_merge([
        'title' => 't-'.uniqid(), 'slug' => 'slug-'.uniqid(), 'locale' => 'ar', 'type' => 'news',
        'status' => 'draft', 'primary_category_id' => $cat->id,
        'author_id' => User::factory()->create()->id,
        'content_json' => tiptapDoc(), 'content' => '<p>x</p>',
    ], $attrs));
}

function cshcReel(array $attrs = []): Reel
{
    return Reel::create(array_merge([
        'title' => 'r-'.uniqid(), 'slug' => 'r-slug-'.uniqid(), 'locale' => 'ar',
        'status' => 'draft', 'author_id' => User::factory()->create()->id,
    ], $attrs));
}

function cshcVideo(array $attrs = []): Video
{
    $asset = MediaAsset::create([
        'uuid' => (string) Str::uuid(), 'kind' => 'external', 'disk' => 'external', 'path' => '',
        'filename' => '', 'original_name' => 'x', 'mime_type' => 'video/external', 'extension' => '',
        'size' => 0, 'checksum' => hash('sha256', Str::random()), 'provider' => 'youtube',
        'provider_id' => Str::random(11), 'embed_url' => 'https://www.youtube.com/embed/'.Str::random(11),
        'source_url' => 'https://youtu.be/'.Str::random(11), 'poster_url' => 'https://img.youtube.com/x.jpg',
        'visibility' => 'public',
    ]);

    return Video::create(array_merge([
        'title' => 'v-'.uniqid(), 'locale' => 'ar', 'status' => 'draft', 'visibility' => 'public',
        'media_asset_id' => $asset->id, 'source_type' => 'youtube',
    ], $attrs));
}

function cshcBroadcast(array $attrs = []): Broadcast
{
    return Broadcast::create(array_merge([
        'title' => 'b-'.uniqid(), 'slug' => 'b-slug-'.uniqid(),
        'kind' => 'live', 'source_type' => 'hls', 'source_url' => 'https://example.test/stream.m3u8',
        'status' => 'draft', 'is_public' => true,
    ], $attrs));
}

// ─── run() early-exit — no Meilisearch, no assertion depends on a live engine ──

it('reports OK for all four checks when Meilisearch is not the Scout driver', function (): void {
    expect((new ArticleSearchHealthCheck)->run()->status->value)->toBe('ok')
        ->and((new VideoSearchHealthCheck)->run()->status->value)->toBe('ok')
        ->and((new ReelSearchHealthCheck)->run()->status->value)->toBe('ok')
        ->and((new BroadcastSearchHealthCheck)->run()->status->value)->toBe('ok');
});

// ─── evaluateDrift() — pure decision logic, explicit counts, no engine needed ──

it('is OK when indexed count matches expected exactly', function (): void {
    $check = new ArticleSearchHealthCheck;

    expect($check->evaluateDrift('articles_index', 100, 100)->status->value)->toBe('ok');
});

it('is OK when both expected and indexed are zero', function (): void {
    $check = new ArticleSearchHealthCheck;

    expect($check->evaluateDrift('articles_index', 0, 0)->status->value)->toBe('ok');
});

it('warns when drift crosses the warning threshold but stays under failure', function (): void {
    config(['performance.search.health_warning_drift_percent' => 10.0]);
    config(['performance.search.health_failure_drift_percent' => 30.0]);
    $check = new ArticleSearchHealthCheck;

    // 100 متوقَّع مقابل 85 مفهرَس = انحراف 15% — بين 10% و30%
    expect($check->evaluateDrift('articles_index', 85, 100)->status->value)->toBe('warning');
});

it('fails when drift exceeds the failure threshold', function (): void {
    config(['performance.search.health_warning_drift_percent' => 10.0]);
    config(['performance.search.health_failure_drift_percent' => 30.0]);
    $check = new ArticleSearchHealthCheck;

    // 100 متوقَّع مقابل 50 مفهرَس = انحراف 50%
    expect($check->evaluateDrift('articles_index', 50, 100)->status->value)->toBe('failed');
});

it('fails when the index is empty but rows are expected to be indexed', function (): void {
    $check = new ArticleSearchHealthCheck;

    expect($check->evaluateDrift('articles_index', 0, 50)->status->value)->toBe('failed');
});

// ─── expectedSearchableCount() per type — confirms the real DB predicate is wired correctly ──

it('counts only published+public+non-future videos as expected-searchable', function (): void {
    cshcVideo(['status' => 'published', 'visibility' => 'public', 'published_at' => now()->subDay()]);
    cshcVideo(['status' => 'draft']);
    cshcVideo(['status' => 'published', 'visibility' => 'private', 'published_at' => now()->subDay()]);
    cshcVideo(['status' => 'published', 'visibility' => 'public', 'published_at' => now()->addDay()]);

    expect((new VideoSearchHealthCheck)->publicExpectedCount())->toBe(1);
});

it('counts only published+non-future reels as expected-searchable', function (): void {
    cshcReel(['status' => 'published', 'published_at' => now()->subDay()]);
    cshcReel(['status' => 'draft']);
    cshcReel(['status' => 'published', 'published_at' => now()->addDay()]);

    expect((new ReelSearchHealthCheck)->publicExpectedCount())->toBe(1);
});

it('counts only public live-or-ended broadcasts as expected-searchable', function (): void {
    cshcBroadcast(['is_public' => true, 'status' => 'live']);
    cshcBroadcast(['is_public' => true, 'status' => 'ended']);
    cshcBroadcast(['is_public' => false, 'status' => 'live']);
    cshcBroadcast(['is_public' => true, 'status' => 'scheduled']);

    expect((new BroadcastSearchHealthCheck)->publicExpectedCount())->toBe(2);
});

it('counts every non-deleted article as expected-searchable regardless of status', function (): void {
    cshcArticle(['status' => 'draft']);
    cshcArticle(['status' => 'published']);
    cshcArticle(['status' => 'archived']);

    expect((new ArticleSearchHealthCheck)->publicExpectedCount())->toBe(3);
});

it('excludes soft-deleted rows from the expected-searchable count', function (): void {
    $reel = cshcReel(['status' => 'published', 'published_at' => now()->subDay()]);
    cshcReel(['status' => 'published', 'published_at' => now()->subDay()]);
    $reel->delete();

    expect((new ReelSearchHealthCheck)->publicExpectedCount())->toBe(1);
});
