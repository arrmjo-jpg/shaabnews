<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\Category;
use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    Cache::flush();
    config(['seo.publisher.logo' => 'https://cdn.test/logo.png', 'seo.publisher.name' => 'AlphaNews']);
});

function seoNewsArticle(array $attrs = [], bool $withCover = false): Article
{
    $cat = Category::firstOrCreate(
        ['slug' => 'seo-cat', 'locale' => 'ar'],
        ['name' => 'سياسة', 'status' => 'active'],
    );

    $article = Article::create(array_merge([
        'title' => 'خبر '.uniqid(),
        'slug' => 'sg-'.uniqid(),
        'locale' => 'ar',
        'type' => 'news',
        'status' => 'published',
        'primary_category_id' => $cat->id,
        'author_id' => User::factory()->create(['name' => 'محرّر'])->id,
        'content_json' => tiptapDoc(),
        'content' => '<p>المتن.</p>',
        'excerpt' => 'مقتطف',
        'published_at' => now()->subHour(),
    ], $attrs))->fresh();

    if ($withCover) {
        $media = MediaAsset::create([
            'uuid' => 'seo-'.uniqid(),
            'disk' => 'public',
            'path' => 'assets/'.uniqid().'/cover.jpg',
            'filename' => 'cover.jpg',
            'original_name' => 'cover.jpg',
            'extension' => 'jpg',
            'size' => 1000,
            'mime_type' => 'image/jpeg',
            'visibility' => 'public',
            'width' => 1200,
            'height' => 630,
        ]);
        $article->mediaAssets()->attach($media->id, ['collection' => 'cover', 'position' => 0]);
    }

    return $article->fresh();
}

// ─── Structured data ────────────────────────────────────────────────────────

it('emits valid NewsArticle structured data with a publisher logo', function (): void {
    $a = seoNewsArticle();

    $res = $this->getJson("/api/v1/ar/articles/{$a->slug}")->assertOk();

    $sd = $res->json('data.seo.structured_data');
    expect($sd['@type'])->toBe('NewsArticle');
    expect($sd['inLanguage'])->toBe('ar');
    expect($sd['datePublished'])->not->toBeNull();
    expect($sd['author']['name'])->toBe('محرّر');
    expect($sd['publisher']['logo']['@type'])->toBe('ImageObject');
    expect($sd['publisher']['logo']['url'])->toBe('https://cdn.test/logo.png');
});

it('emits an ImageObject with dimensions when a cover exists', function (): void {
    $a = seoNewsArticle(withCover: true);

    $res = $this->getJson("/api/v1/ar/articles/{$a->slug}")->assertOk();

    $image = $res->json('data.seo.structured_data.image');
    expect($image['@type'])->toBe('ImageObject');
    expect($image['width'])->toBe(1200);
    expect($image['height'])->toBe(630);
});

it('emits a BreadcrumbList: home → category → article', function (): void {
    $a = seoNewsArticle();

    $res = $this->getJson("/api/v1/ar/articles/{$a->slug}")->assertOk();

    $bc = $res->json('data.seo.breadcrumbs');
    expect($bc['@type'])->toBe('BreadcrumbList');
    expect($bc['itemListElement'])->toHaveCount(3);
    expect($bc['itemListElement'][1]['name'])->toBe('سياسة'); // category
    expect($bc['itemListElement'][2]['name'])->toBe($a->title); // article last
});

// ─── Canonical + hreflang ───────────────────────────────────────────────────

it('canonical uses the stable id path', function (): void {
    $a = seoNewsArticle();

    $res = $this->getJson("/api/v1/ar/articles/{$a->slug}")->assertOk();

    // /news/dd/mm/yyyy/{id}/ (2026-07-18): id-only, no slug — the id never changes,
    // unlike the slug; date comes from published_at only.
    expect($res->json('data.seo.canonical_url'))->toEndWith($a->fresh()->canonicalPath());
});

it('includes an x-default hreflang entry', function (): void {
    $a = seoNewsArticle();

    $res = $this->getJson("/api/v1/ar/articles/{$a->slug}")->assertOk();

    $locales = collect($res->json('data.seo.hreflang'))->pluck('locale');
    expect($locales)->toContain('ar');
    expect($locales)->toContain('x-default');
});

// ─── News sitemap freshness ─────────────────────────────────────────────────

it('news sitemap includes recent articles and excludes stale ones', function (): void {
    $recent = seoNewsArticle(['title' => 'خبر حديث جداً', 'published_at' => now()->subHour()]);
    $old = seoNewsArticle(['title' => 'خبر قديم متجاوز', 'published_at' => now()->subDays(5)]);

    $xml = $this->get('/sitemap-news-ar.xml')->assertOk()->getContent();

    // <loc> is /news/dd/mm/yyyy/{id}/ (2026-07-18, id-only, no slug) — assert on
    // <news:title> too, and on the id-based canonical URL.
    expect($xml)->toContain($recent->fresh()->canonicalPath());
    expect($xml)->toContain($recent->title);
    expect($xml)->not->toContain($old->fresh()->canonicalPath());
    expect($xml)->not->toContain($old->title);
});
