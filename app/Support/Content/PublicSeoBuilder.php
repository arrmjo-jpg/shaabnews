<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Models\Article;
use App\Settings\GeneralSettings;
use App\Support\Media\MediaUrl;
use App\Support\Media\SeoMediaResolver;

/**
 * Constructs the public-facing SEO payload for an Article.
 *
 * Output is consumed by the SSR/SSG public site (separate codebase) which
 * renders the actual `<head>` tags. Backend remains the source of truth for:
 *   - Canonical URL
 *   - hreflang siblings (by translation_group)
 *   - OpenGraph + Twitter card data
 *   - JSON-LD NewsArticle / Article structured data
 *
 * Single source of truth.
 */
final class PublicSeoBuilder
{
    public static function build(Article $article): SeoData
    {
        // GeneralSettings (Spatie Settings) — resolved per request. Spatie caches the *values*
        // internally; caching the settings **object** in the app cache is invalid: it round-trips
        // through (un)serialize and comes back as __PHP_Incomplete_Class, throwing on property access
        // (broke article-detail SEO ⇒ 500). Never cache the settings object.
        $settings = app(GeneralSettings::class);

        $siteName = $settings->getLocalizedName($article->locale);
        $absoluteUrl = self::absoluteUrl($article->canonicalPath());

        // Priority check for social sharing image:
        // 1. Custom og_image, 2. Article cover image, 3. Configured fallback, 4. Omit completely.
        $shareImage = self::shareImageObject($article, $settings);
        $coverUrl = $shareImage['url'] ?? null;

        $title = $article->seo_title !== null && $article->seo_title !== ''
            ? $article->seo_title
            : $article->title;

        $description = $article->seo_description !== null && $article->seo_description !== ''
            ? $article->seo_description
            : $article->excerpt;

        $twitterHandle = (string) config('seo.twitter.@username', '') ?: null;

        // Open Graph
        $og = [
            'type' => 'article',
            'site_name' => $siteName,
            'locale' => self::ogLocale($article->locale),
            'title' => $title,
            'description' => $description,
            'url' => $absoluteUrl,
            'article' => [
                'published_time' => $article->published_at?->toISOString(),
                'modified_time' => $article->updated_at?->toISOString(),
                'section' => $article->primaryCategory?->name,
                'tag' => $article->tags->pluck('name')->values()->all(),
                'author' => $article->author?->name,
            ],
        ];

        if ($coverUrl) {
            $og['image'] = $coverUrl;
            $og['image_width'] = $shareImage['width'] ?? null;
            $og['image_height'] = $shareImage['height'] ?? null;
            $og['image_secure_url'] = $shareImage['secure_url'] ?? null;
            $og['image_type'] = $shareImage['type'] ?? null;
        }

        // Twitter Cards
        $twitter = [
            'card' => $coverUrl ? 'summary_large_image' : 'summary',
            'site' => $twitterHandle ? '@'.$twitterHandle : null,
            'creator' => $twitterHandle ? '@'.$twitterHandle : null,
            'title' => $title,
            'description' => $description,
        ];

        if ($coverUrl) {
            $twitter['image'] = $coverUrl;
        }

        $structuredData = self::structuredData($article, $absoluteUrl, $shareImage, $title, $description, $siteName, $settings);
        $breadcrumbs = self::breadcrumbs($article, $settings);

        return new SeoData(
            title: $title,
            description: $description,
            keywords: $article->seo_keywords,
            canonicalUrl: $absoluteUrl,
            robots: $article->robots !== null && $article->robots !== ''
                ? $article->robots
                : (string) config('seo.robots.default'),
            image: $coverUrl,
            hreflang: self::hreflang($article),
            og: $og,
            twitter: $twitter,
            structuredData: $structuredData,
            breadcrumbs: $breadcrumbs
        );
    }

    /**
     * Resolves the sharing image based on strict priorities:
     * 1. og_image, 2. cover, 3. fallback, 4. null.
     */
    private static function shareImageObject(Article $article, GeneralSettings $settings): ?array
    {
        $asset = null;
        if ($article->og_image_id !== null) {
            $asset = $article->ogImage;
        }
        if ($asset === null) {
            $asset = $article->mediaAssets
                ->first(fn ($a): bool => $a->pivot->collection === 'cover');
        }

        if ($asset !== null) {
            return SeoMediaResolver::resolve($asset);
        }

        // opinion articles author avatar fallback
        if ($article->type->value === 'opinion') {
            $avatar = $article->authorAvatarUrl();
            if ($avatar !== null) {
                return SeoMediaResolver::resolve($avatar);
            }
        }

        // Dedicated fallback image configured
        $fallback = config('seo.image.fallback');
        if ($fallback) {
            return SeoMediaResolver::resolve($fallback);
        }

        return null;
    }

