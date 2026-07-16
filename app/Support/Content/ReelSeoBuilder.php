<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Models\Reel;

/**
 * حمولة SEO العامة للريل (فيديو) — مرآة PublicSeoBuilder لكن لنوع الفيديو:
 *   - canonical المستقرّ (id-slug)
 *   - hreflang siblings (+ x-default) عبر translation_group
 *   - OpenGraph (نوع video) + Twitter (player/summary)
 *   - JSON-LD VideoObject (thumbnail/uploadDate/duration/contentUrl)
 *
 * المستهلك (SSR/التطبيق) يرسم وسوم <head> منها. لا بنية مشاركة موازية — يُعاد
 * استخدام أعمدة SEO الأصلية + poster/HLS من المكتبة المركزية. لا markup وهمي:
 * كل عقدة مبنيّة على بيانات فعلية وتُنقَّى عند الغياب.
 */
final class ReelSeoBuilder
{
    public static function build(Reel $reel): array
    {
        $absoluteUrl = PublicSeoBuilder::absoluteUrl($reel->canonicalPath());
        $title = $reel->seo_title !== null && $reel->seo_title !== '' ? $reel->seo_title : $reel->title;
        $description = $reel->seo_description !== null && $reel->seo_description !== ''
            ? $reel->seo_description
            : $reel->description;

        $poster = $reel->mediaAsset?->posterUrl();
        $hls = $reel->mediaAsset?->hlsUrl();
        $renditions = $reel->mediaAsset?->renditionUrls() ?? [];
        // أعلى نسخة MP4 تقدّمية كـ contentUrl (توافق مشاركة أوسع من HLS).
        $progressive = is_array($renditions) && $renditions !== [] ? (string) end($renditions) : null;

        $siteName = PublicSeoBuilder::getSiteName($reel->locale);
        $twitterHandle = (string) config('seo.twitter.@username', '') ?: null;

        return [
            'title' => $title,
            'description' => $description,
            'keywords' => $reel->seo_keywords,
            'canonical_url' => $reel->canonical_url !== null && $reel->canonical_url !== ''
                ? $reel->canonical_url
                : $absoluteUrl,
            'robots' => $reel->robots !== null && $reel->robots !== ''
                ? $reel->robots
                : (string) config('seo.robots.default'),
            'image' => $poster,
            'hreflang' => self::hreflang($reel),
            'og' => array_filter([
                'type' => 'video.other',
                'site_name' => $siteName,
                'locale' => self::ogLocale($reel->locale),
                'title' => $title,
                'description' => $description,
                'url' => $absoluteUrl,
                'image' => $poster,
                'video' => $progressive ?? $hls,
                'video_secure_url' => $progressive ?? $hls,
                'video_type' => $progressive !== null ? 'video/mp4' : ($hls !== null ? 'application/x-mpegURL' : null),
                'video_duration' => $reel->duration_seconds,
            ], fn ($v): bool => $v !== null),
            'twitter' => array_filter([
                'card' => $poster ? 'summary_large_image' : 'summary',
                'site' => $twitterHandle ? '@'.$twitterHandle : null,
                'title' => $title,
                'description' => $description,
                'image' => $poster,
            ], fn ($v): bool => $v !== null),
            'structured_data' => self::videoObject($reel, $absoluteUrl, $title, $description, $poster, $progressive ?? $hls, $siteName),
        ];
    }

    /** @return array<int,array{locale:string,url:string}> */
    private static function hreflang(Reel $reel): array
    {
        $selfUrl = PublicSeoBuilder::absoluteUrl($reel->canonicalPath());

        if ($reel->translation_group === null || $reel->translation_group === '') {
            return [
                ['locale' => $reel->locale, 'url' => $selfUrl],
                ['locale' => 'x-default', 'url' => $selfUrl],
            ];
        }

        $siblings = Reel::query()
            ->where('translation_group', $reel->translation_group)
            ->published()
            ->get();

        $list = $siblings
            ->map(fn (Reel $r): array => [
                'locale' => $r->locale,
                'url' => PublicSeoBuilder::absoluteUrl($r->canonicalPath()),
            ])
            ->values()
            ->all();

        $default = $siblings->firstWhere('locale', 'ar') ?? $reel;
        $list[] = ['locale' => 'x-default', 'url' => PublicSeoBuilder::absoluteUrl($default->canonicalPath())];

        return $list;
    }

    /** JSON-LD VideoObject — الفيديو القصير. */
    private static function videoObject(
        Reel $reel,
        string $url,
        string $title,
        ?string $description,
        ?string $poster,
        ?string $contentUrl,
        string $siteName,
    ): array {
        $logo = PublicSeoBuilder::getPublisherLogo();

        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'VideoObject',
            'name' => $title,
            'description' => $description,
            'thumbnailUrl' => $poster ? [$poster] : null,
            'uploadDate' => $reel->published_at?->toISOString(),
            'duration' => $reel->duration_seconds ? 'PT'.$reel->duration_seconds.'S' : null,
            'contentUrl' => $contentUrl,
            'embedUrl' => $url,
            'inLanguage' => $reel->locale,
            'publisher' => array_filter([
                '@type' => 'Organization',
                'name' => PublicSeoBuilder::getPublisherName(),
                'logo' => $logo !== '' ? ['@type' => 'ImageObject', 'url' => $logo] : null,
            ], fn ($v): bool => $v !== null),
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
