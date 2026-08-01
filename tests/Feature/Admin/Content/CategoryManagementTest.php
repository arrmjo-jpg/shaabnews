<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\Category;
use App\Models\MediaAsset;
use App\Models\Role;
use App\Models\User;
use App\Support\Cache\CacheKeys;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Spatie\Permission\PermissionRegistrar;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function catAdminToken(): array
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return [$u, $u->createToken('admin-token', ['admin'])->plainTextToken];
}

function makeCategory(array $attrs = []): Category
{
    return Category::create(array_merge([
        'name' => 'تصنيف '.uniqid(),
        'locale' => 'ar',
        'status' => 'active',
    ], $attrs));
}

// ─── Listing / contract ────────────────────────────────────────────────

it('lists categories as a tree for an authorized admin', function (): void {
    [, $token] = catAdminToken();
    $root = makeCategory(['name' => 'رياضة']);
    makeCategory(['name' => 'كرة قدم', 'parent_id' => $root->id]);

    $res = $this->withToken($token)->getJson('/api/v1/admin/categories');

    $res->assertOk();
    assertSuccessContract($res);
    expect($res->json('data.0.children.0.name'))->toBe('كرة قدم');
});

// ─── Create + Arabic slug ──────────────────────────────────────────────

it('creates a root category with an Arabic slug', function (): void {
    [, $token] = catAdminToken();

    $res = $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'سياسة', 'locale' => 'ar',
    ])->assertCreated();

    expect($res->json('data.slug'))->toBe('سياسة');
    expect(Category::where('name', 'سياسة')->exists())->toBeTrue();
});

it('creates a child category (depth 2)', function (): void {
    [, $token] = catAdminToken();
    $root = makeCategory(['name' => 'رياضة']);

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'كرة قدم', 'locale' => 'ar', 'parent_id' => $root->id,
    ])->assertCreated();
});

// ─── Hierarchy invariants (ADR A5 depth=3, A3.4 locale) ────────────────

it('rejects exceeding MAX_DEPTH = 3', function (): void {
    [, $token] = catAdminToken();
    $l1 = makeCategory(['name' => 'L1']);
    $l2 = makeCategory(['name' => 'L2', 'parent_id' => $l1->id]);
    $l3 = makeCategory(['name' => 'L3', 'parent_id' => $l2->id]);

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'L4', 'locale' => 'ar', 'parent_id' => $l3->id,
    ])->assertStatus(422);

    expect(Category::where('name', 'L4')->exists())->toBeFalse();
});

it('rejects self-parent on update', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory();

    $this->withToken($token)->putJson("/api/v1/admin/categories/{$c->id}", [
        'parent_id' => $c->id,
    ])->assertStatus(422);
});

it('rejects circular hierarchy (parent set to own descendant)', function (): void {
    [, $token] = catAdminToken();
    $root = makeCategory(['name' => 'Root']);
    $child = makeCategory(['name' => 'Child', 'parent_id' => $root->id]);

    $this->withToken($token)->putJson("/api/v1/admin/categories/{$root->id}", [
        'parent_id' => $child->id,
    ])->assertStatus(422);
});

it('rejects a parent in a different locale', function (): void {
    [, $token] = catAdminToken();
    $arParent = makeCategory(['name' => 'عربي', 'locale' => 'ar']);

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'English child', 'locale' => 'en', 'parent_id' => $arParent->id,
    ])->assertStatus(422);
});

// ─── Slug uniqueness per locale ────────────────────────────────────────

it('allows the same slug across different locales but not within one', function (): void {
    [, $token] = catAdminToken();

    $a = $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'News', 'locale' => 'ar',
    ])->json('data.slug');

    $b = $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'News', 'locale' => 'en',
    ])->json('data.slug');

    $c = $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'News', 'locale' => 'ar',
    ])->json('data.slug');

    expect($a)->toBe($b);          // same slug, different locale → OK
    expect($c)->not->toBe($a);     // same locale → uniquified
});

