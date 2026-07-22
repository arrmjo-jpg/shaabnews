<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Models\Category;

/**
 * يحوّل حقول تصميم القسم الخام (Category) إلى شكل آمن ومكتمل الافتراضيات
 * للاستهلاك العام (PublicCategoryResource ⇐ Next.js SectionRenderer).
 *
 * appearance مخزَّن كـ JSON حرّ (غير مُتحقَّق بعمق عند الحفظ — راجع Store/UpdateCategoryRequest)،
 * لذا الأمان يُفرَض هنا عند القراءة فقط: array_intersect_key يستبعد أي مفتاح غير معروف
 * (بيانات قديمة/تالفة/مُدخَلة يدوياً)، فلا يمكن لأي قيمة غير متوقعة أن تتسرّب للواجهة العامة.
 */
final class SectionAppearanceResolver
{
    /** @var array<string,mixed> */
    private const DEFAULT_BORDER = [
        'enabled' => false,
        'width' => 2,
        'radius' => 0,
        'color' => '#E5E7EB',
    ];

    /** @var array<string,mixed> */
    private const DEFAULT_BANNER = [
        'height' => 'md',
        'overlay' => true,
        'position' => 'center',
    ];

    /** @return array<string,mixed> */
    public static function resolve(Category $category): array
    {
        $stored = is_array($category->appearance) ? $category->appearance : [];
        $storedBanner = is_array($stored['banner'] ?? null) ? $stored['banner'] : [];
        $storedBorder = is_array($stored['border'] ?? null) ? $stored['border'] : [];

        return [
            'layout' => $category->layout_type->value,
            'show_title' => (bool) $category->show_title,
            'banner' => [
                'url' => $category->relationLoaded('bannerMedia') ? $category->bannerMedia?->url() : null,
                ...self::DEFAULT_BANNER,
                ...array_intersect_key($storedBanner, self::DEFAULT_BANNER),
            ],
            'border' => [
                ...self::DEFAULT_BORDER,
                ...array_intersect_key($storedBorder, self::DEFAULT_BORDER),
            ],
        ];
    }
}
