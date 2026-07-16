<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Http\Resources\Admin\Content\EntityResource;
use App\Models\Article;
use App\Models\Reel;
use App\Models\User;
use App\Models\Video;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * مزامنة الكيانات الموسومة على قطعة محتوى — عامّة عبر Article/Video/Reel
 * (توسيم يدويّ فقط، Phase 1). يستهلك علاقة entities() المشتركة (Task 4)
 * المتاحة على الأنواع الثلاثة؛ لا حاجة لأربع نسخ من نفس المنطق.
 */
class SyncContentEntitiesAction
{
    public function handle(Article|Video|Reel $content, array $entityIds, User $actor): JsonResponse
    {
        $pivotData = [];
        foreach ($entityIds as $id) {
            $pivotData[$id] = [
                'assigned_by_type' => User::class,
                'assigned_by_id' => $actor->id,
                'status' => 'confirmed',
            ];
        }

        $content->entities()->sync($pivotData);

        return ApiResponse::success(
            __('entity.synced'),
            EntityResource::collection($content->entities()->get()),
        );
    }
}
