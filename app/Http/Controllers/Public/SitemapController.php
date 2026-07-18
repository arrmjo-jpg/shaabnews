<?php

declare(strict_types=1);

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Category;
use App\Models\Reel;
use App\Models\TeamMember;
use App\Models\Video;
use App\Models\VideoCategory;
use App\Models\VideoPlaylist;
use App\Support\Cache\ArticleCacheTags;
use App\Support\Cache\CacheTtl;
use App\Support\Cache\ReelCacheTags;
use App\Support\Cache\TeamMemberCacheTags;
use App\Support\Cache\VideoCacheTags;
use App\Support\Content\PublicSeoBuilder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Sitemap\Sitemap;
use Spatie\Sitemap\SitemapIndex;
use Spatie\Sitemap\Tags\Sitemap as SitemapTag;
use Spatie\Sitemap\Tags\Url;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Sitemap delivery — XML over public web routes.
 *
 * Layout:
 *   /sitemap.xml                   → index pointing to per-locale sitemaps
 *   /sitemap-articles-{locale}.xml → published articles (with hreflang)
 *   /sitemap-categories-{locale}.xml → active categories
 *   /sitemap-news-{locale}.xml     → Google News (last 48 h, ≤ 1000 items)
 *
 * All responses cached under tag(s) so admin mutations invalidate them
 * (alignment with existing P7.1 cache flushing in admin actions).
 */
class SitemapController extends Controller
{
    private const NEWS_WINDOW_HOURS = 48;

    private const NEWS_MAX_ITEMS = 1000;

    private const ARTICLES_PER_SITEMAP = 50000;

    public function index(): HttpResponse
    {
        $xml = Cache::tags([ArticleCacheTags::SITEMAP, 'categories'])->remember(
            'public:sitemap:index',
            CacheTtl::MEDIUM,
            function (): string {
                $index = SitemapIndex::create();
                foreach (Article::LOCALES as $locale) {
                    $index->add(
                        SitemapTag::create(route('sitemap.articles', ['locale' => $locale]))
                    );
                    $index->add(
                        SitemapTag::create(route('sitemap.categories', ['locale' => $locale]))
                    );
                    $index->add(
                        SitemapTag::create(route('sitemap.news', ['locale' => $locale]))
                    );
                    $index->add(
                        SitemapTag::create(route('sitemap.reels', ['locale' => $locale]))
                    );
                    $index->add(
                        SitemapTag::create(route('sitemap.videos', ['locale' => $locale]))
                    );
                    $index->add(
                        SitemapTag::create(route('sitemap.video-categories', ['locale' => $locale]))
                    );
                    $index->add(
                        SitemapTag::create(route('sitemap.playlists', ['locale' => $locale]))
                    );
                }

                // فريق العمل — نطاق عربيّ أحادي (بلا locale): خريطة واحدة.
                $index->add(SitemapTag::create(route('sitemap.team')));

                return $index->render();
            }
        );

        return $this->xml($xml);
    }

    public function articles(string $locale): HttpResponse
    {
        if (! in_array($locale, Article::LOCALES, true)) {
            abort(404);
        }

        $xml = Cache::tags([ArticleCacheTags::SITEMAP])->remember(
            "public:sitemap:articles:{$locale}",
            CacheTtl::MEDIUM,
            function () use ($locale): string {
                $sitemap = Sitemap::create();

                // USE INDEX (لا FORCE INDEX): بلا هذا التلميح يختار محسّن MySQL
                // articles_locale_slug_unique (فهرس الـslug، لا صلة له بهذا الاستعلام) بدل
                // articles_status_locale_pub_idx المطابق تماماً لشرط الاستعلام وترتيبه — رغم
                // ANALYZE TABLE (قِيس: 32.6ث → 36.9ث، بلا تحسّن، نفس خطة "Using filesort").
                // نتيجة القرار الخاطئ: filesort على عشرات آلاف الصفّ بدل مسح فهرس عكسيّ مباشر
                // (32.6ث ← 0.34ث لنفس النتيجة عند إجبار الفهرس الصحيح — قياس، لا افتراض).
                // USE INDEX (توجيه، غير ملزم) بدل FORCE INDEX: يبقي الخيار الاحتياطيّ لمحسّن
                // MySQL إن أصبح غير مناسب مستقبلاً (تغيّر توزيع البيانات)، بلا قفل صلب لخطة واحدة.
                // select() مقصور على الأعمدة التي يقرأها هذا الحلقة فعلياً (id/canonicalPath
                // عبر published_at،created_at + updated_at + translation_group + locale) —
                // بلا SELECT *: كان يجرّ content_html/excerpt/… (نصوص كبيرة) لخمسين ألف صفّ
                // دفعة واحدة رغم عدم قراءتها هنا إطلاقاً. primaryCategory غير مُستخدَم في هذا
                // المتن (لا article->primaryCategory ولا sib->primaryCategory) ⇐ حُذف eager
                // load بلا فائدة (كان يُحمَّل ولا يُقرأ قطّ).
                $articles = Article::query()
                    ->from(DB::raw('`articles` USE INDEX (articles_status_locale_pub_idx)'))
                    ->published()
                    ->forLocale($locale)
                    ->select(['id', 'locale', 'published_at', 'created_at', 'updated_at', 'translation_group'])
                    ->orderByDesc('published_at')
                    ->limit(self::ARTICLES_PER_SITEMAP)
                    ->get();

                // Group siblings by translation_group for hreflang in one pass. نفس تضييق
                // الأعمدة — sib هنا لا يُقرَأ منه سوى canonicalPath()/locale (لا updated_at).
                $byGroup = Article::query()
                    ->published()
                    ->whereNotNull('translation_group')
                    ->whereIn('translation_group', $articles->pluck('translation_group')->filter())
                    ->select(['id', 'locale', 'published_at', 'created_at', 'translation_group'])
                    ->get()
                    ->groupBy('translation_group');

                foreach ($articles as $article) {
                    $url = Url::create(PublicSeoBuilder::absoluteUrl($article->canonicalPath()))
                        ->setLastModificationDate($article->updated_at ?? $article->published_at)
                        ->setChangeFrequency(Url::CHANGE_FREQUENCY_DAILY)
                        ->setPriority(0.8);

                    if ($article->translation_group !== null) {
                        $siblings = $byGroup->get($article->translation_group) ?? collect();
                        foreach ($siblings as $sib) {
                            $url->addAlternate(
                                PublicSeoBuilder::absoluteUrl($sib->canonicalPath()),
                                $sib->locale,
                            );
                        }
                    }

                    $sitemap->add($url);
                }

                return $sitemap->render();
            }
        );

        return $this->xml($xml);
    }

