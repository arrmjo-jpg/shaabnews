<?php

declare(strict_types=1);

namespace App\Http\Resources\Public\Content;

use App\Models\MediaAsset;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مورد عرض المقال في القوائم العامة — حقول مُعقَّمة فقط.
 *
 * الوسائط من article_media pivot → MediaAsset (P9.2 B.2a).
 * `content_html` لا يُضمَّن في القوائم (يُبقى للتفاصيل).
 */
class PublicArticleListItemResource extends JsonResource
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
            'published_at' => $this->published_at?->toISOString(),
            // أعلام شارة كرت الهيرو (مصدر حقيقيّ، لا تلفيق) — مطابقة مورد التفصيل: عاجل + مباشر.
            // is_featured/is_header عمداً غائبان هنا (أعلام تحرير داخليّة) — المسار الصحيح
            // للمحتوى المميَّز/الهيدر هو /feed/hero و/feed/header المخصَّصان (DEC-001).
            'is_breaking' => (bool) $this->is_breaking,
            'is_squares' => (bool) $this->is_squares,
            'is_live' => $this->type->value === 'live'
                && $this->event_status?->value === 'live',
            'canonical_path' => $this->canonicalPath(),
            'author' => $this->whenLoaded('author', fn (): array => [
                'id' => $this->author?->id,
                'name' => $this->author?->name,
                // صورة الكاتب — يستخدمها الهيرو بديلاً عند غياب غلاف الخبر.
                'avatar' => $this->authorAvatarUrl(),
                // علم الكاتب المفعّل — الواجهة تربط الاسم ببروفيل عامّ فقط إن كان true (وإلّا نصّ).
                'is_writer' => (bool) $this->author?->is_writer,
            ]),
            'primary_category' => $this->whenLoaded('primaryCategory', fn (): array => [
                'name' => $this->primaryCategory?->name,
                'slug' => $this->primaryCategory?->slug,
            ]),
            'cover' => $this->whenLoaded('mediaAssets', fn () => $this->coverItem()),
        ];
    }

    private function coverItem(): ?array
    {
        $m = $this->mediaAssets
            ->first(fn (MediaAsset $a): bool => $a->pivot->collection === 'cover');

        if ($m !== null) {
            return [
                'url' => $m->url(),
                'thumb' => $m->conversionUrl('thumb'),
                'medium' => $m->conversionUrl('medium'),
                'alt' => $m->alt,
            ];
        }

        // المقال (opinion) بلا غلاف → صورة الكاتب بديلاً (نفس سلوك صفحة التفصيل).
        if ($this->type->value === 'opinion') {
            $avatar = $this->authorAvatarUrl();
            if ($avatar) {
                return ['url' => $avatar, 'thumb' => $avatar, 'medium' => $avatar, 'alt' => $this->author?->name];
            }
        }

        return null;
    }
}
