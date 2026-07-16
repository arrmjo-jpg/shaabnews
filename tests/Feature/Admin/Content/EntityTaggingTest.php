<?php

declare(strict_types=1);

use App\Enums\EntityType;
use App\Models\Article;
use App\Models\Category;
use App\Models\Entity;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    seedRoles();
});

function makeArticleForEntityTest(array $attrs = []): Article
{
    return Article::create(array_merge([
        'title' => 'خبر '.uniqid(),
        'locale' => 'ar',
        'type' => 'news',
        'status' => 'published',
        'primary_category_id' => Category::create([
            'name' => 'تصنيف '.uniqid(), 'locale' => 'ar', 'status' => 'active',
        ])->id,
        'author_id' => User::factory()->create()->id,
        'content_json' => ['type' => 'doc', 'content' => []],
        'content' => '<p>x</p>',
        'published_at' => now(),
    ], $attrs));
}

// ─── Entity creation + audit (ADR-E5) ──────────────────────────────────

it('creates a canonical entity and logs it to activity_log', function (): void {
    $entity = Entity::create([
        'type' => EntityType::Person->value,
        'name' => 'أحمد الخطيب',
    ]);

    expect($entity->slug)->not->toBeEmpty();
    expect(
        Activity::where('log_name', 'entity')->where('subject_id', $entity->id)->exists()
    )->toBeTrue();
});

it('allows the same name across different entity types without slug collision', function (): void {
    $person = Entity::create(['type' => EntityType::Person->value, 'name' => 'الأردن']);
    $place = Entity::create(['type' => EntityType::Place->value, 'name' => 'الأردن']);

    expect($person->slug)->toBe($place->slug); // نفس الاسم، نوع مختلف → لا تصادم
    expect($person->id)->not->toBe($place->id);
});

it('uniquifies the slug for two entities of the same type and name', function (): void {
    $a = Entity::create(['type' => EntityType::Topic->value, 'name' => 'مؤتمر المناخ']);
    $b = Entity::create(['type' => EntityType::Topic->value, 'name' => 'مؤتمر المناخ']);

    expect($a->slug)->not->toBe($b->slug);
});

// ─── Attach to content (polymorphic, manual tagging only in Phase 1) ──

it('tags an article with multiple entities of different types', function (): void {
    $article = makeArticleForEntityTest();
    $person = Entity::create(['type' => EntityType::Person->value, 'name' => 'شخصيّة سياسيّة']);
    $place = Entity::create(['type' => EntityType::Place->value, 'name' => 'عمّان']);
    $actor = User::factory()->create();

    $article->entities()->attach([
        $person->id => ['assigned_by_type' => User::class, 'assigned_by_id' => $actor->id, 'status' => 'confirmed'],
        $place->id => ['assigned_by_type' => User::class, 'assigned_by_id' => $actor->id, 'status' => 'confirmed'],
    ]);

    expect($article->entities()->count())->toBe(2);
    expect($article->entities->pluck('name'))->toContain('عمّان');
});

it('prevents tagging the same entity twice on the same article', function (): void {
    $article = makeArticleForEntityTest();
    $entity = Entity::create(['type' => EntityType::Topic->value, 'name' => 'قضيّة متكرّرة']);

    $article->entities()->attach($entity->id);

    expect(fn () => $article->entities()->attach($entity->id))
        ->toThrow(QueryException::class);
});

it('does not affect existing free-text Spatie tags when entities are attached', function (): void {
    $article = makeArticleForEntityTest();
    $article->attachTag('عاجل'); // Spatie\Tags — لا علاقة بجدول الكيانات
    $entity = Entity::create(['type' => EntityType::Topic->value, 'name' => 'موضوع']);
    $article->entities()->attach($entity->id);

    expect($article->tags()->count())->toBe(1);
    expect($article->entities()->count())->toBe(1);
});

// ─── Soft delete safety ─────────────────────────────────────────────────

it('soft-deletes an entity without breaking existing content_entity rows', function (): void {
    $article = makeArticleForEntityTest();
    $entity = Entity::create(['type' => EntityType::Person->value, 'name' => 'شخص']);
    $article->entities()->attach($entity->id);

    $entity->delete();

    expect(Entity::withTrashed()->find($entity->id))->not->toBeNull();
    // السلوك الافتراضي لـEloquent: الكيان المحذوف ناعمًا مخفيّ عن العلاقة العاديّة...
    expect($article->entities()->count())->toBe(0);
    // ...لكن صفّ content_entity نفسه محفوظ فعليًّا، لا Cascade — يظهر عبر withTrashed().
    expect($article->entities()->withTrashed()->count())->toBe(1);
});
