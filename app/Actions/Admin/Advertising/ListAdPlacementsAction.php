<?php

declare(strict_types=1);

namespace App\Actions\Admin\Advertising;

use App\Http\Resources\Admin\Advertising\AdPlacementResource;
use App\Models\AdPlacement;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * قائمة الإسنادات — ترشيح (مساحة/إبداع/نشاط) + فرز/ترقيم. تُحمَّل الإبداع/المساحة بأعمدة
 * رفيعة (incl. الوزن لحساب الوزن الفعّال بلا N+1). تتبع اتفاقية الترقيم الموحّدة.
 */
class ListAdPlacementsAction
{
    public function handle(): JsonResponse
    {
        $default = (int) config('performance.pagination.default');
        $max = (int) config('performance.pagination.max');
        $perPage = max(1, min((int) request()->integer('per_page', $default), $max));

        $query = QueryBuilder::for(AdPlacement::class)
            ->select([
                'id',
                'ad_zone_id',
                'ad_creative_id',
                'is_active',
                'weight',
                'created_at',
            ])
            ->with(['creative:id,title,type,weight', 'zone:id,key,name,placement_type'])
            ->allowedFilters(
                AllowedFilter::exact('ad_zone_id'),
                AllowedFilter::exact('ad_creative_id'),
                AllowedFilter::exact('is_active'),
            )
            ->allowedSorts('id', 'weight', 'created_at')
            ->defaultSort('-created_at');

        $placements = $query->paginate($perPage)->appends(request()->query());

        return ApiResponse::success(
            data: AdPlacementResource::collection($placements)->resolve(),
            meta: [
                'pagination' => [
                    'total' => $placements->total(),
                    'count' => $placements->count(),
                    'per_page' => $placements->perPage(),
                    'current_page' => $placements->currentPage(),
                    'total_pages' => $placements->lastPage(),
                ],
            ]
        );
    }
}
