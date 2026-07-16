<?php

declare(strict_types=1);

namespace App\Support\Frontend;

use App\Models\Article;
use App\Models\Category;
use App\Models\Page;
use App\Models\Reel;
use App\Models\VideoCategory;

/**
 * يبني وسوم الكاش التي يجب إبطالها في الواجهة الأمامية (Next) عند كتابة محتوى.
 *
 * تطابق هذه الوسوم **حرفيّاً** وسوم fetch في الواجهة الفعليّة: frontend/src/lib/*.ts
 * (feed.ts: feed:hero/header/latest/most_read · articles.ts: article:{slug} · feed.ts: category:{slug}).
 * **بلا بادئة لغة** (روابط الواجهة العامّة locale-less). أي تغيير في وسوم lib يجب أن يُعكَس هنا —
 * يستقبلها POST /api/revalidate في الواجهة ويربطها بـrevalidateTag().
 */
final class FrontendCacheTags
{
    /**
     * وسوم المقال: الخلاصات المتأثّرة فعلاً + صفحة المقال + تصنيفاته (+ سلَغ قديم عند التغيير).
     *
     * إبطال محلّيّ (لا زائد): hero/header يُطلقان فقط إن كان المقال ضمن الكتلة (أو خرج منها
     * للتوّ — wasChanged بعد الحفظ)؛ تعديل مقال عاديّ لا يعيد بناء كتلتي الهوم هاتين.
     * latest/most_read دائمان (كلّ مقال منشور مرشّح فيهما).
     *
     * @return array<int,string>
     */
    public static function article(
        Article $article,
        ?string $oldSlug = null,
        array $oldCategorySlugs = [],
        array $oldTags = [],
        ?int $oldAuthorId = null,
    ): array {
        $slug = (string) $article->slug;

        $tags = [
            'homepage',        // getHomepageFeed (Hero, Latest, Breaking, Editors Pick)
            'feed:latest',     // getLatestFeed (قسم /latest + الشريط الإخباري)
            'feed:most_read',  // getMostReadFeed («الأكثر قراءة» + /trending)
            "article:{$slug}", // getArticle (صفحة تفاصيل المقال)
        ];

        // 1. Editors Pick, Hero, Header transitions
        if ($article->is_featured || $article->wasChanged('is_featured')) {
            $tags[] = 'feed:hero';
        }
        if ($article->is_header || $article->wasChanged('is_header')) {
            $tags[] = 'feed:header';
        }
        if ($article->is_editor_pick || $article->wasChanged('is_editor_pick')) {
            $tags[] = 'feed:editors_pick';
        }

        // 2. Slug transition
        if ($oldSlug !== null && $oldSlug !== '' && $oldSlug !== $slug) {
            $tags[] = "article:{$oldSlug}";
        }

        // 3. Category transitions
        $article->loadMissing(['primaryCategory:id,slug', 'categories:id,slug']);
        $categorySlugs = collect([$article->primaryCategory])
            ->merge($article->categories)
            ->filter()
            ->map(fn ($category): ?string => $category->slug)
            ->merge($oldCategorySlugs) // Append old categories!
            ->filter()
            ->unique();

        foreach ($categorySlugs as $categorySlug) {
            $tags[] = "category:{$categorySlug}";
        }

        // 4. Author transitions
        $authorId = $article->author_id;
        if ($authorId) {
            $tags[] = "author_articles:{$authorId}";
        }
        if ($oldAuthorId !== null && $oldAuthorId !== $authorId) {
            $tags[] = "author_articles:{$oldAuthorId}";
        }

        // 5. Tag transitions
        $article->loadMissing('tags');
        $currentTags = $article->tags->pluck('name')->all();
        $allTags = collect($currentTags)->merge($oldTags)->filter()->unique();

        foreach ($allTags as $tag) {
            $tags[] = "tag:{$tag}";
        }

        return $tags;
    }

    /**
     * وسوم الصفحة الثابتة: قائمة الصفحات (فوتر/هيدر) + صفحة التفاصيل (+ سلَغ قديم عند التغيير).
     *
     * @return array<int,string>
     */
    public static function page(Page $page, ?string $oldSlug = null): array
    {
        $locale = $page->locale;
        $slug = (string) $page->slug;

        $tags = [
            "page-feed:{$locale}",
            "page:{$locale}:{$slug}",
        ];

        if ($oldSlug !== null && $oldSlug !== '' && $oldSlug !== $slug) {
            $tags[] = "page:{$locale}:{$oldSlug}";
        }

        return $tags;
    }