// ─── Delete guards + soft delete ───────────────────────────────────────

it('refuses to delete a category that has children', function (): void {
    [, $token] = catAdminToken();
    $root = makeCategory();
    makeCategory(['parent_id' => $root->id]);

    $this->withToken($token)->deleteJson("/api/v1/admin/categories/{$root->id}")
        ->assertStatus(422);
});

it('soft-deletes a leaf category', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory();

    $this->withToken($token)->deleteJson("/api/v1/admin/categories/{$c->id}")
        ->assertOk();

    expect(Category::withTrashed()->find($c->id)->trashed())->toBeTrue();
});

// ─── Authorization ─────────────────────────────────────────────────────

it('denies category access without a token', function (): void {
    $this->getJson('/api/v1/admin/categories')->assertStatus(401);
});

it('denies category create without the permission', function (): void {
    $role = Role::findByName('reviewer', 'web');
    $role->givePermissionTo('categories.view');
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $u = User::factory()->create();
    $u->assignRole('reviewer');
    $token = $u->createToken('admin-token', ['admin'])->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'X', 'locale' => 'ar',
    ])->assertStatus(403);
});

// ─── Cache invalidation ────────────────────────────────────────────────

it('caches the admin tree and invalidates it on write', function (): void {
    [, $token] = catAdminToken();

    $this->withToken($token)->getJson('/api/v1/admin/categories')->assertOk();
    expect(Cache::tags(['categories'])->has(CacheKeys::categoriesTreeAdmin()))->toBeTrue();

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'جديد', 'locale' => 'ar',
    ])->assertCreated();

    expect(Cache::tags(['categories'])->has(CacheKeys::categoriesTreeAdmin()))->toBeFalse();
});

// ─── Public read endpoint ──────────────────────────────────────────────

it('public endpoint returns only active categories for the locale', function (): void {
    makeCategory(['name' => 'ظاهر', 'locale' => 'ar', 'status' => 'active']);
    makeCategory(['name' => 'مخفي', 'locale' => 'ar', 'status' => 'hidden']);
    makeCategory(['name' => 'english', 'locale' => 'en', 'status' => 'active']);

    $res = $this->getJson('/api/v1/ar/categories');

    $res->assertOk();
    $names = collect($res->json('data'))->pluck('name');
    expect($names)->toContain('ظاهر');
    expect($names)->not->toContain('مخفي');
    expect($names)->not->toContain('english');
});

// ─── Manual slug override validation (Fix 1) ───────────────────────────

it('accepts a valid manual slug override', function (): void {
    [, $token] = catAdminToken();

    $res = $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'سياسة محلية', 'locale' => 'ar', 'slug' => 'local-politics',
    ])->assertCreated();

    expect($res->json('data.slug'))->toBe('local-politics');
});

it('rejects a duplicate manual slug within the same locale with 422 (no DB 500)', function (): void {
    [, $token] = catAdminToken();
    makeCategory(['name' => 'A', 'locale' => 'ar', 'slug' => 'dup-slug']);

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'B', 'locale' => 'ar', 'slug' => 'dup-slug',
    ])->assertStatus(422)->assertJsonValidationErrors(['slug']);
});

it('rejects a duplicate manual slug even when the existing one is soft-deleted', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory(['name' => 'Trashed', 'locale' => 'ar', 'slug' => 'gone']);
    $c->delete();

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'New', 'locale' => 'ar', 'slug' => 'gone',
    ])->assertStatus(422)->assertJsonValidationErrors(['slug']);
});

it('allows the same manual slug across different locales', function (): void {
    [, $token] = catAdminToken();
    makeCategory(['name' => 'Shared AR', 'locale' => 'ar', 'slug' => 'shared']);

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'Shared EN', 'locale' => 'en', 'slug' => 'shared',
    ])->assertCreated();
});

