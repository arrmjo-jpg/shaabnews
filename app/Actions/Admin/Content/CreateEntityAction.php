<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Http\Resources\Admin\Content\EntityResource;
use App\Models\Entity;
use App\Models\User;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * إنشاء كيان كنونيّ جديد (Task 12) — فحص تكرار بسيط بالاسم+النوع (ADR-E5):
 * لا إزالة تكرار بالذكاء الاصطناعيّ هنا، مجرّد تنبيه يمنع الإنشاء العرضيّ
 * لنسخة ثانية من كيان قائم بنفس الاسم الحرفيّ ونفس النوع.
 */
class CreateEntityAction
{
    public function handle(array $validated, User $actor): JsonResponse
    {
        $exists = Entity::query()
            ->where('type', $validated['type'])
            ->where('name', $validated['name'])
            ->exists();

        if ($exists) {
            return ApiResponse::error(__('entity.duplicate_name'), [], 422);
        }

        $entity = Entity::create([
            'type' => $validated['type'],
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'external_ref' => $validated['external_ref'] ?? null,
            'created_by_id' => $actor->id,
        ]);

        return ApiResponse::success(
            __('entity.created'),
            new EntityResource($entity),
            201,
        );
    }
}
