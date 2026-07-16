<?php

declare(strict_types=1);

namespace App\Support\WpMigration;

/**
 * لقطة قراءة-فقط لمنشور ووردبريس مصدري (الحقائق التحريرية فقط). تُغذّي المُنسّق.
 * هوية المصدر = wpPostId حصراً (قاعدة #2/#10).
 */
final class WpPostRecord
{
    /**
     * @param  array<int,int>  $categoryTtids
     * @param  array{title:?string,description:?string,keywords:?string,canonical:?string,robots:?string}  $seo
     */
    public function __construct(
        public readonly int $wpPostId,
        public readonly string $status,
        public readonly string $title,
        public readonly ?string $subtitle,
        public readonly string $sourceSlug,
        public readonly ?string $excerpt,
        public readonly string $content,
        public readonly ?string $publishedAt,
        public readonly ?string $updatedAt,
        public readonly array $categoryTtids,
        public readonly ?int $primaryCategoryTtid,
        public readonly ?string $featuredUrl,
        public readonly ?int $featuredWpAttachmentId,
        public readonly array $seo,
        public readonly ?string $permalink,
    ) {}
}
