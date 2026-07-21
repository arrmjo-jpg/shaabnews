<?php

declare(strict_types=1);

use App\Models\SportMenuItem;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeSportMenuItem(array $attrs = []): SportMenuItem
{
    static $seq = 0;
    $seq++;

    return SportMenuItem::create(array_merge([
        'parent_id' => null,
        'locale' => 'ar',
        'title' => 'عنصر '.$seq,
        'type' => 'section',
        'category_id' => null,
        'section_key' => 'matches',
        'icon' => null,
        'order' => $seq,
        'enabled' => true,
    ], $attrs));
}

it('returns only enabled root items for the requested locale, ordered by order', function (): void {
    $second = makeSportMenuItem(['title' => 'ترتيب-2', 'order' => 2]);
    $first = makeSportMenuItem(['title' => 'ترتيب-1', 'order' => 1]);
    makeSportMenuItem(['title' => 'معطّل', 'enabled' => false]);
    makeSportMenuItem(['title' => 'إنجليزي', 'locale' => 'en']);

    $res = $this->getJson('/api/v1/sport-menu?locale=ar')->assertOk();
    $titles = collect($res->json('data'))->pluck('title')->all();

    expect($titles)->toBe(['ترتيب-1', 'ترتيب-2']);
});

it('nests only enabled children of the same locale', function (): void {
    $parent = makeSportMenuItem(['title' => 'أب']);
    makeSportMenuItem(['title' => 'ابن مفعّل', 'parent_id' => $parent->id, 'order' => 1]);
    makeSportMenuItem(['title' => 'ابن معطّل', 'parent_id' => $parent->id, 'enabled' => false]);
    makeSportMenuItem(['title' => 'ابن إنجليزي', 'parent_id' => $parent->id, 'locale' => 'en']);

    $res = $this->getJson('/api/v1/sport-menu?locale=ar')->assertOk();
    $children = collect($res->json('data'))->firstWhere('title', 'أب')['children'];

    expect(collect($children)->pluck('title')->all())->toBe(['ابن مفعّل']);
});

it('respects the locale query param and falls back to ar for an invalid value', function (): void {
    makeSportMenuItem(['title' => 'عربي', 'locale' => 'ar']);
    makeSportMenuItem(['title' => 'انجليزي', 'locale' => 'en']);

    $en = $this->getJson('/api/v1/sport-menu?locale=en')->assertOk();
    expect(collect($en->json('data'))->pluck('title')->all())->toBe(['انجليزي']);

    $invalid = $this->getJson('/api/v1/sport-menu?locale=fr')->assertOk();
    expect(collect($invalid->json('data'))->pluck('title')->all())->toBe(['عربي']);
});

it('works as a guest with no authentication', function (): void {
    makeSportMenuItem();

    $this->getJson('/api/v1/sport-menu')->assertOk();
});

it('returns the lean public shape — no enabled, parent_id, or created_at fields', function (): void {
    makeSportMenuItem(['icon' => 'news']);

    $res = $this->getJson('/api/v1/sport-menu?locale=ar')->assertOk();
    $item = $res->json('data.0');

    expect($item)->toHaveKeys(['id', 'title', 'type', 'category_id', 'section_key', 'icon', 'children']);
    expect($item)->not->toHaveKey('enabled');
    expect($item)->not->toHaveKey('parent_id');
    expect($item)->not->toHaveKey('created_at');
});

it('returns an empty list, not an error, when nothing is enabled', function (): void {
    makeSportMenuItem(['enabled' => false]);

    $res = $this->getJson('/api/v1/sport-menu?locale=ar')->assertOk();
    expect($res->json('data'))->toBe([]);
});
