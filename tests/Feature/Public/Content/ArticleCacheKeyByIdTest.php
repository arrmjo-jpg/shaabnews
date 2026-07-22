<?php

declare(strict_types=1);

use App\Actions\Admin\Content\UpdateArticleAction;
use App\Models\Article;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

// إصلاح جذريّ (2026-07-18): كان الكاش يُبنى بمفتاح/وسم من *النص الوارد كما هو* في الرابط
// (id مجرّد، أو id-slug، أو slug خام) — فأي شكل غير الشكل الحرفيّ المُستخدَم وقت الكتابة
// كان يبقى عالقاً بلا إبطال إلى الأبد. هذا الاختبار يُعيد إنتاج البرهان الحيّ الذي أثبت
// العطل هذه الجلسة (المقال 343745) آلياً: يضرب المقال بثلاثة أشكال روابط مختلفة، يحدّثه،
// ثم يتأكّد أن الثلاثة تعكس التحديث فوراً — لو عاد أيّ شكل بالعنوان القديم فالعطل عاد.

beforeEach(function (): void {
    seedRoles();
    Cache::flush();
});

function cacheKeyArticle(): Article
{
    $author = User::factory()->create();
    $category = Category::create([
        'name' => 'cat-'.uniqid(),
        'slug' => 'cat-'.uniqid(),
        'locale' => 'ar',
        'status' => 'active',
    ]);

    return Article::create([
        'author_id' => $author->id,
        'primary_category_id' => $category->id,
        'type' => 'news',
        'status' => 'published',
        'locale' => 'ar',
        'title' => 'عنوان أصليّ',
        'slug' => 'original-slug-'.uniqid(),
        'excerpt' => 'ملخّص',
        'content' => 'محتوى',
        'published_at' => now()->subDay(),
    ]);
}

it('serves the same, freshly-invalidated title regardless of which URL shape resolved the article', function (): void {
    $article = cacheKeyArticle();
    $idSlugPath = "/api/v1/ar/articles/{$article->id}-{$article->slug}";
    $bareIdPath = "/api/v1/ar/articles/{$article->id}";
    $bareSlugPath = "/api/v1/ar/articles/{$article->slug}";

    // ابدأ بتخزين الشكلين الثلاثة مسبقاً — يُقلِّد ما يحدث فعلياً حين يزور مستخدمون
    // مختلفون نفس المقال عبر روابط مختلفة (رابط داخليّ id-slug، رابط قديم مقتصَّ، إلخ).
    foreach ([$idSlugPath, $bareIdPath, $bareSlugPath] as $path) {
        $this->getJson($path)->assertOk()->assertJsonPath('data.title', 'عنوان أصليّ');
    }

    $actor = User::factory()->create();
    $actor->assignRole('super_admin');
    $resp = (new UpdateArticleAction)->handle($article->fresh(), ['title' => 'عنوان محدَّث'], $actor);
    expect($resp->getStatusCode())->toBe(200);

    // الثلاثة يجب أن تعكس العنوان الجديد فوراً — بلا انتظار انتهاء أي TTL.
    foreach ([$idSlugPath, $bareIdPath, $bareSlugPath] as $path) {
        $this->getJson($path)->assertOk()->assertJsonPath('data.title', 'عنوان محدَّث');
    }
});

it('tags the Laravel-side detail cache by article id, identically across input shapes', function (): void {
    $article = cacheKeyArticle();

    // نفس منطق ArticleCacheTags::writeTags() — الوسم يجب أن يبنى من id لا من slug.
    $tags = App\Support\Cache\ArticleCacheTags::writeTags($article->fresh());
    expect($tags)->toContain('articles:detail:ar:'.$article->id);
    expect($tags)->not->toContain('articles:detail:ar:'.$article->slug);
});
