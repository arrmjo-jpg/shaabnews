<?php

declare(strict_types=1);

namespace App\Http\Resources\Public\Content;

use App\Models\MediaAsset;
use App\Support\Content\CommentGuard;
use App\Support\Content\PublicSeoBuilder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مورد تفصيلي للمقال العام — `content_html` مُعقَّم من قبل TipTapRenderer.
 *
 * الوسائط من article_media pivot → MediaAsset (P9.2 B.2a).
 *
 * بدون: content_json (داخلي للمحرّر)، أعلام إدارية، short_url، author_id الخام.
 */
class PublicArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'locale' => $this->locale,
            'title' => $this->title,
            'subtitle' => $this->subtitle,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'content_html' => $this->content,
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->pluck('name')->values()->all()),
            'published_at' => $this->published_at?->toISOString(),
            'views_count' => $this->views_count,
            'reading_time' => $this->content ? max(1, (int) round(count(preg_split('/\s+/u', strip_tags($this->content))) / 200)) : 0,
            'canonical_path' => $this->canonicalPath(),
            'seo' => PublicSeoBuilder::build($this->resource)->toArray(),
            // عقد الواجهة العامة: أعلام العرض + تفاعل + حالة الحدث المباشر.
            // SSoT للتعليقات: قيمة واحدة نهائيّة تدمج (إعدادات الموقع العامّة ∧ علَم المقال) عبر
            // CommentGuard — فتستهلك الواجهة قيمة واحدة دون إعادة تطبيق الشرط (مصدر الحقيقة الوحيد).
            'comments_enabled' => CommentGuard::enabledFor($this->resource),
            'event_status' => $this->event_status?->value,
            'is_live' => $this->type->value === 'live'
                && $this->event_status?->value === 'live',
            'flags' => [
                'breaking' => (bool) $this->is_breaking,
                'featured' => (bool) $this->is_featured,
                'header' => (bool) $this->is_header,
                'spotlight' => (bool) $this->is_editor_pick,
            ],
            'author' => $this->whenLoaded('author', fn (): array => [
                'id' => $this->author?->id,
                'name' => $this->author?->name,
                'bio' => $this->author?->bio,
                'avatar' => $this->authorAvatarUrl(),
                'is_writer' => (bool) $this->author?->is_writer,
                'role' => $this->author?->roles->first()?->name ?? ($this->author?->is_writer ? 'writer' : null),
                'articles_count' => (int) ($this->author?->articles_count ?? 0),
            ]),
            'primary_category' => $this->whenLoaded('primaryCategory', fn (): array => [
                'id' => $this->primaryCategory?->id,
                'name' => $this->primaryCategory?->name,
                'slug' => $this->primaryCategory?->slug,
            ]),
            'secondary_categories' => $this->whenLoaded('categories', fn () => $this->categories
                ->map(fn ($c) => ['name' => $c->name, 'slug' => $c->slug])
                ->values()
                ->all()
            ),
            'media' => $this->whenLoaded('mediaAssets', fn (): array => [
                'cover' => $this->coverItem(),
                'gallery' => $this->mediaAssets
                    ->filter(fn (MediaAsset $a): bool => $a->pivot->collection === 'gallery')
                    ->sortBy('pivot.position')
                    ->map(fn (MediaAsset $a) => $this->mapImage($a))
                    ->values()
                    ->all(),
                'video' => $this->mediaAssets
                    ->filter(fn (MediaAsset $a): bool => $a->pivot->collection === 'video')
                    ->sortBy('pivot.position')
                    ->map(fn (MediaAsset $a): array => [
                        'url' => $a->url(),
                        'mime' => $a->mime_type,
                    ])
                    ->values()
                    ->all(),
            ]),
        ];
    }

    private function coverItem(): ?array
    {
        $m = $this->mediaAssets
            ->first(fn (MediaAsset $a): bool => $a->pivot->collection === 'cover');

        if ($m) {
            return $this->mapImage($m);
        }

        // Author avatar fallback for opinion (مقال) when no explicit cover exists.
        if ($this->type->value === 'opinion') {
            $avatar = $this->resource->authorAvatarUrl();
            if ($avatar) {
                return [
                    'url' => $avatar,
                    'thumb' => $avatar,
                    'medium' => $avatar,
                    'name' => null,
                    'alt' => $this->author?->name,
                    'caption' => null,
                    'photographer' => null,
                    'source' => null,
                    'width' => null,
                    'height' => null,
                ];
            }
        }

        return null;
    }

    /** @return array<string,mixed> */
    private function mapImage(MediaAsset $m): array
    {
        return [
            'url' => $m->url(),
            'thumb' => $m->conversionUrl('thumb'),
            'medium' => $m->conversionUrl('medium'),
            'name' => $m->original_name,
            'alt' => $m->alt,
            'caption' => $m->caption,
            'photographer' => $m->credit,
            'source' => $m->source,
            'width' => $m->width,
            'height' => $m->height,
        ];
    }
}
