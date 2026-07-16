<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Models\TeamMember;
use Illuminate\Support\Str;

/**
 * حمولة SEO العامة لعضو الفريق — مرآة PublicSeoBuilder لكن لكيان شخص:
 *   - canonical المستقرّ (/team/{slug}، بلا بادئة locale — نطاق عربيّ أحادي)
 *   - OpenGraph (نوع profile) + Twitter (summary)
 *   - JSON-LD Person: jobTitle + image(ImageObject بأبعاد من MediaAsset) +
 *     worksFor(Organization) + sameAs(روابط التواصل) + knowsAbout(القسم)
 *   - BreadcrumbList (الرئيسية → فريق العمل → العضو)
 *
 * المستهلك (SSR/التطبيق) يرسم وسوم <head> منها. لا hreflang (أحاديّ اللغة). الصورة
 * من المكتبة المركزية (avatarAsset) — تُحمَّل مسبقاً قبل البناء (منع N+1).
 */
final class TeamMemberSeoBuilder
{
    public static function build(TeamMember $member): array
    {
        $absoluteUrl = PublicSeoBuilder::absoluteUrl($member->canonicalPath());

        $title = $member->seo_title !== null && $member->seo_title !== ''
            ? $member->seo_title
            : $member->name;

        $description = self::description($member);

        $asset = $member->avatarAsset;
        $imageUrl = $asset?->conversionUrl('medium') ?? $asset?->url();

        $siteName = PublicSeoBuilder::getSiteName();
        $twitterHandle = (string) config('seo.twitter.@username', '') ?: null;

        return [
            'title' => $title,
            'description' => $description,
            'keywords' => $member->seo_keywords,
            'canonical_url' => $member->canonical_url !== null && $member->canonical_url !== ''
                ? $member->canonical_url
                : $absoluteUrl,
            'robots' => $member->robots !== null && $member->robots !== ''
                ? $member->robots
                : (string) config('seo.robots.default'),
            'image' => $imageUrl,
            'og' => array_filter([
                'type' => 'profile',
                'site_name' => $siteName,
                'locale' => 'ar_AR',
                'title' => $title,
                'description' => $description,
                'url' => $absoluteUrl,
                'image' => $imageUrl,
                'image_width' => $asset?->width,
                'image_height' => $asset?->height,
            ], fn ($v): bool => $v !== null),
            'twitter' => array_filter([
                'card' => $imageUrl ? 'summary_large_image' : 'summary',
                'site' => $twitterHandle ? '@'.$twitterHandle : null,
                'title' => $title,
                'description' => $description,
                'image' => $imageUrl,
            ], fn ($v): bool => $v !== null),
            'structured_data' => self::personSchema($member, $absoluteUrl, $title, $description, $imageUrl, $siteName),
            'breadcrumbs' => self::breadcrumbs($member, $absoluteUrl),
        ];
    }

    /** الوصف: seo_description ثم نصّ bio مُجرَّد ومقصوص (~160) — وإلا null. */
    private static function description(TeamMember $member): ?string
    {
        $seo = $member->seo_description;
        if ($seo !== null && $seo !== '') {
            return $seo;
        }

        $bio = trim(strip_tags((string) $member->bio));

        return $bio !== '' ? Str::limit($bio, 160) : null;
    }

    /** JSON-LD Person — أقوى إشارة SEO لصفحات الأشخاص (sameAs يربط الحسابات الموثّقة). */
    private static function personSchema(
        TeamMember $member,
        string $url,
        string $title,
        ?string $description,
        ?string $imageUrl,
        string $siteName,
    ): array {
        $asset = $member->avatarAsset;

        // صورة كـ ImageObject مع الأبعاد إن توفّرت (أصلح لنتائج Google الغنية).
        $image = null;
        if ($imageUrl !== null) {
            $image = $asset?->width !== null && $asset?->height !== null
                ? ['@type' => 'ImageObject', 'url' => $imageUrl, 'width' => $asset->width, 'height' => $asset->height]
                : [$imageUrl];
        }

        // sameAs — روابط التواصل الموثّقة (إشارة هوية قوية للكيان).
        $sameAs = array_values(array_filter(
            array_map(
                static fn ($v): string => trim((string) $v),
                array_values($member->social_links ?? []),
            ),
            static fn (string $v): bool => $v !== '',
        ));

        $logo = PublicSeoBuilder::getPublisherLogo();

        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'Person',
            'name' => $member->name,
            'jobTitle' => $member->job_title,
            'description' => $description,
            'url' => $url,
            'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url],
            'image' => $image,
            'worksFor' => array_filter([
                '@type' => 'Organization',
                'name' => PublicSeoBuilder::getPublisherName(),
                'logo' => $logo !== '' ? ['@type' => 'ImageObject', 'url' => $logo] : null,
            ], fn ($v): bool => $v !== null),
            'knowsAbout' => $member->department,
            'sameAs' => $sameAs === [] ? null : $sameAs,
        ], fn ($v): bool => $v !== null);
    }

    /** BreadcrumbList: الرئيسية → فريق العمل → العضو. */
    private static function breadcrumbs(TeamMember $member, string $url): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => [
                [
                    '@type' => 'ListItem',
                    'position' => 1,
                    'name' => PublicSeoBuilder::getPublisherName(),
                    'item' => PublicSeoBuilder::absoluteUrl('/'),
                ],
                [
                    '@type' => 'ListItem',
                    'position' => 2,
                    'name' => __('team.breadcrumb'),
                    'item' => PublicSeoBuilder::absoluteUrl('/team'),
                ],
                [
                    '@type' => 'ListItem',
                    'position' => 3,
                    'name' => $member->name,
                    'item' => $url,
                ],
            ],
        ];
    }
}
