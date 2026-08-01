<?php

declare(strict_types=1);

use App\Support\WpMigration\WpMediaResolver;
use App\Support\WpMigration\WpMediaSource;

/**
 * وضع التنزيل البعيد (WP_BASE_URL) — المصدر الأساسي للوسائط.
 *
 * الجذر المحلّي هنا مسار غير موجود عمداً: يثبت أن الوضع البعيد لا يلمس القرص
 * ولا يشترط نسخة محلّية من wp-content/uploads إطلاقاً.
 */
const MISSING_ROOT = '/nonexistent-uploads-root';

it('builds the media url from the configured base url', function (): void {
    config(['wp-migration.base_url' => 'https://example.com']);

    expect(WpMediaSource::uploadsUrl('2024/05/image.jpg'))
        ->toBe('https://example.com/wp-content/uploads/2024/05/image.jpg');
});

it('changing only the base url changes the domain', function (): void {
    config(['wp-migration.base_url' => 'https://other.test']);

    expect(WpMediaSource::uploadsUrl('2024/05/image.jpg'))
        ->toBe('https://other.test/wp-content/uploads/2024/05/image.jpg');
});

it('normalises a base url given with a trailing slash or extra path', function (): void {
    config(['wp-migration.base_url' => 'https://example.com/blog/']);

    expect(WpMediaSource::uploadsUrl('a/b.jpg'))
        ->toBe('https://example.com/wp-content/uploads/a/b.jpg');
});

it('is disabled when no base url is configured', function (): void {
    config(['wp-migration.base_url' => null]);

    expect(WpMediaSource::enabled())->toBeFalse();
    expect(WpMediaSource::uploadsUrl('a/b.jpg'))->toBeNull();
});

it('resolves an uploads reference remotely without touching the disk', function (): void {
    config(['wp-migration.base_url' => 'https://example.com']);

    $res = (new WpMediaResolver(MISSING_ROOT))
        ->resolve('https://old-domain.test/wp-content/uploads/2024/05/image.jpg');

    expect($res->isExternal())->toBeTrue();
    expect($res->url)->toBe('https://example.com/wp-content/uploads/2024/05/image.jpg');
});

it('prefers the original and keeps the referenced derivative as a fallback', function (): void {
    config(['wp-migration.base_url' => 'https://example.com']);

    $res = (new WpMediaResolver(MISSING_ROOT))
        ->resolve('https://example.com/wp-content/uploads/2024/01/photo-300x200.jpg');

    expect($res->urlCandidates())->toBe([
        'https://example.com/wp-content/uploads/2024/01/photo.jpg',
        'https://example.com/wp-content/uploads/2024/01/photo-300x200.jpg',
    ]);
});

it('encodes arabic and spaced filenames safely', function (): void {
    config(['wp-migration.base_url' => 'https://example.com']);

    $url = (string) WpMediaSource::uploadsUrl('2024/05/صورة كبيرة.jpg');

    expect($url)->toStartWith('https://example.com/wp-content/uploads/2024/05/');
    expect($url)->not->toContain(' ');
    // الشرطات المائلة تبقى فواصل مسار حقيقية (لا تُرمَّز):
    // 2 في «https://» + wp-content + uploads + 2024 + 05 + اسم الملف = 7.
    expect(substr_count($url, '/'))->toBe(7);
    expect($url)->toContain('%D8%B5'); // أوّل محرف عربي مُرمَّز
});

it('refuses to build a url for a traversal reference', function (): void {
    config(['wp-migration.base_url' => 'https://example.com']);

    expect(WpMediaSource::uploadsUrl('../../wp-config.php'))->toBeNull();

    $res = (new WpMediaResolver(MISSING_ROOT))
        ->resolve('https://example.com/wp-content/uploads/../../../../Windows/win.ini');

    expect($res->isUnresolved())->toBeTrue();
});

it('still treats a non-uploads url as a plain external reference', function (): void {
    config(['wp-migration.base_url' => 'https://example.com']);

    $res = (new WpMediaResolver(MISSING_ROOT))->resolve('https://cdn.other.test/a/b.jpg');

    expect($res->isExternal())->toBeTrue();
    expect($res->url)->toBe('https://cdn.other.test/a/b.jpg');
});
