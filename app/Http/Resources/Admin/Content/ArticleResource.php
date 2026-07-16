<?php

declare(strict_types=1);

namespace App\Http\Resources\Admin\Content;

use App\Support\Content\ArticleMediaPresenter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مورد المقال (لوحة الإدارة) — مخرَج deterministic، لا نماذج خام.
 */
class ArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'status' => $this->status->value,
            'locale' => $this->locale,
            'translation_group' => $this->translation_group,
            'title' => $this->title,
            'subtitle' => $this->subtitle,
            'slug' => $this->slug,
            'short_url' => $this->short_url,
            'excerpt' => $this->excerpt,
            // P4-D1: content_json مصدر الحقيقة؛ content_html عرض مشتقّ مُعقَّم
            'content_json' => $this->content_json,
            'content_html' => $this->content,
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->pluck('name')->values()),
            'seo' => [
                'title' => $this->seo_title,
                'description' => $this->seo_description,
                'keywords' => $this->seo_keywords,
                'canonical_url' => $this->canonical_url,
                'robots' => $this->robots,
            ],
            'og_image_id' => $this->og_image_id,
            'og_image' => $this->whenLoaded('ogImage', fn () => $this->ogImage?->url()),
            'canonical_path' => $this->canonicalPath(),
            'is_featured' => $this->is_featured,
            'is_breaking' => $this->is_breaking,
            'is_pinned' => $this->is_pinned,
            'is_header' => $this->is_header,
            'is_editor_pick' => $this->is_editor_pick,
            'is_squares' => $this->is_squares,
            'event_status' => $this->event_status?->value,
            'comments_enabled' => $this->comments_enabled,
            'published_at' => $this->published_at?->toISOString(),
            'deleted_at' => $this->deleted_at?->toISOString(),
            'views_count' => $this->views_count,
            // مقاييس التفاعل الموحّدة (عند تحميل العدّاد مسبقاً — لا N+1).
            'metrics' => $this->whenLoaded('engagementCounter', fn (): array => [
                'views' => (int) ($this->engagementCounter->views ?? 0),
                'likes' => (int) ($this->engagementCounter->likes ?? 0),
                'dislikes' => (int) ($this->engagementCounter->dislikes ?? 0),
                'favorites' => (int) ($this->engagementCounter->favorites ?? 0),
            ]),
            'author' => $this->whenLoaded('author', fn () => [
                'id' => $this->author?->id,
                'name' => $this->author?->name,
                'avatar' => $this->author?->avatar,
            ]),
            'primary_category' => $this->whenLoaded('primaryCategory', fn () => [
                'id' => $this->primaryCategory?->id,
                'name' => $this->primaryCategory?->name,
                'slug' => $this->primaryCategory?->slug,
            ]),
            'secondary_categories' => $this->whenLoaded('categories', fn () => $this->categories
                ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'slug' => $c->slug])
                ->values()
            ),
            'media' => $this->whenLoaded('mediaAssets', fn (): array => ArticleMediaPresenter::admin($this->resource)),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
