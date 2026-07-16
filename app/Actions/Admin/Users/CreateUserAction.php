<?php

declare(strict_types=1);

namespace App\Actions\Admin\Users;

use App\Enums\UserStatus;
use App\Http\Resources\Admin\Users\UserResource;
use App\Models\User;
use App\Services\Auth\EmailIdentityGenerator;
use App\Support\Audit\RbacAudit;
use App\Support\Authorization\RoleEscalationGuard;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CreateUserAction
{
    public function handle(array $validated, User $actor): JsonResponse
    {
        // قفل تصعيد الصلاحيات: منح دور super_admin يتطلّب فاعلاً super_admin
        if ($denied = RoleEscalationGuard::check(
            $actor,
            null,
            $validated['roles'] ?? [],
            ! empty($validated['roles'])
        )) {
            return $denied;
        }

        $user = DB::transaction(function () use ($validated): User {
            $email = $validated['email'] ?? null;
            if (empty($email)) {
                $email = app(EmailIdentityGenerator::class)->generate($validated['name']);
            }

            $user = User::create([
                'name' => $validated['name'],
                'email' => $email,
                'password' => $validated['password'] ?? null, // يُجزَّأ تلقائياً عبر cast
                'status' => $validated['status'] ?? UserStatus::Active->value,
                'avatar' => $validated['avatar'] ?? null,
                'bio' => $validated['bio'] ?? null,
                'social_links' => $validated['social_links'] ?? null,
                // تأكيد البريد يدوياً من المدير — لا تأكيد تلقائي
                'email_verified_at' => ! empty($validated['email_verified']) ? now() : null,
                'is_writer' => (bool) ($validated['is_writer'] ?? false),
            ]);

            if (! empty($validated['roles'])) {
                $user->syncRoles($validated['roles']);
            }

            return $user;
        });

        // تدقيق صريح لأدوار المستخدم المُسندة عند الإنشاء (إن وُجدت).
        if (! empty($validated['roles'])) {
            RbacAudit::userRoles($actor, $user, [], array_values($validated['roles']));
        }

        return ApiResponse::success(
            __('user.created'),
            new UserResource($user->load('roles')),
            201
        );
    }
}
