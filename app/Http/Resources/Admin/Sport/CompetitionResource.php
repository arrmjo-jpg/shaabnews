<?php

declare(strict_types=1);

namespace App\Http\Resources\Admin\Sport;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CompetitionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'provider' => $this->provider,
            'provider_id' => $this->provider_id,
            'name' => $this->name,
            'logo_url' => $this->logo_url,
            'is_active' => $this->is_active,

            'is_tracked' => $this->is_tracked,
            'last_synced_at' => $this->last_synced_at?->toISOString(),

            'is_featured_tournament' => $this->is_featured_tournament,
            'featured_until' => $this->featured_until?->toDateString(),
            'show_in_match_bar' => $this->show_in_match_bar,
            'match_bar_sort_order' => $this->match_bar_sort_order,

            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
