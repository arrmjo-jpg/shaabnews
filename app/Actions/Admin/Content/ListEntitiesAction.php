<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Enums\EntityType;
use App\Models\Entity;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * بحث/اقتراح كيانات لواجهة التوسيم الإداريّة (mirror من ListTagsAction) —
 * Task 12. type اختياريّ (تصفية بنوع واحد)؛ q بحث جزئيّ على الاسم.
 */
class ListEntitiesAction
{
    public function handle(?string $type, string $query, int $limit): JsonResponse
    {
        if ($type !== null && EntityType::tryFrom($type) === null) {
            return ApiResponse::error(__('entity.invalid_type'), [], 422);
        }

        $limit = max(1, min($limit, 50));
        $query = trim($query);

        $q = Entity::query()
            ->select(['id', 'type', 'name', 'slug', 'description'])
            ->when($type !== null, fn ($qq) => $qq->where('type', $type))
            ->orderBy('name')
            ->limit($limit);

        if ($query !== '') {
            $q->where('name', 'like', '%'.$query.'%');
        }

        return ApiResponse::success(data: $q->get());
    }
}
