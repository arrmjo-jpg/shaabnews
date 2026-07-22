<?php

declare(strict_types=1);

use App\Actions\Admin\Media\StoreMediaAssetAction;
use App\Models\Article;
use App\Models\ArticleRevision;
use App\Models\ArticleUrlHistory;
use App\Models\Category;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\PermissionRegistrar;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function articleAdminToken(): array
{
    $u = User::factory()->create();
    $u->assignRole('super_admin');

    return [$u, $u->createToken('admin-token', ['admin'])->plainTextToken];
}

function makeCat(array $attrs = []): Category
{
    return Category::create(array_merge([
        'name' => 'تصنيف '.uniqid(),
        'locale' => 'ar',
        'status' => 'active',
    ], $attrs));
}

function adminArticlePayload(Category $primary, array $o = []): array
{
    return array_merge([
        'title' => 'عنوان المقال',
        'locale' => 'ar',
        'type' => 'news',
        'primary_category_id' => $primary->id,
        'excerpt' => 'ملخّص تحريري قصير للاختبار.',
        'content_json' => tiptapDoc(),
    ], $o);
}

// ─── Create ────────────────────────────────────────────────────────────

it('creates a draft article with author + Arabic slug', function (): void {
    [$admin, $token] = articleAdminToken();
    $cat = makeCat(['name' => 'سياسة']);

    $res = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat))
        ->assertCreated();

    expect($res->json('data.status'))->toBe('draft');
    expect($res->json('data.slug'))->toBe('عنوان-المقال');
    $a = Article::first();
    expect($a->author_id)->toBe($admin->id);
    expect($a->primary_category_id)->toBe($cat->id);
});

it('persists and exposes the is_pinned flag on create and update', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();

    $res = $this->withToken($token)
        ->postJson('/api/v1/admin/articles', adminArticlePayload($cat, ['slug' => 'pin-1', 'is_pinned' => true]))
        ->assertCreated();
    expect($res->json('data.is_pinned'))->toBeTrue();
    expect(Article::first()->is_pinned)->toBeTrue();

    $id = $res->json('data.id');
    $upd = $this->withToken($token)
        ->putJson("/api/v1/admin/articles/{$id}", ['is_pinned' => false])
        ->assertOk();
    expect($upd->json('data.is_pinned'))->toBeFalse();
});

it('allows creating without an excerpt (the UI auto-fills it from the body)', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();

    $payload = adminArticlePayload($cat);
    unset($payload['excerpt']); // الموجز اختياريّ — تُعبّئه الواجهة من أوّل سطرين

    $this->withToken($token)->postJson('/api/v1/admin/articles', $payload)
        ->assertCreated();

    expect(Article::first()->excerpt)->toBeNull();
});

it('writes an initial revision on create', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();

    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat))
        ->assertCreated();

    expect(ArticleRevision::count())->toBe(1);
});

it('attaches up to 3 secondary categories', function (): void {
    [, $token] = articleAdminToken();
    $p = makeCat(['name' => 'رئيسي']);
    $s = collect(range(1, 3))->map(fn ($i) => makeCat(['name' => "ثانوي{$i}"]))->pluck('id')->all();

    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($p, [
        'secondary_category_ids' => $s,
    ]))->assertCreated();

    expect(Article::first()->categories()->count())->toBe(3);
});

it('attaches more than 3 categories (unified model — no cap)', function (): void {
    [, $token] = articleAdminToken();
    $p = makeCat();
    $s = collect(range(1, 4))->map(fn ($i) => makeCat())->pluck('id')->all();

    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($p, [
        'secondary_category_ids' => $s,
    ]))->assertCreated();

    expect(Article::first()->categories()->count())->toBe(4);
});

// ─── Category filter matches primary OR secondary (multi-category) ──────

