<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Enums\VideoProvider;
use App\Models\Video;

/**
 * حمولة SEO العامة للفيديو — مرآة ReelSeoBuilder لكنها تغطّي مصدرَي الفيديو:
 *
 *   - مرفوع: HLS + نسخ MP4 + poster مشتقّ من المكتبة المركزية.
 *   - خارجي: embed_url + source_url + poster المزوّد (يوتيوب/فيميو/MP4 مباشر).
 *
 * تُنتج: canonical مستقرّ، hreflang siblings (+ x-default) عبر translation_group،
 * OpenGraph (video.other) + Twitter (player/summary)، وJSON-LD VideoObject مبني
 * على بيانات فعلية. المستهلك (SSR/التطبيق) يرسم وسوم <head>. لا markup وهمي:
 * كل عقدة تُنقَّى عند غياب مصدرها.
 */
final class VideoSeoBuilder
{
    public static function build(Video $video): array
    {
        $absoluteUrl = PublicSeoBuilder::absoluteUrl($video->canonicalPath());
        $title = $video->seo_title !== null && $video->seo_title !== '' ? $video->seo_title : $video->title;
        $description = $video->seo_description !== null && $video->seo_description !== ''
            ? $video->seo_description
            : $video->description;

        $media = $video->mediaAsset;
        $isExternal = $media?->isExternal() ?? false;
        $poster = $media?->posterUrl();

        // مصدر التشغيل: الخارجي يُضمَّن عبر embed_url؛ المرفوع عبر أعلى نسخة MP4
        // تقدّمية (توافق مشاركة أوسع) ثم HLS.
        $renditions = $media?->renditionUrls() ?? [];
        $progressive = is_array($renditions) && $renditions !== [] ? (string) end($renditions) : null;
        $hls = $isExternal ? null : $media?->hlsUrl();

        $playerUrl = $isExternal ? $media?->embed_url : ($progressive ?? $hls);
        $playerType = self::playerType($isExternal, $progressive, $hls);

        // VideoObject: contentUrl = ملف وسائط فعلي فقط؛ embedUrl = المشغّل.
        // للخارجي: MP4 المباشر يحمل ملفاً حقيقياً (source_url)؛ يوتيوب/فيميو لا يقدّمان
        // ملفاً مباشراً ⇒ نتركه null (Google يفضّل embedUrl وحده على رابط صفحة المشاهدة).
        $contentUrl = $isExternal
            ? ($media?->provider === VideoProvider::Mp4->value ? $media?->source_url : null)
            : ($progressive ?? $hls);
        $embedUrl = $isExternal ? $media?->embed_url : $absoluteUrl;

        $siteName = PublicSeoBuilder::getSiteName($video->locale);
        $twitterHandle = (string) config('seo.twitter.@username', '') ?: null;

        return [
            'title' => $title,
            'description' => $description,
            'keywords' => $video->seo_keywords,
            'canonical_url' => $video->canonical_url !== null && $video->canonical_url !== ''
                ? $video->canonical_url
                : $absoluteUrl,
            'robots' => $video->robots !== null && $video->robots !== ''
                ? $video->robots
                : (string) config('seo.robots.default'),
            'image' => $poster,
            'hreflang' => self::hreflang($video),
            'og' => array_filter([
                'type' => 'video.other',
                'site_name' => $siteName,
                'locale' => self::ogLocale($video->locale),
                'title' => $title,
                'description' => $description,
                'url' => $absoluteUrl,
                'image' => $poster,
                'video' => $playerUrl,
                'video_secure_url' => $playerUrl,
                'video_type' => $playerType,
                'video_duration' => $video->duration_seconds,
            ], fn ($v): bool => $v !== null),
            'twitter' => array_filter([
                'card' => $poster ? 'summary_large_image' : 'summary',
                'site' => $twitterHandle ? '@'.$twitterHandle : null,
                'title' => $title,
                'description' => $description,
                'image' => $poster,
            ], fn ($v): bool => $v !== null),
            'structured_data' => self::videoObject(
                $video, $title, $description, $poster, $contentUrl, $embedUrl, $siteName
            ),
        ];
    }

    /** نوع وسم og:video — text/html للمضمَّن الخارجي، mp4/HLS للمرفوع. */
    private static function playerType(bool $isExternal, ?string $progressive, ?string $hls): ?string
    {
        if ($isExternal) {
            return 'text/html';
        }

        return $progressive !== null
            ? 'video/mp4'
            : ($hls !== null ? 'application/x-mpegURL' : null);
    }

    /** @return array<int,array{locale:string,url:string}> */
    private static function hreflang(Video $video): array
    {
        $selfUrl = PublicSeoBuilder::absoluteUrl($video->canonicalPath());

        if ($video->translation_group === null || $video->translation_group === '') {
            return [
                ['locale' => $video->locale, 'url' => $selfUrl],
                ['locale' => 'x-default', 'url' => $selfUrl],
            ];
        }

        // الأخوة العامة فقط (لا نُعلن unlisted/private كبدائل hreflang).
        $siblings = Video::query()
            ->where('translation_group', $video->translation_group)
            ->public()
            ->get();

        if ($siblings->isEmpty()) {
            return [
                ['locale' => $video->locale, 'url' => $selfUrl],
                ['locale' => 'x-default', 'url' => $selfUrl],
            ];
        }

        $list = $siblings
            ->map(fn (Video $v): array => [
                'locale' => $v->locale,
                'url' => PublicSeoBuilder::absoluteUrl($v->canonicalPath()),
            ])
            ->values()
            ->all();

        $default = $siblings->firstWhere('locale', 'ar') ?? $siblings->first();
        $list[] = ['locale' => 'x-default', 'url' => PublicSeoBuilder::absoluteUrl($default->canonicalPath())];

        return $list;
    }

    /** JSON-LD VideoObject — يعمل للمرفوع (contentUrl) والخارجي (embedUrl). */
    private static function videoObject(
        Video $video,
        string $title,
        ?string $description,
        ?string $poster,
        ?string $contentUrl,
        ?string $embedUrl,
        string $siteName,
    ): array {
        $logo = PublicSeoBuilder::getPublisherLogo();

        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'VideoObject',
            'name' => $title,
            'description' => $description,
            'thumbnailUrl' => $poster ? [$poster] : null,
            'uploadDate' => $video->published_at?->toISOString(),
            'duration' => $video->duration_seconds ? 'PT'.$video->duration_seconds.'S' : null,
            'contentUrl' => $contentUrl,
            'embedUrl' => $embedUrl,
            'inLanguage' => $video->locale,
            'interactionStatistic' => $video->views_count > 0 ? [
                '@type' => 'InteractionCounter',
                'interactionType' => ['@type' => 'WatchAction'],
                'userInteractionCount' => $video->views_count,
            ] : null,
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
