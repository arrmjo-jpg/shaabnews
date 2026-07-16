<?php

declare(strict_types=1);

namespace App\Http\Resources\Public\VideoLibrary;

use App\Support\Content\PublicSeoBuilder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مورد قائمة التشغيل العام — حقول مُعقَّمة + الغلاف + عدّاد الأعضاء + (في التفاصيل)
 * الفيديوهات العامة المرتّبة بالـ position. SEO مُدمَج خفيف (canonical/OG/Twitter +
 * JSON-LD ItemList) — لا باني منفصل (تجنّب التجريد الاستباقي). الفيديوهات المضمّنة
 * مُصفّاة مسبقاً في الـ Action إلى العامة القابلة للتشغيل فقط (لا تسريب مسودات).
 */
class PublicPlaylistResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'locale' => $this->locale,
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description,
            'is_featured' => $this->is_featured,
            'published_at' => $this->published_at?->toISOString(),
            'canonical_path' => $this->canonicalPath(),
            'cover' => $this->whenLoaded('cover', fn (): ?string => $this->cover?->posterUrl() ?? $this->cover?->url()),
            // العدّاد: من المجموعة المُحمَّلة (التفاصيل) أو withCount (القائمة) — متوفّر دائماً.
            'videos_count' => $this->relationLoaded('videos')
                ? $this->videos->count()
                : $this->whenCounted('videos'),
            'videos' => PublicVideoCardResource::collection($this->whenLoaded('videos')),
            'seo' => $this->playlistSeo(),
        ];
    }

    /** SEO مُدمَج لقائمة التشغيل — canonical/OG/Twitter + ItemList بنيوي. */
    private function playlistSeo(): array
    {
        $url = PublicSeoBuilder::absoluteUrl($this->canonicalPath());
        $title = $this->seo_title !== null && $this->seo_title !== '' ? $this->seo_title : $this->title;
        $description = $this->seo_description !== null && $this->seo_description !== ''
            ? $this->seo_description
            : $this->description;
        $cover = $this->relationLoaded('cover') ? ($this->cover?->posterUrl() ?? $this->cover?->url()) : null;

        $siteName = PublicSeoBuilder::getSiteName();
        $twitterHandle = (string) config('seo.twitter.@username', '') ?: null;

        return [
            'title' => $title,
            'description' => $description,
            'keywords' => $this->seo_keywords,
            'canonical_url' => $this->canonical_url !== null && $this->canonical_url !== ''
                ? $this->canonical_url
                : $url,
            'robots' => $this->robots !== null && $this->robots !== ''
                ? $this->robots
                : (string) config('seo.robots.default'),
            'image' => $cover,
            'og' => array_filter([
                'type' => 'video.other',
                'site_name' => $siteName,
                'locale' => self::ogLocale($this->locale),
                'title' => $title,
                'description' => $description,
                'url' => $url,
                'image' => $cover,
            ], fn ($v): bool => $v !== null),
            'twitter' => array_filter([
                'card' => $cover ? 'summary_large_image' : 'summary',
                'site' => $twitterHandle ? '@'.$twitterHandle : null,
                'title' => $title,
                'description' => $description,
                'image' => $cover,
            ], fn ($v): bool => $v !== null),
            'structured_data' => $this->itemList($url),
        ];
    }

    /** JSON-LD ItemList — يُبنى من الفيديوهات المُحمَّلة فقط (إن وُجدت). */
    private function itemList(string $url): array
    {
        $elements = [];
        if ($this->relationLoaded('videos')) {
            $position = 1;
            foreach ($this->videos as $video) {
                $elements[] = [
                    '@type' => 'ListItem',
                    'position' => $position++,
                    'url' => PublicSeoBuilder::absoluteUrl($video->canonicalPath()),
                    'name' => $video->title,
                ];
            }
        }

        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'ItemList',
            'name' => $this->title,
            'url' => $url,
            'numberOfItems' => $elements === [] ? null : count($elements),
            'itemListElement' => $elements === [] ? null : $elements,
        ], fn ($v): bool => $v !== null);
    }

    private static function ogLocale(string $locale): string
    {
        return match ($locale) {
            'ar' => 'ar_AR',
            'en' => 'en_US',
            default => $locale,
        };
    }
}
