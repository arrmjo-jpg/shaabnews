<?php

declare(strict_types=1);

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Reel;
use App\Models\Video;
use App\Support\Cache\ArticleCacheTags;
use App\Support\Cache\CacheTtl;
use App\Support\Cache\ReelCacheTags;
use App\Support\Cache\VideoCacheTags;
use App\Support\Content\PublicSeoBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * RSS 2.0 feeds (separate from the sitemap system) — one feed per content type.
 *
 *   /rss/news.xml    → latest published articles
 *   /rss/videos.xml  → latest public/playable videos
 *   /rss/reels.xml   → latest published reels
 *
 * Single-locale (default ar) per the spec. Each feed is cached under the SAME tag(s) as its
 * matching sitemap, so the existing publish→tag-flush invalidation (ArticleCacheTags /
 * VideoCacheTags / ReelCacheTags) regenerates the feed automatically — no new event system.
 * GUIDs are absolute canonical URLs (permanent), pubDate is RFC 822 — RSS 2.0 compliant.
 */
class RssController extends Controller
{
    /** Latest-items cap (spec: 20–50). */
    private const MAX_ITEMS = 30;

    /** Single-locale product — feeds serve the default locale. */
    private const LOCALE = 'ar';

    public function news(): HttpResponse
    {
        $xml = Cache::tags([ArticleCacheTags::SITEMAP])->remember(
            'public:rss:news',
            CacheTtl::SHORT,
            fn (): string => $this->render('rss.news', 'الأخبار', Article::query()
                ->published()
                ->forLocale(self::LOCALE)
                ->orderByDesc('published_at')
                ->limit(self::MAX_ITEMS)
                ->get()
                ->map(fn (Article $a): array => $this->item(
                    (string) $a->title,
                    $a->canonicalPath(),
                    $a->published_at,
                    (string) ($a->excerpt ?? ''),
                ))
                ->all()),
        );

        return $this->xml($xml);
    }

    public function videos(): HttpResponse
    {
        $xml = Cache::tags(VideoCacheTags::feedTags(self::LOCALE))->remember(
            'public:rss:videos',
            CacheTtl::MEDIUM,
            fn (): string => $this->render('rss.videos', 'الفيديو', Video::query()
                ->public()
                ->playable()
                ->forLocale(self::LOCALE)
                ->orderByDesc('published_at')
                ->limit(self::MAX_ITEMS)
                ->get()
                ->map(fn (Video $v): array => $this->item(
                    (string) $v->title,
                    $v->canonicalPath(),
                    $v->published_at,
                    (string) ($v->description ?: ($v->excerpt ?? '')),
                ))
                ->all()),
        );

        return $this->xml($xml);
    }

    public function reels(): HttpResponse
    {
        $xml = Cache::tags(ReelCacheTags::feedTags(self::LOCALE))->remember(
            'public:rss:reels',
            CacheTtl::MEDIUM,
            fn (): string => $this->render('rss.reels', 'الريلز', Reel::query()
                ->published()
                ->forLocale(self::LOCALE)
                ->orderByDesc('published_at')
                ->limit(self::MAX_ITEMS)
                ->get()
                ->map(fn (Reel $r): array => $this->item(
                    (string) $r->title,
                    $r->canonicalPath(),
                    $r->published_at,
                    (string) ($r->description ?? ''),
                ))
                ->all()),
        );

        return $this->xml($xml);
    }

    /** @param array<int,array<string,string>> $items */
    private function render(string $routeName, string $label, array $items): string
    {
        $siteName = PublicSeoBuilder::getPublisherName();

        $channel = [
            'title' => trim("{$siteName} — {$label}"),
            'link' => PublicSeoBuilder::absoluteUrl('/'.self::LOCALE),
            'feedUrl' => route($routeName),
            'description' => "{$label} — {$siteName}",
            'language' => self::LOCALE,
            'lastBuildDate' => now()->toRfc822String(),
        ];

        // Trim leading/trailing whitespace so the XML declaration is the first byte
        // (strict parsers reject any whitespace before it).
        return trim((string) view('rss.feed', ['channel' => $channel, 'items' => $items])->render());
    }

    /** @return array<string,string> */
    private function item(string $title, string $path, ?Carbon $publishedAt, string $description): array
    {
        $url = PublicSeoBuilder::absoluteUrl($path);

        return [
            'title' => $title,
            'link' => $url,
            // Permanent GUID = absolute canonical URL (never changes).
            'guid' => $url,
            'pubDate' => ($publishedAt ?? now())->toRfc822String(),
            'description' => Str::limit(trim(strip_tags($description)), 500),
        ];
    }

    private function xml(string $body): HttpResponse
    {
        return response($body, 200, [
            'Content-Type' => 'application/rss+xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400',
        ]);
    }
}