it('rejects a malformed manual slug (spaces / symbols)', function (): void {
    [, $token] = catAdminToken();

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'Bad', 'locale' => 'ar', 'slug' => 'bad slug!',
    ])->assertStatus(422)->assertJsonValidationErrors(['slug']);
});

it('accepts an Arabic manual slug', function (): void {
    [, $token] = catAdminToken();

    $res = $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'اقتصاد', 'locale' => 'ar', 'slug' => 'اقتصاد-محلي',
    ])->assertCreated();

    expect($res->json('data.slug'))->toBe('اقتصاد-محلي');
});

it('rejects a duplicate manual slug on update within the same locale', function (): void {
    [, $token] = catAdminToken();
    makeCategory(['name' => 'First', 'locale' => 'ar', 'slug' => 'first-one']);
    $second = makeCategory(['name' => 'Second', 'locale' => 'ar', 'slug' => 'second-one']);

    $this->withToken($token)->putJson("/api/v1/admin/categories/{$second->id}", [
        'slug' => 'first-one',
    ])->assertStatus(422)->assertJsonValidationErrors(['slug']);
});

it('allows keeping the same slug on self-update (ignore current)', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory(['name' => 'Keep', 'locale' => 'ar', 'slug' => 'keep-me']);

    $this->withToken($token)->putJson("/api/v1/admin/categories/{$c->id}", [
        'slug' => 'keep-me', 'name' => 'Keep Updated',
    ])->assertOk();
});

it('leaves the slug untouched when the field is omitted from the update', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory(['name' => 'Untouched', 'locale' => 'ar', 'slug' => 'untouched-slug']);

    $res = $this->withToken($token)->putJson("/api/v1/admin/categories/{$c->id}", [
        'name' => 'Untouched Renamed',
    ])->assertOk();

    expect($res->json('data.slug'))->toBe('untouched-slug');
    expect($c->fresh()->slug)->toBe('untouched-slug');
});

it('updates the category with a new manual slug', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory(['name' => 'Renamed', 'locale' => 'ar', 'slug' => 'old-slug']);

    $res = $this->withToken($token)->putJson("/api/v1/admin/categories/{$c->id}", [
        'slug' => 'new-slug',
    ])->assertOk();

    expect($res->json('data.slug'))->toBe('new-slug');
    expect($c->fresh()->slug)->toBe('new-slug');
});

it('regenerates the slug from the current name when cleared to empty on update', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory(['name' => 'Regenerated Category', 'locale' => 'ar', 'slug' => 'manual-slug']);

    $res = $this->withToken($token)->putJson("/api/v1/admin/categories/{$c->id}", [
        'slug' => '',
    ])->assertOk();

    $expected = Category::arabicSlug('Regenerated Category', '-');
    expect($res->json('data.slug'))->toBe($expected);
    expect($c->fresh()->slug)->toBe($expected);
});

// ─── Reorder among siblings (move up/down) ─────────────────────────────

it('reorders a sibling up by swapping with its neighbor', function (): void {
    [, $token] = catAdminToken();
    $a = makeCategory(['name' => 'A']);
    $b = makeCategory(['name' => 'B']);
    $c = makeCategory(['name' => 'C']);

    $this->withToken($token)->patchJson("/api/v1/admin/categories/{$c->id}/move", [
        'direction' => 'up',
    ])->assertOk();

    $names = collect($this->withToken($token)->getJson('/api/v1/admin/categories')->json('data'))
        ->pluck('name')->all();

    expect($names)->toBe(['A', 'C', 'B']);
    expect([$a->id, $b->id])->not->toBeEmpty();
});

it('treats moving the first sibling up as a no-op success', function (): void {
    [, $token] = catAdminToken();
    $a = makeCategory(['name' => 'A']);
    makeCategory(['name' => 'B']);

    $this->withToken($token)->patchJson("/api/v1/admin/categories/{$a->id}/move", [
        'direction' => 'up',
    ])->assertOk();

    $names = collect($this->withToken($token)->getJson('/api/v1/admin/categories')->json('data'))
        ->pluck('name')->all();
    expect($names)->toBe(['A', 'B']);
});