it('filters articles by category across primary AND secondary links', function (): void {
    [, $token] = articleAdminToken();
    $primary = makeCat(['name' => 'رئيسي']);
    $secondary = makeCat(['name' => 'ثانوي']);
    $other = makeCat(['name' => 'آخر']);

    // مقال رئيسيه «رئيسي» وثانويه «ثانوي».
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($primary, [
        'title' => 'خبر متعدّد الأقسام',
        'secondary_category_ids' => [$secondary->id],
    ]))->assertCreated();

    // يظهر عند الفلترة على القسم الرئيسي.
    $byPrimary = $this->withToken($token)
        ->getJson("/api/v1/admin/articles?filter[category]={$primary->id}")->assertOk();
    expect(collect($byPrimary->json('data'))->pluck('title'))->toContain('خبر متعدّد الأقسام');

    // وأيضاً عند الفلترة على القسم الثانوي (هذا هو الإصلاح المطلوب).
    $bySecondary = $this->withToken($token)
        ->getJson("/api/v1/admin/articles?filter[category]={$secondary->id}")->assertOk();
    expect(collect($bySecondary->json('data'))->pluck('title'))->toContain('خبر متعدّد الأقسام');

    // ولا يظهر تحت قسم لا ينتمي إليه.
    $byOther = $this->withToken($token)
        ->getJson("/api/v1/admin/articles?filter[category]={$other->id}")->assertOk();
    expect($byOther->json('data'))->toBeEmpty();
});

// ─── ADR A3 invariants ─────────────────────────────────────────────────

it('rejects a primary category in a different locale (A3.4)', function (): void {
    [, $token] = articleAdminToken();
    $enCat = makeCat(['locale' => 'en']);

    $this->withToken($token)->postJson('/api/v1/admin/articles', [
        'title' => 'Arabic article', 'locale' => 'ar', 'type' => 'news',
        'primary_category_id' => $enCat->id, 'content_json' => tiptapDoc(),
    ])->assertStatus(422);
});

it('accepts any parent/child mix of categories (no deepest rule)', function (): void {
    [, $token] = articleAdminToken();
    $parent = makeCat(['name' => 'رياضة']);
    $child = makeCat(['name' => 'كرة', 'parent_id' => $parent->id]);

    // كلا الترتيبين مقبول الآن — لا قاعدة «الأعمق».
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($parent, [
        'secondary_category_ids' => [$child->id],
    ]))->assertCreated();
});

it('accepts a child as the first category with its parent too', function (): void {
    [, $token] = articleAdminToken();
    $parent = makeCat(['name' => 'رياضة']);
    $child = makeCat(['name' => 'كرة', 'parent_id' => $parent->id]);

    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($child, [
        'secondary_category_ids' => [$parent->id],
    ]))->assertCreated();
});

it('persists the editor-pick display flag', function (): void {
    [, $token] = articleAdminToken();

    $res = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload(makeCat(), [
        'is_editor_pick' => true,
    ]))->assertCreated();

    expect($res->json('data.is_editor_pick'))->toBeTrue();
    expect(Article::find($res->json('data.id'))->is_editor_pick)->toBeTrue();
});

// ─── Dedicated OG image + latest-updates filter ───────────────────────

it('attaches a dedicated og image to an article', function (): void {
    [$admin, $token] = articleAdminToken();
    Storage::fake('uploads');
    config(['media-library.disk_name' => 'uploads']);

    $asset = (new StoreMediaAssetAction)->handle(
        UploadedFile::fake()->image('og.jpg', 1200, 630),
        $admin,
    );

    $res = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload(makeCat(), [
        'og_image_id' => $asset->id,
    ]))->assertCreated();

    expect($res->json('data.og_image_id'))->toBe($asset->id);
    expect($res->json('data.og_image'))->not->toBeNull();
});

it('filters articles by the latest-updates (is_header) flag', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, [
        'slug' => 'hdr-1', 'is_header' => true,
    ]))->assertCreated();
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, [
        'slug' => 'hdr-2',
    ]))->assertCreated();

    $res = $this->withToken($token)->getJson('/api/v1/admin/articles?filter[is_header]=1')->assertOk();
    expect($res->json('meta.pagination.total'))->toBe(1);
});

// ─── Live event status ────────────────────────────────────────────────

it('defaults a live article to scheduled and updates the event status', function (): void {
    [, $token] = articleAdminToken();

    $id = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload(makeCat(), [
        'type' => 'live', 'slug' => 'live-evt',
    ]))->assertCreated()->json('data.id');

    expect(Article::find($id)->event_status->value)->toBe('scheduled');

    $res = $this->withToken($token)->putJson("/api/v1/admin/articles/{$id}", [
        'event_status' => 'live',
    ])->assertOk();

    expect($res->json('data.event_status'))->toBe('live');
});

// ─── Soft-delete restore + permanent delete ───────────────────────────

it('restores a soft-deleted article', function (): void {
    [, $token] = articleAdminToken();
    $id = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload(makeCat()))
        ->assertCreated()->json('data.id');

    $this->withToken($token)->deleteJson("/api/v1/admin/articles/{$id}")->assertOk();
    expect(Article::find($id))->toBeNull();

    $this->withToken($token)->postJson("/api/v1/admin/articles/{$id}/restore")->assertOk();
    expect(Article::find($id))->not->toBeNull();
});

