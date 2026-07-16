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

function feedCat(array $attrs = []): Category
{
    return Category::create(array_merge([
        'name' => 'تصنيف '.uniqid(),
        'locale' => 'ar',
        'status' => 'active',
    ], $attrs));
}

function feedArticle(Category $primary, array $attrs = []): Article
{
    $a = Article::create(array_merge([
        'title' => 'عنوان '.uniqid(),
        'locale' => $primary->locale,
        'type' => 'news',
        'status' => 'published',
        'primary_category_id' => $primary->id,
        'author_id' => User::factory()->create()->id,
        'content_json' => tiptapDoc(),
        'content' => '<p>محتوى</p>',
        'published_at' => now()->subMinute(),
    ], $attrs));

    return $a->fresh();
}

// ─── /feed/{kind} — مدفوعة بأعلام الخبر (لا تنسيبات) ─────────────────────

it('returns the hero feed from is_featured, pinned first then newest', function (): void {
    $cat = feedCat();
    // غير مميّز — يجب ألّا يظهر في الهيرو
    feedArticle($cat, ['title' => 'عادي']);
    feedArticle($cat, ['title' => 'مميّز قديم', 'is_featured' => true, 'published_at' => now()->subDays(3)]);
    feedArticle($cat, ['title' => 'مميّز أحدث', 'is_featured' => true, 'published_at' => now()->subHour()]);
    feedArticle($cat, ['title' => 'مميّز مثبّت', 'is_featured' => true, 'is_pinned' => true, 'published_at' => now()->subWeek()]);

    $res = $this->getJson('/api/v1/ar/feed/hero');

    $res->assertOk();
    assertSuccessContract($res);
    expect($res->json('data'))->toHaveCount(3); // العادي مستبعَد
    expect($res->json('data.0.title'))->toBe('مميّز مثبّت');  // المثبَّت أولاً
    expect($res->json('data.1.title'))->toBe('مميّز أحدث');   // ثمّ الأحدث
    expect($res->json('data.2.title'))->toBe('مميّز قديم');
});

it('drives the breaking feed from is_breaking and drops unpublished', function (): void {
    $cat = feedCat();
    feedArticle($cat, ['title' => 'عاجل منشور', 'is_breaking' => true]);
    feedArticle($cat, ['title' => 'عاجل مسودّة', 'is_breaking' => true, 'status' => 'draft', 'published_at' => null]);
    feedArticle($cat, ['title' => 'غير عاجل']);

    $res = $this->getJson('/api/v1/ar/feed/breaking');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(1);
    expect($res->json('data.0.title'))->toBe('عاجل منشور');
});

it('drives header and editors_pick feeds from their flags', function (): void {
    $cat = feedCat();
    feedArticle($cat, ['title' => 'هيدر', 'is_header' => true]);
    feedArticle($cat, ['title' => 'اخترنالكم', 'is_editor_pick' => true]);

    expect($this->getJson('/api/v1/ar/feed/header')->json('data.0.title'))->toBe('هيدر');
    expect($this->getJson('/api/v1/ar/feed/editors_pick')->json('data.0.title'))->toBe('اخترنالكم');
});

it('returns latest feed by published_at desc', function (): void {
    $cat = feedCat();
    feedArticle($cat, ['title' => 'قديم', 'published_at' => now()->subDays(2)]);
    feedArticle($cat, ['title' => 'وسط', 'published_at' => now()->subDay()]);
    feedArticle($cat, ['title' => 'أحدث', 'published_at' => now()->subMinute()]);

    $res = $this->getJson('/api/v1/ar/feed/latest');

    $res->assertOk();
    expect($res->json('data.0.title'))->toBe('أحدث');
    expect($res->json('data.1.title'))->toBe('وسط');
    expect($res->json('data.2.title'))->toBe('قديم');
});

it('isolates feeds by locale', function (): void {
    $arCat = feedCat();
    $enCat = feedCat(['name' => 'cat-en', 'locale' => 'en']);
    feedArticle($arCat, ['title' => 'عربي', 'is_featured' => true]);
    feedArticle($enCat, ['title' => 'English', 'is_featured' => true]);

    expect($this->getJson('/api/v1/ar/feed/hero')->json('data.0.title'))->toBe('عربي');
    expect($this->getJson('/api/v1/en/feed/hero')->json('data.0.title'))->toBe('English');
});

it('rejects an unknown feed kind via route constraint', function (): void {
    $this->getJson('/api/v1/ar/feed/nope')->assertNotFound();
    // story أُزيلت من المنظومة — لم تعد ضمن قيد المسار
    $this->getJson('/api/v1/ar/feed/story')->assertNotFound();
});

it('honors a custom ?limit query parameter clamped to the defensive ceiling', function (): void {
    $cat = feedCat();
    for ($i = 0; $i < 8; $i++) {
        feedArticle($cat, ['title' => "art-{$i}", 'is_editor_pick' => true]);
    }

    $res = $this->getJson('/api/v1/ar/feed/editors_pick?limit=3');

    $res->assertOk();
    expect($res->json('data'))->toHaveCount(3);
});

it('does not leak admin-only fields in feed items', function (): void {
    $cat = feedCat();
    feedArticle($cat, ['is_featured' => true, 'is_breaking' => true]);

    $res = $this->getJson('/api/v1/ar/feed/hero');

    $row = $res->json('data.0');
    expect(array_keys($row))->not->toContain('content_json');
    expect(array_keys($row))->not->toContain('is_featured');
    expect(array_keys($row))->not->toContain('is_header');
    expect(array_keys($row))->not->toContain('updated_at');
});

it('attaches CDN-aware Cache-Control on feed responses', function (): void {
    $res = $this->getJson('/api/v1/ar/feed/latest');
    $res->assertOk();
    expect($res->headers->get('Cache-Control'))->toContain('public');
    expect($res->headers->get('Cache-Control'))->toContain('s-maxage=');
    expect((string) $res->headers->get('Vary'))->not->toContain('Accept-Language');
});

// ─── Cache invalidation ────────────────────────────────────────────────

it('flushes the feed cache when an article flag changes in admin', function (): void {
    $cat = feedCat();
    feedArticle($cat, ['title' => 'موجود', 'is_featured' => true]);

    // Warm cache
    $first = $this->getJson('/api/v1/ar/feed/hero');
    $first->assertOk();
    expect($first->json('data'))->toHaveCount(1);

    // Admin features another article → article write flushes feed(locale) tag
    $a2 = feedArticle($cat, ['title' => 'جديد']);
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');
    $token = $admin->createToken('admin-token', ['admin'])->plainTextToken;

    $this->withToken($token)->putJson("/api/v1/admin/articles/{$a2->id}", [
        'is_featured' => true,
    ])->assertOk();

    // Public cache must reflect the new featured article immediately
    $res = $this->getJson('/api/v1/ar/feed/hero');
    expect($res->json('data'))->toHaveCount(2);
});