    /**
     * وسوم الريل: خلاصة الريلز + صفحة الريل (+ سلَغ قديم عند التغيير). مستقلّة عن تصنيفات الأخبار.
     *
     * @return array<int,string>
     */
    public static function reel(Reel $reel, ?string $oldSlug = null): array
    {
        $locale = $reel->locale;
        $slug = (string) $reel->slug;

        $tags = [
            "reel-feed:{$locale}",
            "reel:{$locale}:{$slug}",
        ];

        if ($oldSlug !== null && $oldSlug !== '' && $oldSlug !== $slug) {
            $tags[] = "reel:{$locale}:{$oldSlug}";
        }

        return $tags;
    }

    /**
     * وسوم التصنيف: شجرة الأقسام (categories — تستهلكها بلوكات الهوم عبر getCategoryById)
     * + تنقّل الهيدر (site-settings — nav_categories ضمن /site) + قوائم قسمه. عند تغيّر
     * السلَغ: وسم القديم + مظلّة `articles` (روابط القسم/الـbreadcrumbs داخل صفحات المقالات
     * المُكاشة) — الاستخدام المشروع الوحيد للمظلّة.
     *
     * @return array<int,string>
     */
    public static function category(Category $category, ?string $oldSlug = null): array
    {
        $slug = (string) $category->slug;

        $tags = ['categories', 'site-settings', "category:{$slug}"];

        if ($oldSlug !== null && $oldSlug !== '' && $oldSlug !== $slug) {
            $tags[] = "category:{$oldSlug}";
            $tags[] = 'articles';
        }

        return $tags;
    }

    /**
     * وسوم تعليقات مقال — يطلقها الإشراف (الاعتماد/الرفض/الحذف يغيّر القائمة العامّة؛
     * الإنشاء العامّ pending فلا يُبطل شيئاً).
     *
     * @return array<int,string>
     */
    public static function comments(string $articleSlug): array
    {
        return ['comments', "comments:{$articleSlug}"];
    }

    /**
     * يترجم وسوم كاش الفيديو الخلفية (VideoCacheTags) إلى وسوم الواجهة المقابلة. يُستفاد
     * من أن أفعال الفيديو/قائمة التشغيل تحسب أصلاً مجموعة الإبطال الصحيحة (شاملةً القديم
     * عند تغيّر slug/locale)، فنترجمها بدل إعادة اشتقاقها:
     *
     *   videos:feed:{L}            → video-feed:{L}        (مكتبة + مميّز + رائج + ذو صلة + قوائم)
     *   videos:detail:{L}:{slug}   → video:{L}:{slug}      (صفحة المشاهدة)
     *   videos:category:{L}:{slug} → video-category:{L}:{slug}
     *   videos:playlist:{L}:{slug} → playlist:{L}:{slug}   (صفحة قائمة التشغيل)
     *
     * تُهمَل المظلّة (videos) ووسم الخرائط (videos:sitemap) — لا مقابل لهما في الواجهة.
     *
     * @param  array<int,string>  $backendTags
     * @return array<int,string>
     */
    public static function fromVideoTags(array $backendTags): array
    {
        $map = [
            'videos:feed:' => 'video-feed:',
            'videos:detail:' => 'video:',
            'videos:category:' => 'video-category:',
            'videos:playlist:' => 'playlist:',
        ];

        $out = [];
        foreach ($backendTags as $tag) {
            foreach ($map as $prefix => $frontPrefix) {
                if (str_starts_with($tag, $prefix)) {
                    $out[] = $frontPrefix.substr($tag, strlen($prefix));

                    break;
                }
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * وسوم تصنيف الفيديو — صفحة /video-categories/{slug} + خلاصة اللغة (أسماء التصنيفات
     * تظهر على البطاقات). تُستخدَم حين يُفرَّغ التصنيف بالمظلّة العامة (لا يمرّ بالمترجِم).
     *
     * @return array<int,string>
     */
    public static function videoCategory(VideoCategory $category): array
    {
        $locale = $category->locale;

        return [
            "video-feed:{$locale}",
            'video-category:'.$locale.':'.(string) $category->slug,
        ];
    }
}
