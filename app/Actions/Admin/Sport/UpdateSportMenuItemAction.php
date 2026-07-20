<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Http\Resources\Admin\Sport\SportMenuItemResource;
use App\Models\SportMenuItem;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

final class UpdateSportMenuItemAction
{
    public function handle(SportMenuItem $item, array $validated): JsonResponse
    {
        foreach (['parent_id', 'locale', 'title', 'type', 'category_id', 'section_key', 'icon', 'order', 'enabled'] as $field) {
            if (array_key_exists($field, $validated)) {
                $item->{$field} = $validated[$field];
            }
        }

        $item->save();

        FrontendRevalidate::tags(['sport-menu']);

        return ApiResponse::success(__('sport.menu_item_updated'), new SportMenuItemResource($item->fresh()));
    }
}
