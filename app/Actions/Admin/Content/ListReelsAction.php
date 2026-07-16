<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Http\Resources\Admin\Content\ReelResource;
use App\Models\Reel;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class ListReelsAction
{
    public function handle(): JsonResponse
    {
        $default = (int) config('performance.pagination.default');
        $max = (int) config('performance.pagination.max');
        $perPage = max(1, min((int) request()->integer('per_page', $default), $max));

        $query = QueryBuilder::for(Reel::class)
            ->select([
                'id',
                'uuid',
                'status',
                'is_featured',
                'locale',
                'translation_group',
                'title',
                'slug',
                'media_asset_id',
                'author_id',
                'published_at',
                'created_at',
                'deleted_at',
            ])
            ->with(['author:id,name', 'mediaAsset', 'engagementCounter'])
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('locale'),
                AllowedFilter::partial('title'),
            )
            ->allowedSorts('id', 'title', 'created_at', 'published_at', 'sort_order')
            ->defaultSort('-created_at');

        $trashed = (string) request()->query('trashed', '');
        if ($trashed === 'only') {
            $query->onlyTrashed();
        } elseif ($trashed === 'with') {
            $query->withTrashed();
        }

        $reels = $query->paginate($perPage)->appends(request()->query());

        return ApiResponse::success(
            data: ReelResource::collection($reels)->resolve(),
            meta: [
                'pagination' => [
                    'total' => $reels->total(),
                    'count' => $reels->count(),
                    'per_page' => $reels->perPage(),
                    'current_page' => $reels->currentPage(),
                    'total_pages' => $reels->lastPage(),
                ],
            ]
        );
    }
}
