<?php

declare(strict_types=1);

namespace App\Actions\Admin\Broadcast;

use App\Http\Resources\Admin\Broadcast\BroadcastResource;
use App\Models\Broadcast;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * قائمة البثّ للإدارة — ترشيح/فرز/ترقيم + رؤية المحذوف (trashed). مرآة ListVideosAction.
 */
class ListBroadcastsAction
{
    public function handle(): JsonResponse
    {
        $default = (int) config('performance.pagination.default');
        $max = (int) config('performance.pagination.max');
        $perPage = max(1, min((int) request()->integer('per_page', $default), $max));

        $query = QueryBuilder::for(Broadcast::class)
            ->select([
                'id',
                'uuid',
                'status',
                'kind',
                'source_type',
                'category_id',
                'is_featured',
                'is_public',
                'title',
                'slug',
                'cover_media_id',
                'created_by',
                'scheduled_at',
                'started_at',
                'created_at',
                'deleted_at',
                'sort_order',
            ])
            ->with(['category:id,name,slug', 'creator:id,name'])
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('kind'),
                AllowedFilter::exact('source_type'),
                AllowedFilter::exact('category_id'),
                AllowedFilter::exact('is_featured'),
                AllowedFilter::exact('is_public'),
                AllowedFilter::partial('title'),
            )
            ->allowedSorts('id', 'title', 'created_at', 'scheduled_at', 'started_at', 'sort_order')
            ->defaultSort('-created_at');

        $trashed = (string) request()->query('trashed', '');
        if ($trashed === 'only') {
            $query->onlyTrashed();
        } elseif ($trashed === 'with') {
            $query->withTrashed();
        }

        $broadcasts = $query->paginate($perPage)->appends(request()->query());

        return ApiResponse::success(
            data: BroadcastResource::collection($broadcasts)->resolve(),
            meta: [
                'pagination' => [
                    'total' => $broadcasts->total(),
                    'count' => $broadcasts->count(),
                    'per_page' => $broadcasts->perPage(),
                    'current_page' => $broadcasts->currentPage(),
                    'total_pages' => $broadcasts->lastPage(),
                ],
            ]
        );
    }
}