    public function categories(string $locale): HttpResponse
    {
        if (! in_array($locale, Article::LOCALES, true)) {
            abort(404);
        }

        $xml = Cache::tags(['categories'])->remember(
            "public:sitemap:categories:{$locale}",
            CacheTtl::LONG,
            function () use ($locale): string {
                $sitemap = Sitemap::create();
                $categories = Category::query()
                    ->active()
                    ->forLocale($locale)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get();

                foreach ($categories as $cat) {
                    $sitemap->add(
                        Url::create(PublicSeoBuilder::absoluteUrl("/{$locale}/{$cat->slug}"))
                            ->setLastModificationDate($cat->updated_at ?? $cat->created_at)
                            ->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)
                            ->setPriority(0.6)
                    );
                }

                return $sitemap->render();
            }
        );

        return $this->xml($xml);
    }

    public function news(string $locale): HttpResponse
    {
        if (! in_array($locale, Article::LOCALES, true)) {
            abort(404);
        }

        $xml = Cache::tags([ArticleCacheTags::SITEMAP])->remember(
            "public:sitemap:news:{$locale}",
            CacheTtl::SHORT,
            function () use ($locale): string {
                $siteName = PublicSeoBuilder::getSiteName();
                $sitemap = Sitemap::create();

                $articles = Article::query()
                    ->published()
                    ->forLocale($locale)
                    ->where('published_at', '>=', now()->subHours(self::NEWS_WINDOW_HOURS))
                    ->with(['primaryCategory:id,slug'])
                    ->orderByDesc('published_at')
                    ->limit(self::NEWS_MAX_ITEMS)
                    ->get();

                foreach ($articles as $article) {
                    if ($article->published_at === null) {
                        continue;
                    }

                    $sitemap->add(
                        Url::create(PublicSeoBuilder::absoluteUrl($article->canonicalPath()))
                            ->addNews(
                                name: $siteName,
                                language: $locale,
                                title: $article->title,
                                publicationDate: $article->published_at,
                            )
                    );
                }

                return $sitemap->render();
            }
        );

        return $this->xml($xml);
    }

    public function reels(string $locale): HttpResponse
    {
        if (! in_array($locale, Reel::LOCALES, true)) {
            abort(404);
        }

        // مُوسَم feed(locale) — يُبطَل عند أي كتابة ريل في اللغة (لا بقايا قديمة).
        $xml = Cache::tags(ReelCacheTags::feedTags($locale))->remember(
            "public:sitemap:reels:{$locale}",
            CacheTtl::MEDIUM,
            function () use ($locale): string {
                $sitemap = Sitemap::create();

                $reels = Reel::query()
                    ->published()
                    ->forLocale($locale)
                    ->orderByDesc('published_at')
                    ->limit(self::ARTICLES_PER_SITEMAP)
                    ->get();

                foreach ($reels as $reel) {
                    $sitemap->add(
                        Url::create(PublicSeoBuilder::absoluteUrl($reel->canonicalPath()))
                            ->setLastModificationDate($reel->updated_at ?? $reel->published_at)
                            ->setChangeFrequency(Url::CHANGE_FREQUENCY_DAILY)
                            ->setPriority(0.7)
                    );
                }

                return $sitemap->render();
            }
        );

        return $this->xml($xml);
    }

    public function videos(string $locale): HttpResponse
    {
        if (! in_array($locale, Video::LOCALES, true)) {
            abort(404);
        }

        // مُوسَم feed(locale) — يُبطَل عند أي كتابة فيديو منشورة في اللغة.
        $xml = Cache::tags(VideoCacheTags::feedTags($locale))->remember(
            "public:sitemap:videos:{$locale}",
            CacheTtl::MEDIUM,
            function () use ($locale): string {
                $sitemap = Sitemap::create();

                $videos = Video::query()
                    ->public()
                    ->playable()
                    ->forLocale($locale)
                    ->with('mediaAsset')
                    ->orderByDesc('published_at')
                    ->limit(self::ARTICLES_PER_SITEMAP)
                    ->get();

                foreach ($videos as $video) {
                    $page = PublicSeoBuilder::absoluteUrl($video->canonicalPath());
                    $url = Url::create($page)
                        ->setLastModificationDate($video->updated_at ?? $video->published_at)
                        ->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)
                        ->setPriority(0.7);

                    // إثراء بامتداد Google Video عند توفّر poster (وإلا رابط صفحة عادي).
                    $poster = $video->shareImageUrl();
                    if ($poster !== null && $poster !== '') {
                        $description = (string) ($video->description ?? '');
                        $url->addVideo(
                            thumbnailLoc: $poster,
                            title: (string) $video->title,
                            description: Str::limit($description !== '' ? $description : (string) $video->title, 2000, ''),
                            playerLoc: $page,
                        );
                    }

                    $sitemap->add($url);
                }

                return $sitemap->render();
            }
        );

        return $this->xml($xml);
    }

    public function videoCategories(string $locale): HttpResponse
    {
        if (! in_array($locale, VideoCategory::LOCALES, true)) {
            abort(404);
        }

        $xml = Cache::tags([VideoCacheTags::ALL])->remember(
            "public:sitemap:video-categories:{$locale}",
            CacheTtl::LONG,
            function () use ($locale): string {
                $sitemap = Sitemap::create();
                $categories = VideoCategory::query()
                    ->active()
                    ->forLocale($locale)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get();

                foreach ($categories as $cat) {
                    $sitemap->add(
                        Url::create(PublicSeoBuilder::absoluteUrl("/{$locale}/video-categories/{$cat->slug}"))
                            ->setLastModificationDate($cat->updated_at ?? $cat->created_at)
                            ->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)
                            ->setPriority(0.5)
                    );
                }

                return $sitemap->render();
            }
        );

        return $this->xml($xml);
    }

    public function playlists(string $locale): HttpResponse
    {
        if (! in_array($locale, VideoPlaylist::LOCALES, true)) {
            abort(404);
        }

        $xml = Cache::tags(VideoCacheTags::feedTags($locale))->remember(
            "public:sitemap:playlists:{$locale}",
            CacheTtl::MEDIUM,
            function () use ($locale): string {
                $sitemap = Sitemap::create();

                $playlists = VideoPlaylist::query()
                    ->public()
                    ->forLocale($locale)
                    ->orderByDesc('published_at')
                    ->limit(self::ARTICLES_PER_SITEMAP)
                    ->get();

                foreach ($playlists as $playlist) {
                    $sitemap->add(
                        Url::create(PublicSeoBuilder::absoluteUrl($playlist->canonicalPath()))
                            ->setLastModificationDate($playlist->updated_at ?? $playlist->published_at)
                            ->setChangeFrequency(Url::CHANGE_FREQUENCY_WEEKLY)
                            ->setPriority(0.6)
                    );
                }

                return $sitemap->render();
            }
        );

        return $this->xml($xml);
    }

    /** خريطة أعضاء الفريق النشِطين — نطاق عربيّ أحادي (بلا locale)، canonical /team/{slug}. */
    public function team(): HttpResponse
    {
        $xml = Cache::tags(TeamMemberCacheTags::feedTags())->remember(
            'public:sitemap:team',
            CacheTtl::LONG,
            function (): string {
                $sitemap = Sitemap::create();

                $members = TeamMember::query()
                    ->active()
                    ->ordered()
                    ->get();

                foreach ($members as $member) {
                    $sitemap->add(
                        Url::create(PublicSeoBuilder::absoluteUrl($member->canonicalPath()))
                            ->setLastModificationDate($member->updated_at ?? $member->created_at)
                            ->setChangeFrequency(Url::CHANGE_FREQUENCY_MONTHLY)
                            ->setPriority(0.5)
                    );
                }

                return $sitemap->render();
            }
        );

        return $this->xml($xml);
    }

    private function xml(string $body): HttpResponse
    {
        return response($body, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400',
        ]);
    }
}
