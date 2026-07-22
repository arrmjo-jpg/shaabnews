<?php

declare(strict_types=1);

use App\Actions\Admin\Content\TransitionArticleStatusAction;
use App\Models\Article;
use App\Models\Category;
use App\Models\User;
use App\Modules\CDN\Jobs\ProcessCdnPurgeBatch;
use App\Settings\CdnSettings;
use App\Support\Content\ArticleCdnPurge;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    Cache::flush();
});

function acpEnableCdn(): void
{
    $s = app(CdnSettings::class);
    $s->cdn_enabled = true;
    $s->cdn_auto_purge = true;
    $s->cdn_plan = 'free';
    $s->cdn_api_token = 'test-token';
    $s->cdn_zone_id = 'test-zone';
    $s->save();
}

function acpArticle(array $attrs = []): Article
{
    $cat = Category::create(['name' => 'c-'.uniqid(), 'slug' => 'cat-'.uniqid(), 'locale' => 'ar', 'status' => 'active']);

    return Article::create(array_merge([
        'title' => 't-'.uniqid(),
        'slug' => 'slug-'.uniqid(),
        'locale' => 'ar',
        'type' => 'news',
        'status' => 'published',
        'primary_category_id' => $cat->id,
        'author_id' => User::factory()->create()->id,
        'content_json' => tiptapDoc(),
        'content' => '<p>x</p>',
        'excerpt' => 'x',
        'published_at' => now()->subDay(),
    ], $attrs))->fresh();
}

it('dispatches a CDN purge batch when auto-purge is enabled', function (): void {
    acpEnableCdn();
    Queue::fake();

    ArticleCdnPurge::purge(acpArticle());

    Queue::assertPushed(ProcessCdnPurgeBatch::class);
});

it('is a no-op when auto-purge is disabled', function (): void {
    // CDN not configured/enabled
    Queue::fake();

    ArticleCdnPurge::purge(acpArticle());

    Queue::assertNotPushed(ProcessCdnPurgeBatch::class);
});

it('purge URL set covers article page, list, homepage, category and API endpoints', function (): void {
    acpEnableCdn();
    Queue::fake();

    $article = acpArticle();
    ArticleCdnPurge::purge($article);

    $urls = collect(Cache::get('cdn:purge:buffer', []));
    $catSlug = $article->primaryCategory->slug;

    // /news/dd/mm/yyyy/{id}/ (2026-07-18) — id-only canonical, no slug.
    expect($urls->contains(fn (string $u): bool => str_contains($u, $article->fresh()->canonicalPath())))->toBeTrue();
    expect($urls->contains(fn (string $u): bool => str_ends_with($u, '/ar/articles')))->toBeTrue();
    expect($urls->contains(fn (string $u): bool => str_contains($u, 'api/v1/ar/articles/'.$article->slug)))->toBeTrue();
    expect($urls->contains(fn (string $u): bool => str_contains($u, 'api/v1/ar/homepage')))->toBeTrue();
    expect($urls->contains(fn (string $u): bool => str_contains($u, 'api/v1/ar/categories/'.$catSlug)))->toBeTrue();
});

it('includes the old canonical path on a slug change', function (): void {
    acpEnableCdn();
    Queue::fake();

    $article = acpArticle();
    $oldPath = "/ar/articles/{$article->id}-previous-slug";
    ArticleCdnPurge::purge($article, $oldPath);

    $urls = collect(Cache::get('cdn:purge:buffer', []));
    expect($urls->contains(fn (string $u): bool => str_contains($u, $oldPath)))->toBeTrue();
});

it('status transition to published triggers a CDN purge', function (): void {
    acpEnableCdn();
    Queue::fake();

    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $article = acpArticle(['status' => 'draft', 'published_at' => null]);

    (new TransitionArticleStatusAction)->handle($article, ['status' => 'published'], $admin);

    Queue::assertPushed(ProcessCdnPurgeBatch::class);
});