    /**
     * BreadcrumbList: Home → Category (if exists) → Article.
     */
    private static function breadcrumbs(Article $article, GeneralSettings $settings): array
    {
        $locale = $article->locale;
        $siteName = $settings->getLocalizedName($locale);

        $items = [[
            '@type' => 'ListItem',
            'position' => 1,
            'name' => $siteName,
            'item' => self::absoluteUrl($locale),
        ]];

        $position = 2;
        if ($article->primaryCategory !== null) {
            $items[] = [
                '@type' => 'ListItem',
                'position' => $position++,
                'name' => $article->primaryCategory->name,
                'item' => self::absoluteUrl($locale.'/'.$article->primaryCategory->slug),
            ];
        }

        $items[] = [
            '@type' => 'ListItem',
            'position' => $position,
            'name' => $article->title,
            'item' => self::absoluteUrl($article->canonicalPath()),
        ];

        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => $items,
        ];
    }

    /**
     * @return array<int,array{locale:string,url:string}>
     */
    private static function hreflang(Article $article): array
    {
        $selfUrl = self::absoluteUrl($article->canonicalPath());

        if ($article->translation_group === null || $article->translation_group === '') {
            return [
                ['locale' => $article->locale, 'url' => $selfUrl],
                ['locale' => 'x-default', 'url' => $selfUrl],
            ];
        }

        $siblings = Article::query()
            ->where('translation_group', $article->translation_group)
            ->published()
            ->with('primaryCategory:id,slug')
            ->get();

        $list = $siblings
            ->map(fn (Article $a): array => [
                'locale' => $a->locale,
                'url' => self::absoluteUrl($a->canonicalPath()),
            ])
            ->values()
            ->all();

        $default = $siblings->firstWhere('locale', 'ar') ?? $article;
        $list[] = ['locale' => 'x-default', 'url' => self::absoluteUrl($default->canonicalPath())];

        return $list;
    }

    /**
     * Build the JSON-LD NewsArticle schema.
     */
    private static function structuredData(
        Article $article,
        string $url,
        ?array $shareImage,
        string $title,
        ?string $description,
        string $siteName,
        GeneralSettings $settings
    ): array {
        $schemaType = $article->type->value === 'news' ? 'NewsArticle' : 'Article';

        $image = null;
        if ($shareImage !== null) {
            $image = isset($shareImage['width'], $shareImage['height'])
                ? array_filter([
                    '@type' => 'ImageObject',
                    'url' => $shareImage['url'],
                    'width' => $shareImage['width'],
                    'height' => $shareImage['height'],
                ], fn ($v): bool => $v !== null)
                : ['@type' => 'ImageObject', 'url' => $shareImage['url']];
        }

        // Publisher logo
        $logo = self::getPublisherLogo();

        $logoObject = null;
        if ($logo !== '') {
            $resolvedLogo = SeoMediaResolver::resolve($logo);
            if ($resolvedLogo) {
                $logoObject = array_filter([
                    '@type' => 'ImageObject',
                    'url' => $resolvedLogo['url'],
                    'width' => $resolvedLogo['width'] ?? null,
                    'height' => $resolvedLogo['height'] ?? null,
                ], fn ($v): bool => $v !== null);
            }
        }

        $pubName = self::getPublisherName($article->locale);

        $publisher = array_filter([
            '@type' => 'Organization',
            'name' => $pubName,
            'logo' => $logoObject,
        ], fn ($v): bool => $v !== null);

        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => $schemaType,
            'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url],
            'headline' => $title,
            'description' => $description,
            'image' => $image,
            'datePublished' => $article->published_at?->toISOString(),
            'dateModified' => $article->updated_at?->toISOString(),
            'author' => $article->author?->name
                ? ['@type' => 'Person', 'name' => $article->author->name]
                : null,
            'publisher' => $publisher,
            'articleSection' => $article->primaryCategory?->name,
            'keywords' => $article->seo_keywords,
            'inLanguage' => $article->locale,
        ], fn ($v) => $v !== null);
    }

    private static function ogLocale(string $locale): string
    {
        return match ($locale) {
            'ar' => 'ar_AR',
            'en' => 'en_US',
            default => $locale,
        };
    }

    public static function getSiteName(?string $locale = null): string
    {
        $settings = app(GeneralSettings::class);

        return $settings->getLocalizedName($locale);
    }

    public static function getPublisherName(?string $locale = null): string
    {
        $siteName = self::getSiteName($locale);
        $pubName = (string) config('seo.publisher.name', '');
        if ($pubName === '' || $pubName === 'Laravel') {
            $pubName = $siteName;
        }

        return $pubName;
    }

    public static function getPublisherLogo(): string
    {
        $logo = (string) config('seo.publisher.logo', '');
        if ($logo === '') {
            $settings = app(GeneralSettings::class);
            if ($settings->logo_light) {
                $logo = MediaUrl::forPublic($settings->logo_light) ?? '';
            }
        }

        return $logo;
    }

    public static function absoluteUrl(string $path): string
    {
        $baseUrl = (string) config('frontend.public_url');
        if ($baseUrl === '') {
            $baseUrl = (string) config('app.url');
        }

        return rtrim($baseUrl, '/').'/'.ltrim($path, '/');
    }
}