it('rejects an invalid move direction', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory();

    $this->withToken($token)->patchJson("/api/v1/admin/categories/{$c->id}/move", [
        'direction' => 'sideways',
    ])->assertStatus(422)->assertJsonValidationErrors(['direction']);
});

// ─── Bulk status / visibility ──────────────────────────────────────────

it('bulk-updates status and visibility across categories', function (): void {
    [, $token] = catAdminToken();
    $a = makeCategory(['name' => 'A', 'status' => 'active', 'show_in_header' => true]);
    $b = makeCategory(['name' => 'B', 'status' => 'active', 'show_in_header' => true]);

    $res = $this->withToken($token)->patchJson('/api/v1/admin/categories/bulk', [
        'ids' => [$a->id, $b->id],
        'status' => 'hidden',
        'show_in_header' => false,
    ])->assertOk();

    expect($res->json('data.updated'))->toBe(2);
    expect(Category::find($a->id)->status->value)->toBe('hidden');
    expect(Category::find($b->id)->show_in_header)->toBeFalse();
});

it('rejects a bulk update with no editable fields', function (): void {
    [, $token] = catAdminToken();
    $a = makeCategory();

    $this->withToken($token)->patchJson('/api/v1/admin/categories/bulk', [
        'ids' => [$a->id],
    ])->assertStatus(422);
});

// ─── Restore + permanent delete ────────────────────────────────────────

it('restores a soft-deleted category', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory(['name' => 'مسترجَع']);
    $c->delete();

    $this->withToken($token)->postJson("/api/v1/admin/categories/{$c->id}/restore")
        ->assertOk();

    expect(Category::find($c->id))->not->toBeNull();
    expect(Category::find($c->id)->trashed())->toBeFalse();
});

it('refuses to restore a category whose parent is still trashed', function (): void {
    [, $token] = catAdminToken();
    $parent = makeCategory(['name' => 'أب']);
    $child = makeCategory(['name' => 'ابن', 'parent_id' => $parent->id]);

    $child->delete();
    $parent->delete(); // صار ورقة بعد حذف الابن

    // استرجاع الابن يفشل — الأب محذوف.
    $this->withToken($token)->postJson("/api/v1/admin/categories/{$child->id}/restore")
        ->assertStatus(422);

    // بعد استرجاع الأب، يُسترجَع الابن.
    $this->withToken($token)->postJson("/api/v1/admin/categories/{$parent->id}/restore")->assertOk();
    $this->withToken($token)->postJson("/api/v1/admin/categories/{$child->id}/restore")->assertOk();
});

it('rejects restoring a category that is not trashed', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory();

    $this->withToken($token)->postJson("/api/v1/admin/categories/{$c->id}/restore")
        ->assertStatus(422);
});

it('lists trashed categories', function (): void {
    [, $token] = catAdminToken();
    $a = makeCategory(['name' => 'حيّ']);
    $b = makeCategory(['name' => 'محذوف']);
    $b->delete();

    $res = $this->withToken($token)->getJson('/api/v1/admin/categories/trashed')->assertOk();
    $names = collect($res->json('data'))->pluck('name');

    expect($names)->toContain('محذوف');
    expect($names)->not->toContain('حيّ');
    expect([$a->id])->not->toBeEmpty();
});

it('permanently deletes a trashed category with no articles', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory();
    $c->delete();

    $this->withToken($token)->deleteJson("/api/v1/admin/categories/{$c->id}/force")
        ->assertOk();

    expect(Category::withTrashed()->find($c->id))->toBeNull();
});

