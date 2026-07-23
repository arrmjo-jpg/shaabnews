<?php

declare(strict_types=1);

use App\Models\Category;
use App\Models\SportMenuItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function sportMenuAdminToken(): array
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return [$u, $u->createToken('admin-token', ['admin'])->plainTextToken];
}

function sportMenuCategory(array $attrs = []): Category
{
    return Category::create(array_merge([
        'name' => 'كرة القدم '.uniqid(),
        'locale' => 'ar',
        'status' => 'active',
    ], $attrs));
}

it('lists root menu items with their children as a tree', function (): void {
    [, $token] = sportMenuAdminToken();
    $parent = SportMenuItem::factory()->create(['title' => 'الأقسام', 'order' => 0]);
    SportMenuItem::factory()->create(['title' => 'انتقالات', 'parent_id' => $parent->id]);

    $res = $this->withToken($token)->getJson('/api/v1/admin/sport-menu-items')->assertOk();
    assertSuccessContract($res);
    expect($res->json('data.0.id'))->toBe($parent->id);
    expect($res->json('data.0.children.0.title'))->toBe('انتقالات');
});

it('creates a category-type item', function (): void {
    [, $token] = sportMenuAdminToken();
    $category = sportMenuCategory();

    $res = $this->withToken($token)->postJson('/api/v1/admin/sport-menu-items', [
        'locale' => 'ar',
        'title' => 'أخبار',
        'type' => 'category',
        'category_id' => $category->id,
    ])->assertCreated();

    assertSuccessContract($res);
    expect($res->json('data.category_id'))->toBe($category->id);
    $this->assertDatabaseHas('sport_menu_items', ['title' => 'أخبار', 'category_id' => $category->id]);
});

it('creates a section-type item', function (): void {
    [, $token] = sportMenuAdminToken();

    $res = $this->withToken($token)->postJson('/api/v1/admin/sport-menu-items', [
        'locale' => 'ar',
        'title' => 'المباريات',
        'type' => 'section',
        'section_key' => 'matches',
    ])->assertCreated();

    assertSuccessContract($res);
    expect($res->json('data.section_key'))->toBe('matches');
});

// ─── Governance (Phase 3.2 Commit 2) — section_key Enum ─────────────────
// يثبت فقط أن القيمة معترف بها من النظام؛ لا علاقة له بوجود Route/صفحة فعليّة لها (Availability
// مسؤولية منفصلة، محكومة في الواجهة العامة عبر SECTION_ROUTES).

it('accepts every recognized section_key value', function (string $key): void {
    [, $token] = sportMenuAdminToken();

    $this->withToken($token)->postJson('/api/v1/admin/sport-menu-items', [
        'locale' => 'ar', 'title' => 'test-'.$key, 'type' => 'section', 'section_key' => $key,
    ])->assertCreated();
})->with(['matches', 'results', 'competitions', 'teams', 'players', 'predictions']);

it('rejects an unrecognized section_key on create', function (): void {
    [, $token] = sportMenuAdminToken();

    $this->withToken($token)->postJson('/api/v1/admin/sport-menu-items', [
        'locale' => 'ar', 'title' => 'أخبار', 'type' => 'section', 'section_key' => 'not-a-real-key',
    ])->assertStatus(422)->assertJsonValidationErrors(['section_key']);
});

it('rejects an unrecognized section_key on update', function (): void {
    [, $token] = sportMenuAdminToken();
    $item = SportMenuItem::factory()->create(['title' => 'المباريات', 'section_key' => 'matches']);

    $this->withToken($token)
        ->putJson("/api/v1/admin/sport-menu-items/{$item->id}", ['section_key' => 'not-a-real-key'])
        ->assertStatus(422)->assertJsonValidationErrors(['section_key']);
});

it('rejects a category-type item without category_id', function (): void {
    [, $token] = sportMenuAdminToken();

    $this->withToken($token)->postJson('/api/v1/admin/sport-menu-items', [
        'locale' => 'ar', 'title' => 'أخبار', 'type' => 'category',
    ])->assertStatus(422);
});

it('rejects a category-type item that also sets section_key', function (): void {
    [, $token] = sportMenuAdminToken();
    $category = sportMenuCategory();

    $this->withToken($token)->postJson('/api/v1/admin/sport-menu-items', [
        'locale' => 'ar', 'title' => 'أخبار', 'type' => 'category',
        'category_id' => $category->id, 'section_key' => 'matches',
    ])->assertStatus(422);
});

it('updates a menu item, re-checking the XOR against the merged (existing + incoming) type', function (): void {
    [, $token] = sportMenuAdminToken();
    $item = SportMenuItem::factory()->create(['title' => 'المباريات', 'section_key' => 'matches']);

    // تحديث title فقط — type/section_key لا يُرسَلان، يجب ألا يفشل التحقّق رغم عدم إرسال type.
    $this->withToken($token)
        ->putJson("/api/v1/admin/sport-menu-items/{$item->id}", ['title' => 'المباريات المباشرة'])
        ->assertOk();

    expect($item->fresh()->title)->toBe('المباريات المباشرة');

    // محاولة إضافة category_id على عنصر section بلا تغيير type — يجب أن تُرفَض (XOR منتهَك).
    $category = sportMenuCategory();
    $this->withToken($token)
        ->putJson("/api/v1/admin/sport-menu-items/{$item->id}", ['category_id' => $category->id])
        ->assertStatus(422);
});

it('deletes a menu item', function (): void {
    [, $token] = sportMenuAdminToken();
    $item = SportMenuItem::factory()->create();

    $this->withToken($token)->deleteJson("/api/v1/admin/sport-menu-items/{$item->id}")->assertOk();
    $this->assertDatabaseMissing('sport_menu_items', ['id' => $item->id]);
});

it('reorders menu items by the given id order', function (): void {
    [, $token] = sportMenuAdminToken();
    $a = SportMenuItem::factory()->create(['order' => 0]);
    $b = SportMenuItem::factory()->create(['order' => 1]);

    $this->withToken($token)
        ->patchJson('/api/v1/admin/sport-menu-items/reorder', ['ids' => [$b->id, $a->id]])
        ->assertOk();

    expect($b->fresh()->order)->toBe(0);
    expect($a->fresh()->order)->toBe(1);
});

it('denies write access to a role without sport_menu.manage', function (): void {
    $u = User::factory()->create();
    $u->assignRole('reviewer');
    $token = $u->createToken('t', ['admin'])->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/admin/sport-menu-items', [
        'locale' => 'ar', 'title' => 'x', 'type' => 'section', 'section_key' => 'x',
    ])->assertStatus(403);
});
