<?php

declare(strict_types=1);

use App\Models\Article;
use App\Models\Category;
use App\Models\Entity;
use App\Models\Reel;
use App\Models\User;
use App\Models\Video;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function entityAdminToken(): array
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return [$u, $u->createToken('admin-token', ['admin'])->plainTextToken];
}

function emArticle(): Article
{
    $cat = Category::create(['name' => 'c-'.uniqid(), 'locale' => 'ar', 'status' => 'active']);

    return Article::create([
        'title' => 't-'.uniqid(), 'slug' => 'slug-'.uniqid(), 'locale' => 'ar', 'type' => 'news',
        'status' => 'draft', 'primary_category_id' => $cat->id,
        'author_id' => User::factory()->create()->id,
        'content_json' => tiptapDoc(), 'content' => '<p>x</p>',
    ]);
}

// ─── Search / typeahead ─────────────────────────────────────────────────

it('searches entities by name', function (): void {
    [, $token] = entityAdminToken();
    Entity::create(['type' => 'person', 'name' => 'أحمد الخطيب']);
    Entity::create(['type' => 'place', 'name' => 'عمّان']);

    $res = $this->withToken($token)->getJson('/api/v1/admin/entities?q='.urlencode('أحمد'));

    $res->assertOk();
    expect(collect($res->json('data'))->pluck('name'))->toContain('أحمد الخطيب');
    expect(collect($res->json('data'))->pluck('name'))->not->toContain('عمّان');
});

it('filters entities by type', function (): void {
    [, $token] = entityAdminToken();
    Entity::create(['type' => 'person', 'name' => 'شخص']);
    Entity::create(['type' => 'place', 'name' => 'مكان']);

    $res = $this->withToken($token)->getJson('/api/v1/admin/entities?type=place');

    $res->assertOk();
    expect(collect($res->json('data'))->pluck('type')->unique()->all())->toBe(['place']);
});

it('rejects an invalid entity type filter', function (): void {
    [, $token] = entityAdminToken();

    $this->withToken($token)->getJson('/api/v1/admin/entities?type=bogus')->assertStatus(422);
});

// ─── Create ──────────────────────────────────────────────────────────────

it('creates a new entity', function (): void {
    [, $token] = entityAdminToken();

    $res = $this->withToken($token)->postJson('/api/v1/admin/entities', [
        'type' => 'topic', 'name' => 'قضيّة جديدة',
    ]);

    $res->assertCreated();
    expect(Entity::where('name', 'قضيّة جديدة')->exists())->toBeTrue();
});

it('rejects creating a duplicate name+type entity', function (): void {
    [, $token] = entityAdminToken();
    Entity::create(['type' => 'person', 'name' => 'مكرّر']);

    $this->withToken($token)->postJson('/api/v1/admin/entities', [
        'type' => 'person', 'name' => 'مكرّر',
    ])->assertStatus(422);
});

it('allows the same name across different types', function (): void {
    [, $token] = entityAdminToken();
    Entity::create(['type' => 'person', 'name' => 'الأردن']);

    $this->withToken($token)->postJson('/api/v1/admin/entities', [
        'type' => 'place', 'name' => 'الأردن',
    ])->assertCreated();
});

it('denies entity creation without the permission', function (): void {
    $u = User::factory()->create();
    $u->assignRole('contributor');
    $token = $u->createToken('t', ['admin'])->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/admin/entities', [
        'type' => 'person', 'name' => 'x',
    ])->assertStatus(403);
});

// ─── Sync onto content (Article/Video/Reel) ─────────────────────────────

it('syncs entities onto an article', function (): void {
    [, $token] = entityAdminToken();
    $article = emArticle();
    $e1 = Entity::create(['type' => 'person', 'name' => 'شخص أ']);
    $e2 = Entity::create(['type' => 'place', 'name' => 'مكان ب']);

    $res = $this->withToken($token)->patchJson("/api/v1/admin/articles/{$article->id}/entities", [
        'entity_ids' => [$e1->id, $e2->id],
    ]);

    $res->assertOk();
    expect($article->entities()->count())->toBe(2);
});

it('removes entities no longer present in the sync payload', function (): void {
    [, $token] = entityAdminToken();
    $article = emArticle();
    $e1 = Entity::create(['type' => 'person', 'name' => 'شخص أ']);
    $e2 = Entity::create(['type' => 'place', 'name' => 'مكان ب']);
    $article->entities()->attach([$e1->id, $e2->id]);

    $this->withToken($token)->patchJson("/api/v1/admin/articles/{$article->id}/entities", [
        'entity_ids' => [$e1->id],
    ])->assertOk();

    expect($article->entities()->count())->toBe(1);
    expect($article->entities()->first()->id)->toBe($e1->id);
});

it('rejects syncing a non-existent entity id', function (): void {
    [, $token] = entityAdminToken();
    $article = emArticle();

    $this->withToken($token)->patchJson("/api/v1/admin/articles/{$article->id}/entities", [
        'entity_ids' => [999999],
    ])->assertStatus(422);
});

it('syncs entities onto a video', function (): void {
    [, $token] = entityAdminToken();
    $video = Video::create([
        'title' => 'v-'.uniqid(), 'slug' => 'v-'.uniqid(), 'locale' => 'ar',
        'status' => 'draft', 'author_id' => User::factory()->create()->id,
    ]);
    $e = Entity::create(['type' => 'topic', 'name' => 'موضوع فيديو']);

    $this->withToken($token)->patchJson("/api/v1/admin/videos/{$video->id}/entities", [
        'entity_ids' => [$e->id],
    ])->assertOk();

    expect($video->entities()->count())->toBe(1);
});

it('syncs entities onto a reel', function (): void {
    [, $token] = entityAdminToken();
    $reel = Reel::create([
        'title' => 'r-'.uniqid(), 'slug' => 'r-'.uniqid(), 'locale' => 'ar',
        'status' => 'draft', 'author_id' => User::factory()->create()->id,
    ]);
    $e = Entity::create(['type' => 'organization', 'name' => 'منظّمة']);

    $this->withToken($token)->patchJson("/api/v1/admin/reels/{$reel->id}/entities", [
        'entity_ids' => [$e->id],
    ])->assertOk();

    expect($reel->entities()->count())->toBe(1);
});

it('reads the currently tagged entities on an article', function (): void {
    [, $token] = entityAdminToken();
    $article = emArticle();
    $e = Entity::create(['type' => 'topic', 'name' => 'موضوع']);
    $article->entities()->attach($e->id);

    $res = $this->withToken($token)->getJson("/api/v1/admin/articles/{$article->id}/entities");

    $res->assertOk();
    expect(collect($res->json('data'))->pluck('id'))->toContain($e->id);
});

it('returns an empty list when an article has no tagged entities', function (): void {
    [, $token] = entityAdminToken();
    $article = emArticle();

    $res = $this->withToken($token)->getJson("/api/v1/admin/articles/{$article->id}/entities");

    $res->assertOk();
    expect($res->json('data'))->toBe([]);
});

it('denies syncing article entities without articles.edit', function (): void {
    $article = emArticle();
    $u = User::factory()->create();
    $u->assignRole('contributor');
    $token = $u->createToken('t', ['admin'])->plainTextToken;

    $this->withToken($token)->patchJson("/api/v1/admin/articles/{$article->id}/entities", [
        'entity_ids' => [],
    ])->assertStatus(403);
});