it('blocks permanent delete while the category is a primary category of articles', function (): void {
    [, $token] = catAdminToken();
    $cat = makeCategory();
    Article::create([
        'title' => 'خبر '.uniqid(), 'locale' => 'ar', 'type' => 'news', 'status' => 'published',
        'primary_category_id' => $cat->id, 'author_id' => User::factory()->create()->id,
        'content_json' => ['type' => 'doc', 'content' => []], 'content' => '<p>x</p>',
        'published_at' => now(),
    ]);
    $cat->delete();

    $this->withToken($token)->deleteJson("/api/v1/admin/categories/{$cat->id}/force")
        ->assertStatus(422);

    expect(Category::withTrashed()->find($cat->id))->not->toBeNull();
});

it('denies restore without the categories.restore permission', function (): void {
    $role = Role::findByName('reviewer', 'web');
    $role->givePermissionTo('categories.view');
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $u = User::factory()->create();
    $u->assignRole('reviewer');
    $token = $u->createToken('t', ['admin'])->plainTextToken;

    $c = makeCategory();
    $c->delete();

    $this->withToken($token)->postJson("/api/v1/admin/categories/{$c->id}/restore")
        ->assertStatus(403);
});

// ─── Section Design System (banner/show_title/layout_type/appearance) ─────

function catBannerAsset(): MediaAsset
{
    return MediaAsset::create([
        'uuid' => 'cat-banner-'.uniqid(),
        'disk' => 'public',
        'path' => 'assets/x/banner.jpg',
        'filename' => 'banner.jpg',
        'original_name' => 'banner.jpg',
        'extension' => 'jpg',
        'size' => 2048,
        'mime_type' => 'image/jpeg',
        'processing_status' => 'ready',
        'visibility' => 'public',
    ]);
}

it('creates a category with section design fields and returns them', function (): void {
    [, $token] = catAdminToken();
    $banner = catBannerAsset();

    $res = $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'كأس العالم', 'locale' => 'ar',
        'banner_media_id' => $banner->id,
        'show_title' => false,
        'layout_type' => 'hero',
        'appearance' => ['border' => ['enabled' => true, 'width' => 4, 'color' => '#A80101']],
    ])->assertCreated();

    expect($res->json('data.banner_media_id'))->toBe($banner->id);
    expect($res->json('data.banner_url'))->not->toBeNull();
    expect($res->json('data.show_title'))->toBeFalse();
    expect($res->json('data.layout_type'))->toBe('hero');
    expect($res->json('data.appearance.border.color'))->toBe('#A80101');
});

it('defaults section design fields when omitted on create', function (): void {
    [, $token] = catAdminToken();

    $res = $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'افتراضي', 'locale' => 'ar',
    ])->assertCreated();

    expect($res->json('data.banner_media_id'))->toBeNull();
    expect($res->json('data.show_title'))->toBeTrue();
    expect($res->json('data.layout_type'))->toBe('default');
    expect($res->json('data.appearance'))->toBeNull();
});

it('updates section design fields and records an activity_log entry (model-audit)', function (): void {
    [, $token] = catAdminToken();
    $c = makeCategory(['name' => 'قسم']);

    $this->withToken($token)->putJson("/api/v1/admin/categories/{$c->id}", [
        'layout_type' => 'magazine',
        'show_title' => false,
    ])->assertOk();

    expect(Category::find($c->id)->layout_type->value)->toBe('magazine');
    $this->assertDatabaseHas('activity_log', [
        'log_name' => 'category',
        'subject_id' => $c->id,
        'event' => 'updated',
    ]);
});

it('rejects an invalid layout_type', function (): void {
    [, $token] = catAdminToken();

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'X', 'locale' => 'ar', 'layout_type' => 'nonsense',
    ])->assertStatus(422)->assertJsonValidationErrors(['layout_type']);
});

it('rejects a non-existent banner_media_id', function (): void {
    [, $token] = catAdminToken();

    $this->withToken($token)->postJson('/api/v1/admin/categories', [
        'name' => 'X', 'locale' => 'ar', 'banner_media_id' => 999999,
    ])->assertStatus(422)->assertJsonValidationErrors(['banner_media_id']);
});
