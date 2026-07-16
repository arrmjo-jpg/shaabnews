<?php

declare(strict_types=1);

namespace App\Actions\Public\Content;

use App\Enums\UserStatus;
use App\Http\Resources\Public\PublicWriterResource;
use App\Models\User;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

/**
 * جلب قائمة كتّاب الموقع العامة — يدعم البحث والفلترة والترقيم.
 * يستخدم Subquery لجلب last_activity_at لتجنب N+1 Overhead.
 */
class ListPublicWritersAction
{
    public function handle(array $filters, int $page, int $perPage, string $sort): JsonResponse
    {
        $perPage = min(max(1, $perPage), 100);

        $query = User::query()
            ->where('is_writer', true)
            ->where('status', UserStatus::Active)
            ->withCount('articles')
            ->withMax('articles as last_activity_at', 'published_at');

        // البحث القوي بتنظيف المسافات الزائدة
        $search = $filters['q'] ?? $filters['name'] ?? null;
        if (!empty($search)) {
            $searchTerm = Str::squish($search);
            $query->where('name', 'LIKE', "%{$searchTerm}%");
        }

        // الترتيب
        match ($sort) {
            'name' => $query->orderBy('name', 'asc'),
            '-articles_count' => $query->orderBy('articles_count', 'desc')->orderBy('name', 'asc'),
            '-created_at' => $query->latest(),
            default => $query->orderByDesc('last_activity_at')->orderBy('name', 'asc'), // -last_activity_at is the default
        };

        $paginator = $query->paginate(
            perPage: $perPage,
            page: $page
        );

        $resourceCollection = PublicWriterResource::collection($paginator->items())->resolve();

        return ApiResponse::success(
            data: $resourceCollection,
            status: 200,
            meta: [
                'pagination' => [
                    'total' => $paginator->total(),
                    'count' => $paginator->count(),
                    'per_page' => $paginator->perPage(),
                    'current_page' => $paginator->currentPage(),
                    'total_pages' => $paginator->lastPage(),
                ]
            ]
        );
    }
}
