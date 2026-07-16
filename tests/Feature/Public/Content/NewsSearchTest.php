<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
    Cache::flush();
    Artisan::call('scout:sync-index-settings');
});

function searchArticle(string $locale, string $title, string $bodyHtml): Article
{
    $cat = Category::firstOrCreate(
        ['slug' => "sc-{$locale}", 'locale' => $locale],
        ['name' => 'sc', 'status' => 'active'],
    );

    return Article::create([
        'title' => $title,
        'slug' => 'sl-'.uniqid(),
        'locale' => $locale,
        'type' => 'news',
        'status' => 'published',
        'primary_category_id' => $cat->id,
        'author_id' => User::factory()->create()->id,
        'content_json' => tiptapDoc(),
        'content' => $bodyHtml,
        'excerpt' => 'ملخّص',
        'published_at' => now()->subDay(),
    ])->fresh();
}

it('finds articles by BODY text via Scout (not just title)', function (): void {
    searchArticle('ar', 'عنوان عام أول', '<p>وقع زلزال قوي في المنطقة الشرقية اليوم.</p>');
    searchArticle('ar', 'عنوان عام ثاني', '<p>أخبار رياضية متنوّعة.</p>');

    $res = $this->getJson('/api/v1/ar/articles?filter[q]=زلزال')->assertOk();

    expect($res->json('data'))->toHaveCount(1);
    expect($res->json('data.0.title'))->toBe('عنوان عام أول');
});

it('isolates search results by locale', function (): void {
    searchArticle('ar', 'مقال عربي', '<p>كلمة مميزة فريدة هنا.</p>');
    searchArticle('en', 'English article', '<p>uniquekeyword appears here.</p>');

    // البحث بالكلمة الإنجليزية تحت ar يجب ألّا يُرجع مقال en
    $res = $this->getJson('/api/v1/ar/articles?filter[q]=uniquekeyword')->assertOk();

    expect($res->json('data'))->toHaveCount(0);
});

it('still matches on the title', function (): void {
    searchArticle('ar', 'الاقتصاد الوطني ينمو', '<p>تفاصيل.</p>');
    searchArticle('ar', 'رياضة', '<p>تفاصيل أخرى.</p>');

    $res = $this->getJson('/api/v1/ar/articles?filter[q]=الاقتصاد')->assertOk();

    expect($res->json('data'))->toHaveCount(1);
    expect($res->json('data.0.title'))->toBe('الاقتصاد الوطني ينمو');
});

it('returns an empty set for a non-matching query (no 500)', function (): void {
    searchArticle('ar', 'عنوان', '<p>محتوى.</p>');

    $res = $this->getJson('/api/v1/ar/articles?filter[q]=لا_يوجد_مطابق_xyz')->assertOk();

    expect($res->json('data'))->toHaveCount(0);
});

it('combines search with a category filter', function (): void {
    $a = searchArticle('ar', 'خبر مهم', '<p>محتوى يحوي كلمة بحثية.</p>');
    searchArticle('ar', 'خبر آخر', '<p>محتوى يحوي كلمة بحثية أيضاً.</p>');

    $catSlug = $a->primaryCategory->slug;
    $res = $this->getJson("/api/v1/ar/articles?filter[q]=بحثية&filter[category]={$catSlug}")->assertOk();

    // كلاهما في نفس التصنيف ويطابقان البحث
    expect(count($res->json('data')))->toBeGreaterThanOrEqual(1);
});
