<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

/** مدير super_admin + token إداري */
function adminArticlesToken(): array
{
    $admin = User::factory()->create();
    $admin->assignRole('super_admin');

    return [$admin, $admin->createToken('admin-token', ['admin'])->plainTextToken];
}

function adminPagArticle(int $catId): Article
{
    return Article::create([
        'locale' => 'ar',
        'title' => 'Title '.uniqid(),
        'slug' => 'slug-'.uniqid(),
        'author_id' => User::factory()->create()->id,
        'primary_category_id' => $catId,
        'status' => 'published',
        'published_at' => now()->subDay(),
        'type' => 'news',
        'content' => 'content',
        'excerpt' => 'excerpt',
    ]);
}

it('caps admin articles total_pages at max_page instead of the real last page', function (): void {
    Config::set('performance.pagination.max_page', 2);
    [, $token] = adminArticlesToken();

    $cat = Category::create(['locale' => 'ar', 'name' => json_encode(['ar' => 'cap-cat']), 'slug' => 'cap-cat-admin', 'title' => 'cap-cat', 'is_active' => true]);
    for ($i = 0; $i < 5; $i++) {
        adminPagArticle($cat->id);
    }

    // real last page (5 articles / 1 per page = 5) لكن الاستجابة يجب أن تُقيَّد بـ max_page=2،
    // فلا تُرسِل الواجهة الإدارية أبداً رابط "آخر صفحة" يتجاوز ما يقبله الـ Backend فعلياً.
    $response = $this->withToken($token)
        ->getJson('/api/v1/admin/articles?per_page=1')
        ->assertOk();

    expect($response->json('meta.pagination.total_pages'))->toBe(2);
});

it('still rejects a page beyond max_page with 404', function (): void {
    Config::set('performance.pagination.max_page', 2);
    [, $token] = adminArticlesToken();

    $this->withToken($token)->getJson('/api/v1/admin/articles?page=1')->assertOk();
    $this->withToken($token)->getJson('/api/v1/admin/articles?page=3')->assertNotFound();
});
