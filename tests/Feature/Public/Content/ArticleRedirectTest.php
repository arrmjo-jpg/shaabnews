<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\ArticleUrlHistory;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    Cache::flush();
});

function rdArticle(string $slug, string $locale = 'ar', array $attrs = []): Article
{
    $cat = Category::create([
        'name' => 'cat-'.uniqid(),
        'locale' => $locale,
        'status' => 'active',
    ]);

    return Article::create(array_merge([
        'title' => 'title-'.uniqid(),
        'slug' => $slug,
        'locale' => $locale,
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

// ─── Slug change → 301 on the public article endpoint ───────────────────────

it('301-redirects an old slug to the current article URL', function (): void {
    $article = rdArticle('new-slug');
    ArticleUrlHistory::create([
        'article_id' => $article->id,
        'locale' => 'ar',
        'old_path' => "/ar/articles/{$article->id}-old-slug",
        'reason' => 'canonical_change',
    ]);

    $res = $this->getJson('/api/v1/ar/articles/old-slug');

    $res->assertStatus(301);
    expect($res->headers->get('Location'))->toEndWith('/api/v1/ar/articles/new-slug');
});

it('301-redirects across a locale change to the current locale URL', function (): void {
    $article = rdArticle('moved-slug', 'en');
    ArticleUrlHistory::create([
        'article_id' => $article->id,
        'locale' => 'ar', // كان عربياً، أصبح إنجليزياً
        'old_path' => "/ar/articles/{$article->id}-old-arabic",
        'reason' => 'canonical_change',
    ]);

    $res = $this->getJson('/api/v1/ar/articles/old-arabic');

    $res->assertStatus(301);
    expect($res->headers->get('Location'))->toEndWith('/api/v1/en/articles/moved-slug');
});

// ─── No history / loop safety ───────────────────────────────────────────────

it('returns 404 (no redirect) for an unknown slug with no history', function (): void {
    rdArticle('live-slug');

    $this->getJson('/api/v1/ar/articles/does-not-exist')->assertStatus(404);
});

it('serves the current article normally (no redirect loop)', function (): void {
    rdArticle('live-slug');

    $this->getJson('/api/v1/ar/articles/live-slug')->assertOk();
});

it('does not partial-match a different slug (news vs breaking-news)', function (): void {
    $article = rdArticle('current');
    ArticleUrlHistory::create([
        'article_id' => $article->id,
        'locale' => 'ar',
        'old_path' => "/ar/articles/{$article->id}-breaking-news",
        'reason' => 'canonical_change',
    ]);

    // طلب "news" يجب ألّا يُطابق "breaking-news"
    $this->getJson('/api/v1/ar/articles/news')->assertStatus(404);
});

// ─── Dedicated path resolver endpoint ───────────────────────────────────────

it('resolves a full old canonical path to a 301 via the redirect endpoint', function (): void {
    $article = rdArticle('renamed');
    $oldPath = "/ar/articles/{$article->id}-original";
    ArticleUrlHistory::create([
        'article_id' => $article->id,
        'locale' => 'ar',
        'old_path' => $oldPath,
        'reason' => 'canonical_change',
    ]);

    $res = $this->getJson('/api/v1/ar/redirects/articles?path='.urlencode($oldPath));

    $res->assertStatus(301);
    // canonicalPath() is id-only, no slug (ADR A3.6) — the redirect target never carries "-renamed".
    expect($res->headers->get('Location'))->toContain("/ar/articles/{$article->id}");
});

it('redirect endpoint returns 404 for an unmapped path', function (): void {
    $this->getJson('/api/v1/ar/redirects/articles?path=/ar/articles/999-nope')->assertStatus(404);
});
