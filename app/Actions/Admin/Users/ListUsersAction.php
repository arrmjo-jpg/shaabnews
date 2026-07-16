<?php

declare(strict_types=1);

namespace App\Actions\Admin\Users;

use App\Http\Resources\Admin\Users\UserResource;
use App\Models\User;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ListUsersAction
{
    public function handle(): JsonResponse
    {
        $perPage = max(1, min(
            (int) request()->integer('per_page', (int) config('performance.pagination.default')),
            (int) config('performance.pagination.max')
        ));

        $users = QueryBuilder::for(User::class)
            ->select([
                'id',
                'name',
                'email',
                'avatar',
                'status',
                'is_writer',
                'last_login_at',
                'created_at',
                'deleted_at',
            ])
            ->with('roles:id,name,display_name')
            ->allowedFilters(
                AllowedFilter::partial('name'),
                AllowedFilter::partial('email'),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('is_writer'),
                AllowedFilter::callback('role', function ($query, $value): void {
                    $query->whereHas('roles', fn ($q) => $q->where('name', $value));
                }),
                AllowedFilter::callback('search', function ($query, $value): void {
                    $query->where(function ($q) use ($value): void {
                        $q->where('name', 'like', "%{$value}%")
                            ->orWhere('email', 'like', "%{$value}%");
                    });
                }),
                AllowedFilter::callback('trashed', function ($query, $value): void {
                    $value === 'only'
                        ? $query->onlyTrashed()
                        : $query->withTrashed();
                }),
            )
            ->allowedSorts('id', 'name', 'email', 'created_at', 'last_login_at')
            ->defaultSort('-id')
            ->paginate($perPage)
            ->appends(request()->query());

        return ApiResponse::success(
            data: UserResource::collection($users)->resolve(),
            meta: [
                'pagination' => [
                    'total' => $users->total(),
                    'count' => $users->count(),
                    'per_page' => $users->perPage(),
                    'current_page' => $users->currentPage(),
                    'total_pages' => $users->lastPage(),
                ],
            ]
        );
    }
}