it('permanently deletes a trashed article', function (): void {
    [, $token] = articleAdminToken();
    $id = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload(makeCat()))
        ->assertCreated()->json('data.id');

    $this->withToken($token)->deleteJson("/api/v1/admin/articles/{$id}")->assertOk();
    $this->withToken($token)->deleteJson("/api/v1/admin/articles/{$id}/force")->assertOk();

    expect(Article::withTrashed()->find($id))->toBeNull();
});

it('lists only trashed articles with trashed=only', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, ['slug' => 'st-a']))
        ->assertCreated();
    $id2 = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, ['slug' => 'st-b']))
        ->assertCreated()->json('data.id');
    $this->withToken($token)->deleteJson("/api/v1/admin/articles/{$id2}")->assertOk();

    $res = $this->withToken($token)->getJson('/api/v1/admin/articles?trashed=only')->assertOk();
    expect($res->json('meta.pagination.total'))->toBe(1);
    expect($res->json('data.0.id'))->toBe($id2);
});

it('forbids restore without the restore permission', function (): void {
    // المقال يُنشأ ويُحذف عبر النموذج مباشرة — حتى يكون طلب المحرّر هو الطلب
    // الأول والوحيد في الاختبار (تفادي تثبيت هوية المصادقة بين الطلبات).
    $author = User::factory()->create();
    $article = new Article([
        'title' => 'مقال محذوف', 'slug' => 'trashed-'.uniqid(), 'locale' => 'ar',
        'type' => 'news', 'status' => 'draft', 'excerpt' => 'ملخّص.',
        'content_json' => tiptapDoc(), 'author_id' => $author->id,
        'primary_category_id' => makeCat()->id,
    ]);
    $article->save();
    $article->delete();

    $u = User::factory()->create();
    $u->assignRole('editor'); // دور بلا صلاحية articles.restore
    $token = $u->createToken('t', ['admin'])->plainTextToken;

    $this->withToken($token)->postJson("/api/v1/admin/articles/{$article->id}/restore")
        ->assertForbidden();
});

it('returns article statistics counts', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();

    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, [
        'slug' => 'st-1', 'is_breaking' => true, 'is_featured' => true,
    ]))->assertCreated();

    $res = $this->withToken($token)->getJson('/api/v1/admin/articles/stats')->assertOk();

    expect($res->json('data.total'))->toBe(1);
    expect($res->json('data.draft'))->toBe(1);
    expect($res->json('data.featured'))->toBe(1);
    expect($res->json('data.deleted'))->toBe(0);
    // عدّاد breaking أُسقط (COUNT بلا فهرس بطيء) — لم يعد ضمن الإحصاءات.
    expect($res->json('data'))->not->toHaveKey('breaking');
});

it('clears the breaking flag from all articles in one shot', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();

    foreach (range(1, 2) as $i) {
        $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, [
            'slug' => 'brk-'.$i, 'is_breaking' => true,
        ]))->assertCreated();
    }
    expect(Article::where('is_breaking', true)->count())->toBe(2);

    $this->withToken($token)->postJson('/api/v1/admin/articles/clear-breaking')->assertOk();

    expect(Article::where('is_breaking', true)->count())->toBe(0);
});

it('clears the pinned flag from all articles in one shot', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();

    foreach (range(1, 2) as $i) {
        $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, [
            'slug' => 'pin-clear-'.$i, 'is_pinned' => true,
        ]))->assertCreated();
    }
    expect(Article::where('is_pinned', true)->count())->toBe(2);

    $this->withToken($token)->postJson('/api/v1/admin/articles/clear-pinned')->assertOk();

    expect(Article::where('is_pinned', true)->count())->toBe(0);
});

it('filters the article list by display placement (is_pinned)', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();

    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, [
        'slug' => 'pinned-one', 'is_pinned' => true,
    ]))->assertCreated();
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, [
        'slug' => 'plain-one',
    ]))->assertCreated();

    $res = $this->withToken($token)
        ->getJson('/api/v1/admin/articles?filter[is_pinned]=1')
        ->assertOk();

    expect($res->json('meta.pagination.total'))->toBe(1);
    expect($res->json('data.0.slug'))->toBe('pinned-one');
});

