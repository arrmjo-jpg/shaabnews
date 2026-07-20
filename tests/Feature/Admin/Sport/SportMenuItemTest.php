<?php

declare(strict_types=1);

use App\Models\Category;
use App\Models\SportMenuItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

/** لا يوجد CategoryFactory في هذا الكود (Category لا تستخدم HasFactory) — Category::create مباشرة، كما في CategoryManagementTest. */
function makeCategoryForMenu(array $attrs = []): Category
{
    return Category::create(array_merge([
        'name' => 'تصنيف '.uniqid(),
        'locale' => 'ar',
        'status' => 'active',
    ], $attrs));
}

it('creates a functional section item via the factory', function (): void {
    $item = SportMenuItem::factory()->create([
        'title' => 'المباريات',
        'section_key' => 'matches',
    ]);

    expect($item->type)->toBe('section');
    expect($item->section_key)->toBe('matches');
    expect($item->category_id)->toBeNull();
    expect($item->enabled)->toBeTrue();
    expect($item->order)->toBe(0);
});

it('creates an editorial item pointing at a real category', function (): void {
    $category = makeCategoryForMenu();

    $item = SportMenuItem::factory()->category($category->id)->create([
        'title' => 'أخبار',
    ]);

    expect($item->type)->toBe('category');
    expect($item->category_id)->toBe($category->id);
    expect($item->section_key)->toBeNull();
    expect($item->category)->not->toBeNull();
    expect($item->category->id)->toBe($category->id);
});

it('supports a self-referencing parent/children tree', function (): void {
    $parent = SportMenuItem::factory()->create(['title' => 'الأقسام']);
    $child = SportMenuItem::factory()->create(['title' => 'انتقالات', 'parent_id' => $parent->id]);

    expect($child->parent->id)->toBe($parent->id);
    expect($parent->children()->pluck('id'))->toContain($child->id);
});

it('writes an activity log entry on create, via AuditsChanges', function (): void {
    $item = SportMenuItem::factory()->create(['title' => 'فيديو']);

    $activity = Activity::query()
        ->where('subject_type', SportMenuItem::class)
        ->where('subject_id', $item->id)
        ->where('event', 'created')
        ->where('log_name', 'sport_menu_item')
        ->latest('id')
        ->first();

    expect($activity)->not->toBeNull();
    expect($activity->properties->toArray()['attributes']['title'] ?? null)->toBe('فيديو');
});
