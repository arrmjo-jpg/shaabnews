<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Http\Resources\Admin\Sport\SportMenuItemResource;
use App\Models\SportMenuItem;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

final class CreateSportMenuItemAction
{
    public function handle(array $validated): JsonResponse
    {
        $item = SportMenuItem::create([
            'parent_id' => $validated['parent_id'] ?? null,
            'locale' => $validated['locale'],
            'title' => $validated['title'],
            'type' => $validated['type'],
            'category_id' => $validated['category_id'] ?? null,
            'section_key' => $validated['section_key'] ?? null,
            'icon' => $validated['icon'] ?? null,
            'order' => $validated['order'] ?? 0,
            'enabled' => $validated['enabled'] ?? true,
        ]);

        FrontendRevalidate::tags(['sport-menu']);

        return ApiResponse::success(__('sport.menu_item_created'), new SportMenuItemResource($item), 201);
    }
}
