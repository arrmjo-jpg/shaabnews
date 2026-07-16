<?php

declare(strict_types=1);

namespace App\Actions\Admin\Advertising;

use App\Http\Resources\Admin\Advertising\AdCampaignResource;
use App\Models\AdCampaign;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * قائمة حملات الإدارة — ترشيح/فرز/ترقيم + رؤية المحذوف (trashed). تشمل عدّاد الإبداعات
 * لإرشاد الإدارة. تتبع اتفاقية الترقيم الموحّدة (performance.pagination + meta.pagination).
 */
class ListAdCampaignsAction
{
    public function handle(): JsonResponse
    {
        $default = (int) config('performance.pagination.default');
        $max = (int) config('performance.pagination.max');
        $perPage = max(1, min((int) request()->integer('per_page', $default), $max));

        $query = QueryBuilder::for(AdCampaign::class)
            ->select([
                'id',
                'uuid',
                'status',
                'name',
                'priority',
                'pacing_mode',
                'starts_at',
                'ends_at',
                'created_at',
                'deleted_at',
                'advertiser_name',
                'total_budget',
                'daily_budget',
            ])
            ->withCount('creatives')
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('pacing_mode'),
                AllowedFilter::partial('name'),
                AllowedFilter::partial('advertiser_name'),
            )
            ->allowedSorts('id', 'name', 'priority', 'starts_at', 'ends_at', 'created_at')
            ->defaultSort('-created_at');

        $trashed = (string) request()->query('trashed', '');
        if ($trashed === 'only') {
            $query->onlyTrashed();
        } elseif ($trashed === 'with') {
            $query->withTrashed();
        }

        $campaigns = $query->paginate($perPage)->appends(request()->query());

        return ApiResponse::success(
            data: AdCampaignResource::collection($campaigns)->resolve(),
            meta: [
                'pagination' => [
                    'total' => $campaigns->total(),
                    'count' => $campaigns->count(),
                    'per_page' => $campaigns->perPage(),
                    'current_page' => $campaigns->currentPage(),
                    'total_pages' => $campaigns->lastPage(),
                ],
            ]
        );
    }
}
