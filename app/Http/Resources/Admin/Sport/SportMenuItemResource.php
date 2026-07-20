<?php

declare(strict_types=1);

namespace App\Http\Resources\Admin\Sport;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SportMenuItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'locale' => $this->locale,
            'title' => $this->title,
            'type' => $this->type,
            'category_id' => $this->category_id,
            'section_key' => $this->section_key,
            'icon' => $this->icon,
            'order' => $this->order,
            'enabled' => $this->enabled,
            'created_at' => $this->created_at?->toISOString(),
            'children' => SportMenuItemResource::collection($this->whenLoaded('children')),
        ];
    }
}
