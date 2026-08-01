<?php

declare(strict_types=1);

namespace App\Actions\Public\Content;

use App\Enums\UserStatus;
use App\Http\Resources\Public\PublicWriterResource;
use App\Models\User;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * بروفيل كاتب عامّ بالـ id — **بوّابة: is_writer + نشِط فقط** (غير الكاتب/المدير/الموقوف ⇒ 404،
 * لا كشف). يكشف حقولاً آمنة للنشر فقط (الاسم/الصورة/النبذة/السوشيل). قراءة-فقط (لا migration).
 */
class ShowPublicWriterAction
{
    public function handle(int $id): JsonResponse
    {
        $writer = User::query()
            ->whereKey($id)
            ->where('is_writer', true)
            ->where('status', UserStatus::Active)
            ->withCount('articles')
            ->withMax('articles as last_activity_at', 'published_at')
            ->first();

        if ($writer === null) {
            return ApiResponse::error(__('user.not_found'), [], 404);
        }

        return ApiResponse::success(data: (new PublicWriterResource($writer))->resolve());
    }
}
