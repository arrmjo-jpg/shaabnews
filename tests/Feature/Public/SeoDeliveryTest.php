<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    Cache::flush();
});

function seoCat(array $attrs = []): Category
{
    return Category::create(array_merge([
        'name' => 'تصنيف '.uniqid(),
        'locale' => 'ar',
        'status' => 'active',
    ], $attrs));
}

function seoArticle(Category $primary, array $attrs = []): Article
{
    return Article::create(array_merge([
        'title' => 'مقال '.uniqid(),
        'locale' => $primary->locale,
        'type' => 'news',
        'status' => 'published',
        'primary_category_id' => $primary->id,
        'author_id' => User::factory()->create()->id,
        'content_json' => tiptapDoc(),
        'content' => '<p>محتوى</p>',
        'excerpt' => 'ملخّص',
        'published_at' => now()->subHour(),
    ], $attrs))->fresh();
}

// ─── robots.txt ─────────────────────────────────────────────────────────

it('serves a dynamic robots.txt that references the sitemap index', function (): void {
    $res = $this->get('/robots.txt');

    $res->assertOk();
    expect($res->headers->get('Content-Type'))->toContain('text/plain');
    $body = $res->getContent();
    expect($body)->toContain('User-agent: *');
    expect($body)->toContain('Disallow: /api/');
    expect($body)->toContain('Disallow: /admin/');
    expect($body)->toContain('Sitemap:');
    expect($body)->toContain('/sitemap.xml');
});

it('attaches a long Cache-Control on robots.txt', function (): void {
    $res = $this->get('/robots.txt');
    $res->assertOk();
    expect($res->headers->get('Cache-Control'))->toContain('public');
    expect($res->headers->get('Cache-Control'))->toContain('s-maxage=');
});

// ─── /sitemap.xml index ────────────────────────────────────────────────

it('serves the sitemap index with every locale + every sitemap type', function (): void {
    $res = $this->get('/sitemap.xml');

    $res->assertOk();
    expect($res->headers->get('Content-Type'))->toContain('application/xml');
    $body = $res->getContent();
    expect($body)->toContain('<sitemapindex');
    foreach (['ar', 'en'] as $locale) {
        expect($body)->toContain("sitemap-articles-{$locale}.xml");
        expect($body)->toContain("sitemap-categories-{$locale}.xml");
        expect($body)->toContain("sitemap-news-{$locale}.xml");
    }
});

// ─── Per-locale article sitemap ────────────────────────────────────────

it('lists published articles in the locale sitemap', function (): void {
    $cat = seoCat();
    $a = seoArticle($cat, ['title' => 'منشور']);
    seoArticle($cat, ['title' => 'مسودّة', 'status' => 'draft', 'published_at' => null]);

    $res = $this->get('/sitemap-articles-ar.xml');

    $res->assertOk();
    expect($res->headers->get('Content-Type'))->toContain('application/xml');
    $body = $res->getContent();
    expect($body)->toContain('<urlset');
    // /news/dd/mm/yyyy/{id}/ (2026-07-18) — id-only, date from published_at.
    expect($body)->toContain($a->canonicalPath());
    // Drafts must never reach the sitemap
    expect(substr_count($body, '<url>'))->toBe(1);
});

it('includes hreflang alternates when translations share a translation_group', function (): void {
    $arCat = seoCat();
    $enCat = seoCat(['locale' => 'en', 'name' => 'cat-en']);
    $group = 'group-'.uniqid();
    seoArticle($arCat, ['title' => 'AR', 'translation_group' => $group]);
    seoArticle($enCat, ['title' => 'EN', 'translation_group' => $group]);

    $res = $this->get('/sitemap-articles-ar.xml');
    $res->assertOk();
    expect($res->headers->get('Content-Type'))->toContain('application/xml');
    $body = $res->getContent();

    expect($body)->toContain('xhtml:link');
    expect($body)->toContain('hreflang="ar"');
    expect($body)->toContain('hreflang="en"');
});

it('returns 404 for an unsupported locale sitemap', function (): void {
    $this->get('/sitemap-articles-de.xml')->assertNotFound();
});

// ─── Per-locale categories sitemap ─────────────────────────────────────

it('lists only active categories per locale', function (): void {
    seoCat(['name' => 'ظاهر', 'locale' => 'ar', 'status' => 'active']);
    seoCat(['name' => 'مخفي', 'locale' => 'ar', 'status' => 'hidden']);
    seoCat(['name' => 'english', 'locale' => 'en', 'status' => 'active']);

    $body = $this->get('/sitemap-categories-ar.xml')->getContent();

    expect($body)->toContain('<urlset');
    expect(substr_count($body, '<url>'))->toBe(1);
});

