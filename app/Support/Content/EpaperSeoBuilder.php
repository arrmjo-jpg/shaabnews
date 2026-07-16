<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Models\Epaper;

/**
 * حمولة SEO العامة لعدد الجريدة — حدّ أدنى للمرحلة 2أ (عنوان/وصف/canonical/OG/Twitter).
 * المخطّط المنظَّم (PublicationIssue/schema.org) وخريطة الموقع مؤجَّلان لمعنى SEO (#14).
 * الـ canonical يشير دائماً للرابط الأساسي للعدد (لا /p/{n}) لتفادي ازدواج المحتوى.
 */
final class EpaperSeoBuilder
{
    /** @return array<string,mixed> */
    public static function build(Epaper $epaper): array
    {
        $absoluteUrl = PublicSeoBuilder::absoluteUrl($epaper->canonicalPath());
        $title = $epaper->title;
        $description = $epaper->summary ?? $epaper->subtitle;
        $siteName = PublicSeoBuilder::getSiteName($epaper->locale);
        $ogLocale = $epaper->locale === 'en' ? 'en_US' : 'ar_AR';
        $twitterHandle = (string) config('seo.twitter.@username', '') ?: null;

        return [
            'title' => $title,
            'description' => $description,
            'canonical_url' => $absoluteUrl,
            'robots' => (string) config('seo.robots.default', 'index, follow'),
            'og' => array_filter([
                'type' => 'article',
                'site_name' => $siteName,
                'locale' => $ogLocale,
                'title' => $title,
                'description' => $description,
                'url' => $absoluteUrl,
            ], fn ($v): bool => $v !== null && $v !== ''),
            'twitter' => array_filter([
                'card' => 'summary',
                'site' => $twitterHandle ? '@'.$twitterHandle : null,
                'title' => $title,
                'description' => $description,
            ], fn ($v): bool => $v !== null && $v !== ''),
        ];
    }
}
