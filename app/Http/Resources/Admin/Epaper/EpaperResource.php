<?php

declare(strict_types=1);

namespace App\Http\Resources\Admin\Epaper;

use App\Models\Epaper;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Epaper
 */
class EpaperResource extends JsonResource
{
    /** @return array<string,mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'locale' => $this->locale,
            'issue_number' => $this->issue_number,
            'title' => $this->title,
            'subtitle' => $this->subtitle,
            'summary' => $this->summary,
            'brief_points' => $this->brief_points,
            'highlights' => $this->highlights,
            'inside_this_issue' => $this->inside_this_issue,
            'slug' => $this->slug,
            'status' => $this->status->value,
            'access_level' => $this->access_level->value,
            'publication_date' => $this->publication_date?->toDateString(),
            'current_version' => $this->current_version,
            'page_count' => $this->page_count,
            'media' => [
                'asset_id' => $this->media_asset_id,
                'pdf_url' => $this->whenLoaded('mediaAsset', fn () => $this->mediaAsset?->url()),
                'cover_url' => $this->whenLoaded('mediaAsset', fn (): ?string => $this->coverUrl()),
            ],
            'author' => $this->whenLoaded('author', fn () => $this->author ? [
                'id' => $this->author->id,
                'name' => $this->author->name,
            ] : null),
            'canonical_path' => $this->canonicalPath(),
            'published_at' => $this->published_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'deleted_at' => $this->deleted_at?->toISOString(),
        ];
    }
}
