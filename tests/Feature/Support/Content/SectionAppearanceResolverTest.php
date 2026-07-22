<?php

declare(strict_types=1);

use App\Models\Category;
use App\Support\Content\SectionAppearanceResolver;

it('returns full defaults when appearance is null', function (): void {
    $category = new Category([
        'name' => 'Test',
        'locale' => 'ar',
        'layout_type' => 'default',
        'show_title' => true,
        'appearance' => null,
    ]);

    expect(SectionAppearanceResolver::resolve($category))->toBe([
        'layout' => 'default',
        'show_title' => true,
        'banner' => ['url' => null, 'height' => 'md', 'overlay' => true, 'position' => 'center'],
        'border' => ['enabled' => false, 'width' => 2, 'radius' => 0, 'color' => '#E5E7EB'],
    ]);
});

it('merges stored appearance over defaults and drops unknown keys', function (): void {
    $category = new Category([
        'name' => 'Test',
        'locale' => 'ar',
        'layout_type' => 'hero',
        'show_title' => false,
        'appearance' => [
            'border' => ['enabled' => true, 'width' => 4, 'color' => '#A80101', 'type' => 'gradient', 'shadow' => 'huge'],
            'banner' => ['height' => 'lg', 'evil_key' => 'drop me'],
        ],
    ]);

    $result = SectionAppearanceResolver::resolve($category);

    expect($result['layout'])->toBe('hero');
    expect($result['show_title'])->toBeFalse();
    expect($result['border'])->toBe(['enabled' => true, 'width' => 4, 'radius' => 0, 'color' => '#A80101']);
    expect($result['banner'])->toBe(['url' => null, 'height' => 'lg', 'overlay' => true, 'position' => 'center']);
});

it('ignores an unrelated non-array appearance value', function (): void {
    $category = new Category([
        'name' => 'Test',
        'locale' => 'ar',
        'layout_type' => 'default',
        'show_title' => true,
    ]);

    $result = SectionAppearanceResolver::resolve($category);

    expect($result['border'])->toBe(['enabled' => false, 'width' => 2, 'radius' => 0, 'color' => '#E5E7EB']);
    expect($result['banner']['url'])->toBeNull();
});
