<?php

declare(strict_types=1);

namespace App\Http\Resources\Admin\Content;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EntityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'external_ref' => $this->external_ref,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
