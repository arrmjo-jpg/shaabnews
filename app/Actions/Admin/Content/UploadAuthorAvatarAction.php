<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Models\User;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

class UploadAuthorAvatarAction
{
    public function handle(User $user, UploadedFile $file): JsonResponse
    {
        $user->clearMediaCollection('avatar');
        $user->addMedia($file)->toMediaCollection('avatar');

        // P1 (Cache Invalidation Audit): نفس وسمَي UpdateUserAction تمامًا — لا نُبطل
        // الصفحة الرئيسية/الأقسام لأن أي fetch هناك لا يحمل avatar الكاتب ضمن وسومه.
        FrontendRevalidate::tags(['writers', "writer:{$user->id}"]);

        return ApiResponse::success(__('media.uploaded'), [
            'user_id' => $user->id,
            'avatar' => $user->getFirstMediaUrl('avatar'),
            'avatar_thumb' => $user->getFirstMediaUrl('avatar', 'thumb'),
        ], 201);
    }
}
