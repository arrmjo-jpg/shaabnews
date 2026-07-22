<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Http\Resources\Admin\Content\CategoryResource;
use App\Models\Category;
use App\Support\Cache\CacheKeys;
use App\Support\Cache\CacheTtl;
use App\Support\Content\CategoryTree;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class ListCategoriesAction
{
    public function handle(): JsonResponse
    {
        // الشجرة البنيوية فقط — تُخزَّن مؤقتاً (تتغيّر نادراً). أعداد المقالات لكل
        // قسم أُسقطت عمداً: كانت استعلامَي COUNT(*) على ~79k صفّ (~12 ثانية باردة)
        // بلا قيمة تشغيلية للمستخدم، فحذفها يلغي الحمل تماماً ويُبقي الردّ شجرةً خالصة.
        $tree = Cache::tags(['categories'])->remember(
            CacheKeys::categoriesTreeAdmin(),
            CacheTtl::METADATA,
            fn (): array => CategoryResource::collection(
                CategoryTree::build(
                    Category::query()
                        ->with('bannerMedia')
                        ->orderBy('locale')
                        ->orderBy('sort_order')
                        ->orderBy('id')
                        ->get()
                )
            )->resolve()
        );

        return ApiResponse::success(data: $tree);
    }
}
