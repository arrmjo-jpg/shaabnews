<?php

declare(strict_types=1);

namespace App\Http\Resources\Public\Content;

use App\Models\MediaAsset;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مورد تحديث تغطية حيّة للقراءة العامة — حقول مُعقَّمة فقط.
 *
 * بدون: content_json (داخلي للمحرّر)، author_id الخام، created/updated الإدارية.
 * content_html مُعقَّم من قبل TipTapRenderer (allow-list).
 * الوسائط من article_media المشترك (صور + فيديو مرفوع/خارجي).
 */
class PublicLiveUpdateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'content_html' => $this->content,
            'is_pinned' => $this->is_pinned,
            'is_breaking' => $this->is_breaking,
            'is_featured' => $this->is_featured,
            'happened_at' => $this->happened_at?->toISOString(),
            'author' => $this->whenLoaded('author', fn (): array => [
                'id' => $this->author?->id,
                'name' => $this->author?->name,
                'slug' => $this->author?->slug,
            ]),
            'media' => $this->whenLoaded('mediaAssets', fn (): array => [
                'gallery' => $this->mediaAssets
                    ->filter(fn (MediaAsset $a): bool => in_array($a->pivot->collection, ['cover', 'gallery'], true))
                    ->sortBy('pivot.position')
                    ->map(fn (MediaAsset $a): array => [
                        'url' => $a->url(),
                        'thumb' => $a->conversionUrl('thumb'),
                        'medium' => $a->conversionUrl('medium'),
                        'alt' => $a->alt,
                    ])->values()->all(),
                'video' => $this->mediaAssets
                    ->filter(fn (MediaAsset $a): bool => $a->pivot->collection === 'video')
                    ->sortBy('pivot.position')
                    ->map(fn (MediaAsset $a): array => [
                        'url' => $a->url(),
                        'mime' => $a->mime_type,
                        'is_external' => $a->isExternal(),
                        'provider' => $a->provider,
                        'poster' => $a->posterUrl(),
                        'hls' => $a->hlsUrl(),
                    ])->values()->all(),
            ]),
        ];
    }
}