it('lets an editor set and update the views count manually', function (): void {
    [, $token] = articleAdminToken();

    $id = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload(makeCat(), [
        'views_count' => 1500,
    ]))->assertCreated()->json('data.id');

    expect(Article::find($id)->views_count)->toBe(1500);

    $this->withToken($token)->putJson("/api/v1/admin/articles/{$id}", [
        'views_count' => 2750,
    ])->assertOk();

    expect(Article::find($id)->fresh()->views_count)->toBe(2750);
});

// ─── Manual slug (same policy as Categories) ───────────────────────────

it('rejects a duplicate manual slug within a locale (422, no 500)', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, ['slug' => 'breaking-news']))
        ->assertCreated();

    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, ['slug' => 'breaking-news', 'title' => 'آخر']))
        ->assertStatus(422)->assertJsonValidationErrors(['slug']);
});

it('rejects a malformed manual slug', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();

    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, ['slug' => 'bad slug!']))
        ->assertStatus(422)->assertJsonValidationErrors(['slug']);
});

// ─── Update + revision + URL history (ADR A4) ──────────────────────────

it('does not capture URL history on a slug change (canonical path is id+date only since 2026-07-18)', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat(['name' => 'قسم']);
    $id = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat))
        ->json('data.id');
    $old = Article::find($id)->canonicalPath();

    $this->withToken($token)->putJson("/api/v1/admin/articles/{$id}", ['slug' => 'مسار-جديد'])
        ->assertOk();

    // القانونيّ الجديد /news/dd/mm/yyyy/{id}/ لا يتضمّن slug إطلاقاً — تغييره لا يُغيّر
    // المسار، فلا سجلّ تاريخ مطلوب (خلافاً للسلوك القديم قبل 2026-07-18).
    expect(Article::find($id)->canonicalPath())->toBe($old);
    expect(ArticleUrlHistory::where('old_path', $old)->exists())->toBeFalse();
    expect(ArticleRevision::where('article_id', $id)->count())->toBe(2);
});

it('does not create URL history when canonical path is unchanged', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();
    $id = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat))
        ->json('data.id');

    $this->withToken($token)->putJson("/api/v1/admin/articles/{$id}", ['subtitle' => 'عنوان فرعي'])
        ->assertOk();

    expect(ArticleUrlHistory::count())->toBe(0);
});

// ─── List / show / delete ──────────────────────────────────────────────

it('lists articles paginated with filters', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();
    $writer = User::factory()->create(['is_writer' => true]);
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, ['type' => 'news']))->assertCreated();
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, ['type' => 'opinion', 'slug' => 'op', 'author_id' => $writer->id]))->assertCreated();

    $res = $this->withToken($token)->getJson('/api/v1/admin/articles?filter[type]=opinion');
    $res->assertOk();
    assertSuccessContract($res);
    expect($res->json('meta.pagination.total'))->toBe(1);
});

it('shows and soft-deletes an article', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();
    $id = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat))->json('data.id');

    $this->withToken($token)->getJson("/api/v1/admin/articles/{$id}")->assertOk()
        ->assertJsonPath('data.id', $id);

    $this->withToken($token)->deleteJson("/api/v1/admin/articles/{$id}")->assertOk();
    expect(Article::withTrashed()->find($id)->trashed())->toBeTrue();
});

// ─── Wave C2 boundary: no status transitions via API ───────────────────

it('ignores status/published_at in write payloads (workflow is a later wave)', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();

    $id = $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat, [
        'status' => 'published', 'published_at' => now()->toISOString(),
    ]))->json('data.id');

    $a = Article::find($id);
    expect($a->status->value)->toBe('draft');
    expect($a->published_at)->toBeNull();
});

// ─── Audit + authorization ─────────────────────────────────────────────

it('audits article changes under log_name=article', function (): void {
    [, $token] = articleAdminToken();
    $cat = makeCat();
    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat))->assertCreated();

    expect(Activity::where('log_name', 'article')->exists())->toBeTrue();
});

it('denies article access without a token', function (): void {
    $this->getJson('/api/v1/admin/articles')->assertStatus(401);
});

it('denies article create without the permission', function (): void {
    $role = Role::findByName('reviewer', 'web');
    $role->givePermissionTo('articles.view');
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $u = User::factory()->create();
    $u->assignRole('reviewer');
    $token = $u->createToken('admin-token', ['admin'])->plainTextToken;
    $cat = makeCat();

    $this->withToken($token)->postJson('/api/v1/admin/articles', adminArticlePayload($cat))
        ->assertStatus(403);
});