// ─── Google News sitemap ───────────────────────────────────────────────

it('emits a Google News sitemap for the last 48 hours only', function (): void {
    $cat = seoCat();
    seoArticle($cat, ['title' => 'حديث', 'published_at' => now()->subHours(2)]);
    seoArticle($cat, ['title' => 'قديم', 'published_at' => now()->subDays(5)]);

    $body = $this->get('/sitemap-news-ar.xml')->getContent();

    expect($body)->toContain('xmlns:news=');
    expect($body)->toContain('<news:news>');
    expect($body)->toContain('<news:publication>');
    expect($body)->toContain('<news:language>ar</news:language>');
    expect(substr_count($body, '<url>'))->toBe(1);
});

// ─── Article detail SEO payload (canonical, hreflang, OG, Twitter, JSON-LD) ──

it('exposes a full SEO payload on the article detail endpoint', function (): void {
    $cat = seoCat();
    $a = seoArticle($cat, [
        'title' => 'العنوان',
        'excerpt' => 'الملخّص',
        'seo_title' => null,
        'seo_description' => null,
    ]);

    $res = $this->getJson('/api/v1/ar/articles/'.$a->slug);
    $res->assertOk();
    $seo = $res->json('data.seo');

    // Title/description fall back to article fields
    expect($seo['title'])->toBe('العنوان');
    expect($seo['description'])->toBe('الملخّص');

    // Canonical URL is absolute, derived from canonical_path — /news/dd/mm/yyyy/{id}/
    // (2026-07-18): id-only, no slug, date from published_at (the id never changes,
    // unlike the slug, so it's the stable part of the canonical URL).
    expect($seo['canonical_url'])->toStartWith('http');
    expect($seo['canonical_url'])->toContain($a->fresh()->canonicalPath());

    // OpenGraph + Twitter + JSON-LD blocks
    expect($seo['og']['type'])->toBe('article');
    expect($seo['og']['locale'])->toBe('ar_AR');
    expect($seo['og']['title'])->toBe('العنوان');
    expect($seo['twitter']['card'])->toBe('summary');
    expect($seo['structured_data']['@context'])->toBe('https://schema.org');
    expect($seo['structured_data']['@type'])->toBe('NewsArticle');
    expect($seo['structured_data']['headline'])->toBe('العنوان');
});

it('uses Article schema type for non-news articles', function (): void {
    $cat = seoCat(['scope' => 'opinion']);
    $a = seoArticle($cat, ['type' => 'opinion']);

    $res = $this->getJson('/api/v1/ar/articles/'.$a->slug);
    expect($res->json('data.seo.structured_data.@type'))->toBe('Article');
});

it('returns hreflang siblings on a translated article', function (): void {
    $arCat = seoCat();
    $enCat = seoCat(['locale' => 'en', 'name' => 'cat-en']);
    $group = 'g-'.uniqid();
    $ar = seoArticle($arCat, ['title' => 'AR', 'translation_group' => $group]);
    seoArticle($enCat, ['title' => 'EN', 'translation_group' => $group]);

    $res = $this->getJson('/api/v1/ar/articles/'.$ar->slug);
    $alts = $res->json('data.seo.hreflang');

    $locales = array_column($alts, 'locale');
    expect($locales)->toContain('ar');
    expect($locales)->toContain('en');
});

// ─── Sitemap cache invalidation ────────────────────────────────────────

it('flushes the articles sitemap when an admin publishes a new article', function (): void {
    $cat = seoCat();
    seoArticle($cat, ['title' => 'موجود']);

    // Warm cache
    $first = $this->get('/sitemap-articles-ar.xml');
    $firstCount = substr_count($first->getContent(), '<url>');

    // Admin publish: create + transition via API
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

    $created = $this->withToken($token)->postJson('/api/v1/admin/articles', [
        'title' => 'جديد',
        'locale' => 'ar',
        'type' => 'news',
        'primary_category_id' => $cat->id,
        'excerpt' => 'ملخّص.',
        'content_json' => tiptapDoc(),
    ]);
    $created->assertCreated();
    $newId = $created->json('data.id');

    $this->withToken($token)->patchJson("/api/v1/admin/articles/{$newId}/status", [
        'status' => 'published',
    ])->assertOk();

    $next = $this->get('/sitemap-articles-ar.xml');
    $nextCount = substr_count($next->getContent(), '<url>');

    expect($nextCount)->toBe($firstCount + 1);
});
