<?php

declare(strict_types=1);

use App\Support\Cache\CacheTagScheme;

// كلّ حالة هنا تُطابق حرفياً سلوك أحد الأصناف الخمسة الحاليّة (قبل الترحيل) —
// دليل الصحّة قبل لمس أيّ صنف حيّ (Task 7).

it('matches Article shape: sitemap + multi-category', function (): void {
    $scheme = new CacheTagScheme('articles', 'articles:sitemap');

    $tags = $scheme->invalidationTags('ar', 'my-slug', categorySlugs: ['sport', 'politics']);

    expect($tags)->toBe([
        'articles:sitemap',
        'articles:feed:ar',
        'articles:detail:ar:my-slug',
        'articles:category:ar:sport',
        'articles:category:ar:politics',
    ]);
});

it('matches Reel shape: no sitemap, no category', function (): void {
    $scheme = new CacheTagScheme('reels');

    $tags = $scheme->invalidationTags('ar', 'my-reel');

    expect($tags)->toBe(['reels:feed:ar', 'reels:detail:ar:my-reel']);
});

it('matches Video shape: sitemap + single category', function (): void {
    $scheme = new CacheTagScheme('videos', 'videos:sitemap');

    $tags = $scheme->invalidationTags('ar', 'my-video', categorySlugs: ['tech']);

    expect($tags)->toBe([
        'videos:sitemap',
        'videos:feed:ar',
        'videos:detail:ar:my-video',
        'videos:category:ar:tech',
    ]);
});

it('matches Page shape: no sitemap, no category', function (): void {
    $scheme = new CacheTagScheme('pages');

    $tags = $scheme->invalidationTags('ar', 'about-us');

    expect($tags)->toBe(['pages:feed:ar', 'pages:detail:ar:about-us']);
});

it('matches Broadcast shape: sitemap + non-dimensioned detail/category', function (): void {
    $scheme = new CacheTagScheme('broadcasts', 'broadcasts:sitemap', detailDimensioned: false, categoryDimensioned: false);

    $tags = $scheme->invalidationTags('live', 'match-1', categorySlugs: ['sport']);

    expect($tags)->toBe([
        'broadcasts:sitemap',
        'broadcasts:feed:live',
        'broadcasts:detail:match-1',   // لا kind في المفتاح
        'broadcasts:category:sport',  // لا kind في المفتاح
    ]);
});

it('includes the old dimension feed tag when the dimension changes', function (): void {
    $scheme = new CacheTagScheme('articles', 'articles:sitemap');

    $tags = $scheme->invalidationTags('en', 'slug', oldDimension: 'ar');

    expect($tags)->toContain('articles:feed:ar');
    expect($tags)->toContain('articles:feed:en');
});

it('includes the old detail tag only when dimension or slug actually changed', function (): void {
    $scheme = new CacheTagScheme('reels');

    $unchanged = $scheme->invalidationTags('ar', 'same-slug', oldDimension: 'ar', oldSlug: 'same-slug');
    $changedSlug = $scheme->invalidationTags('ar', 'new-slug', oldDimension: 'ar', oldSlug: 'old-slug');

    expect($unchanged)->not->toContain('reels:detail:ar:old-slug');
    expect($changedSlug)->toContain('reels:detail:ar:old-slug');
    expect($changedSlug)->toContain('reels:detail:ar:new-slug');
});

it('includes old category tags only for categories actually passed as old', function (): void {
    $scheme = new CacheTagScheme('articles', 'articles:sitemap');

    $tags = $scheme->invalidationTags('ar', 'slug', categorySlugs: ['a'], oldCategorySlugs: ['b']);

    expect($tags)->toContain('articles:category:ar:a');
    expect($tags)->toContain('articles:category:ar:b');
});

it('deduplicates identical tags', function (): void {
    $scheme = new CacheTagScheme('articles', 'articles:sitemap');

    $tags = $scheme->invalidationTags('ar', 'slug', categorySlugs: ['x'], oldCategorySlugs: ['x']);

    expect(array_count_values($tags)['articles:category:ar:x'])->toBe(1);
});

it('exposes feedTags/detailTags/categoryTags wrapped with the ALL umbrella', function (): void {
    $scheme = new CacheTagScheme('videos', 'videos:sitemap');

    expect($scheme->feedTags('ar'))->toBe(['videos', 'videos:feed:ar']);
    expect($scheme->detailTags('ar', 'slug'))->toBe(['videos', 'videos:detail:ar:slug']);
    expect($scheme->categoryTags('ar', 'tech'))->toBe(['videos', 'videos:category:ar:tech']);
});
