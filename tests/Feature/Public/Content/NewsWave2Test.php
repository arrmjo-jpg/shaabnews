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

function w2Article(array $attrs = []): Article
{
    $cat = Category::firstOrCreate(
        ['slug' => 'w2-cat', 'locale' => 'ar'],
        ['name' => 'w2', 'status' => 'active'],
    );

    return Article::create(array_merge([
        'title' => 't-'.uniqid(),
        'slug' => 's-'.uniqid(),
        'locale' => 'ar',
        'type' => 'news',
        'status' => 'published',
        'primary_category_id' => $cat->id,
        'author_id' => User::factory()->create()->id,
        'content_json' => tiptapDoc(),
        'content' => '<p>x</p>',
        'excerpt' => 'x',
        'is_breaking' => false,
        'published_at' => now()->subDay(),
    ], $attrs))->fresh();
}

// ─── TASK 6: breaking fast lane ─────────────────────────────────────────────

it('breaking endpoint returns only breaking published articles, slim payload', function (): void {
    w2Article(['is_breaking' => true, 'title' => 'عاجل']);
    w2Article(['is_breaking' => false, 'title' => 'عادي']);

    $res = $this->getJson('/api/v1/ar/articles/breaking')->assertOk();

    expect($res->json('data'))->toHaveCount(1);
    expect($res->json('data.0'))->toHaveKeys(['id', 'title', 'slug', 'canonical_path', 'published_at', 'cover_thumb']);
    // حمولة دقيقة: لا محتوى/علاقات ثقيلة
    expect($res->json('data.0'))->not->toHaveKey('content');
});

it('breaking endpoint sets a short CDN TTL', function (): void {
    w2Article(['is_breaking' => true]);

    $res = $this->getJson('/api/v1/ar/articles/breaking')->assertOk();

    expect($res->headers->get('Cache-Control'))->toContain('s-maxage=45');
});

// ─── TASK 10: cursor pagination ─────────────────────────────────────────────

it('list supports cursor pagination for mobile (no total, next cursor present)', function (): void {
    w2Article();
    w2Article();
    w2Article();

    $res = $this->getJson('/api/v1/ar/articles?paginate=cursor&per_page=2')->assertOk();

    expect($res->json('data'))->toHaveCount(2);
    expect($res->json('meta.cursor.has_more'))->toBeTrue();
    expect($res->json('meta.cursor.next_cursor'))->not->toBeNull();
    expect($res->json('meta'))->not->toHaveKey('pagination'); // cursor mode omits offset meta
});

it('default list still uses offset pagination (total present)', function (): void {
    w2Article();

    $res = $this->getJson('/api/v1/ar/articles')->assertOk();

    expect($res->json('meta.pagination.total'))->toBe(1);
});

// ─── Production review: COUNT(*) cache TTL extended (medium, not short) ────

it('the cached total survives past the short list TTL but still refreshes eventually', function (): void {
    w2Article();
    $this->getJson('/api/v1/ar/articles')->assertOk()->assertJsonPath('meta.pagination.total', 1);

    // مقال ثانٍ يُنشأ مباشرة (لا عبر TransitionArticleStatusAction) فلا يُطلق حدث
    // إبطال بالوسم — يعزل الاختبار لتأثير الـTTL وحده، لا مسار الإبطال الآخر.
    w2Article();

    $this->travel(6)->minutes();
    $this->getJson('/api/v1/ar/articles')->assertOk()->assertJsonPath('meta.pagination.total', 1);

    $this->travel(25)->minutes(); // مجموع ٣١ دقيقة — تجاوز MEDIUM (٣٠ دقيقة)
    $this->getJson('/api/v1/ar/articles')->assertOk()->assertJsonPath('meta.pagination.total', 2);
});

// ─── TASK 9: differentiated CDN TTL on detail ───────────────────────────────

it('recent article detail gets the medium-long detail TTL', function (): void {
    $a = w2Article(['published_at' => now()->subDay()]);

    $res = $this->getJson("/api/v1/ar/articles/{$a->slug}")->assertOk();

    expect($res->headers->get('Cache-Control'))->toContain('s-maxage=1800');
});

it('archived (old) article detail gets the long archive TTL', function (): void {
    $a = w2Article(['published_at' => now()->subDays(60)]);

    $res = $this->getJson("/api/v1/ar/articles/{$a->slug}")->assertOk();

    expect($res->headers->get('Cache-Control'))->toContain('s-maxage=86400');
});
