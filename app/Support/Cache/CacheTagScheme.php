<?php

declare(strict_types=1);

namespace App\Support\Cache;

/**
 * مخطّط وسوم كاش عامّ (Task 7) — استُخرِج من قراءة Article/Reel/Video/Page/
 * BroadcastCacheTags جنباً إلى جنب. الجزء المتطابق حرفياً بينها هو تهيئة
 * سلاسل الوسوم فقط؛ التنويعات الحقيقية (وجود sitemap، عدد التصنيفات،
 * تبعيد detail/category بالبُعد) مُمثَّلة كبيانات هنا، لا كأفرع منطقيّة.
 *
 * ملاحظة مهمّة: Broadcast يحذف البُعد (kind) عمداً من detail/category
 * (detailDimensioned/categoryDimensioned = false) — سلوك حاليّ حقيقيّ محفوظ
 * تماماً كما هو، لا "إصلاح" ضمنيّ لهذا الفرق.
 */
final readonly class CacheTagScheme
{
    public function __construct(
        public string $all,
        public ?string $sitemap = null,
        public bool $detailDimensioned = true,
        public bool $categoryDimensioned = true,
    ) {}

    public function feed(string $dimension): string
    {
        return "{$this->all}:feed:{$dimension}";
    }

    public function detail(string $dimension, string $slug): string
    {
        return $this->detailDimensioned ? "{$this->all}:detail:{$dimension}:{$slug}" : "{$this->all}:detail:{$slug}";
    }

    public function category(string $dimension, string $categorySlug): string
    {
        return $this->categoryDimensioned ? "{$this->all}:category:{$dimension}:{$categorySlug}" : "{$this->all}:category:{$categorySlug}";
    }

    /** @return array<int,string> */
    public function feedTags(string $dimension): array
    {
        return [$this->all, $this->feed($dimension)];
    }

    /** @return array<int,string> */
    public function detailTags(string $dimension, string $slug): array
    {
        return [$this->all, $this->detail($dimension, $slug)];
    }

    /** @return array<int,string> */
    public function categoryTags(string $dimension, string $categorySlug): array
    {
        return [$this->all, $this->category($dimension, $categorySlug)];
    }

    /**
     * الوسوم الواجب إبطالها عند كتابة/تحوّل محتوى — feed بُعده + تفاصيله +
     * تصنيفاته (صفر/واحد/عدّة — بيانات، لا فرع)، وعند تغيّر البُعد/الـ slug/
     * التصنيفات يشمل القديم أيضاً (يمنع بقايا قديمة).
     *
     * @param  array<int,string>  $categorySlugs
     * @param  array<int,string>  $oldCategorySlugs
     * @return array<int,string>
     */
    public function invalidationTags(
        string $dimension,
        string $slug,
        array $categorySlugs = [],
        ?string $oldDimension = null,
        ?string $oldSlug = null,
        array $oldCategorySlugs = [],
    ): array {
        $oldDimension ??= $dimension;
        $oldSlug ??= $slug;

        $tags = [];
        if ($this->sitemap !== null) {
            $tags[] = $this->sitemap;
        }
        $tags[] = $this->feed($dimension);
        $tags[] = $this->detail($dimension, $slug);
        foreach ($categorySlugs as $c) {
            $tags[] = $this->category($dimension, $c);
        }

        if ($oldDimension !== $dimension) {
            $tags[] = $this->feed($oldDimension);
        }
        if ($oldDimension !== $dimension || $oldSlug !== $slug) {
            $tags[] = $this->detail($oldDimension, $oldSlug);
        }
        foreach ($oldCategorySlugs as $c) {
            $tags[] = $this->category($oldDimension, $c);
        }

        return array_values(array_unique($tags));
    }
}
