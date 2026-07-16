<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Enums\BroadcastKind;
use App\Enums\BroadcastStatus;
use App\Models\Broadcast;

/**
 * حمولة SEO العامة للبثّ — مرآة VideoSeoBuilder، مكيَّفة لنطاق البثّ الخارجي:
 *
 *   - عربي فقط: لا hreflang (لا نسخ بلغات بديلة) — og:locale = ar_AR ثابت.
 *   - structured data: VideoObject (live/tv) أو AudioObject (radio)، مع publication
 *     من نوع BroadcastEvent (isLiveBroadcast + startDate/endDate) حين يكون حدثاً.
 *   - أمان: لا يُكشَف source_url مطلقاً في SEO (مصدر خارجي حسّاس) — og:video وembedUrl
 *     يشيران لصفحة المشغّل العامة لدينا (canonical)، لا لرابط البثّ الخام.
 *
 * المستهلك (SSR/التطبيق) يرسم وسوم <head>. لا markup وهمي: كل عقدة تُنقَّى عند غياب
 * مصدرها الفعلي.
 */
final class BroadcastSeoBuilder
{
    public static function build(Broadcast $broadcast): array
    {
        $absoluteUrl = PublicSeoBuilder::absoluteUrl($broadcast->canonicalPath());
        $title = $broadcast->seo_title !== null && $broadcast->seo_title !== ''
            ? $broadcast->seo_title
            : $broadcast->title;
        $description = self::description($broadcast);
        $image = $broadcast->shareImageUrl();
        $isRadio = $broadcast->kind === BroadcastKind::Radio;

        $siteName = PublicSeoBuilder::getSiteName();
        $twitterHandle = (string) config('seo.twitter.@username', '') ?: null;

        return [
            'title' => $title,
            'description' => $description,
            'keywords' => $broadcast->seo_keywords,
            'canonical_url' => $broadcast->canonical_url !== null && $broadcast->canonical_url !== ''
                ? $broadcast->canonical_url
                : $absoluteUrl,
            'robots' => $broadcast->robots !== null && $broadcast->robots !== ''
                ? $broadcast->robots
                : (string) config('seo.robots.default'),
            'image' => $image,
            'og' => array_filter([
                'type' => $isRadio ? 'website' : 'video.other',
                'site_name' => $siteName,
                'locale' => 'ar_AR',
                'title' => $title,
                'description' => $description,
                'url' => $absoluteUrl,
                'image' => $image,
                // مشغّل الفيديو = صفحتنا العامة (لا رابط البثّ الخام) — للبثّ المرئي فقط
                'video' => $isRadio ? null : $absoluteUrl,
                'video_secure_url' => $isRadio ? null : $absoluteUrl,
                'video_type' => $isRadio ? null : 'text/html',
            ], fn ($v): bool => $v !== null),
            'twitter' => array_filter([
                'card' => $image ? 'summary_large_image' : 'summary',
                'site' => $twitterHandle ? '@'.$twitterHandle : null,
                'title' => $title,
                'description' => $description,
                'image' => $image,
            ], fn ($v): bool => $v !== null),
            'structured_data' => self::structuredData($broadcast, $title, $description, $image, $absoluteUrl, $siteName),
        ];
    }

    private static function description(Broadcast $broadcast): ?string
    {
        if ($broadcast->seo_description !== null && $broadcast->seo_description !== '') {
            return $broadcast->seo_description;
        }

        if ($broadcast->excerpt !== null && $broadcast->excerpt !== '') {
            return $broadcast->excerpt;
        }

        return $broadcast->description;
    }

    /**
     * JSON-LD: VideoObject (مرئي) أو AudioObject (إذاعي). يُضاف publication كـ
     * BroadcastEvent متى توفّر زمن بدء (مجدول/مباشر/منتهٍ) — isLiveBroadcast=مباشر.
     * embedUrl = صفحتنا العامة؛ لا contentUrl (لا نستضيف ملفاً، والمصدر لا يُكشَف).
     */
    private static function structuredData(
        Broadcast $broadcast,
        string $title,
        ?string $description,
        ?string $image,
        string $embedUrl,
        string $siteName,
    ): array {
        $type = $broadcast->kind === BroadcastKind::Radio ? 'AudioObject' : 'VideoObject';
        $logo = PublicSeoBuilder::getPublisherLogo();
        $start = $broadcast->started_at ?? $broadcast->scheduled_at;

        $publication = $start !== null ? array_filter([
            '@type' => 'BroadcastEvent',
            'isLiveBroadcast' => $broadcast->status === BroadcastStatus::Live,
            'startDate' => $start->toISOString(),
            'endDate' => $broadcast->ended_at?->toISOString(),
        ], fn ($v): bool => $v !== null) : null;

        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => $type,
            'name' => $title,
            'description' => $description,
            'thumbnailUrl' => $image !== null ? [$image] : null,
            'uploadDate' => ($start ?? $broadcast->created_at)?->toISOString(),
            'embedUrl' => $embedUrl,
            'inLanguage' => 'ar',
            'publication' => $publication,
            'publisher' => array_filter([
                '@type' => 'Organization',
                'name' => PublicSeoBuilder::getPublisherName(),
                'logo' => $logo !== '' ? ['@type' => 'ImageObject', 'url' => $logo] : null,
            ], fn ($v): bool => $v !== null),
        ], fn ($v): bool => $v !== null);
    }
}
