<?php

declare(strict_types=1);

namespace App\Support\Frontend;

use App\Models\Article;
use App\Models\Broadcast;
use App\Models\Category;
use App\Models\Epaper;
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
     * وسوم المقال: الخلاصات المتأثّرة فعلاً + صفحة المقال + تصنيفاته.
     *
     * إبطال محلّيّ (لا زائد): hero/header يُطلقان فقط إن كان المقال ضمن الكتلة (أو خرج منها
     * للتوّ — wasChanged بعد الحفظ)؛ تعديل مقال عاديّ لا يعيد بناء كتلتي الهوم هاتين.
     * latest/most_read دائمان (كلّ مقال منشور مرشّح فيهما).
     *
     * وسم صفحة المقال (article:{id}) صار مبنيّاً من id المقال حصراً (2026-07-18،
     * إصلاح جذريّ لتضارب الكاش — راجع docs/architecture/CACHE-INVALIDATION.md §11).
     * الـ id ثابت لا يتغيّر أبداً، فلا حاجة لتتبّع "قديم" كما كان الحال مع الـ slug
     * (الذي بات زخرفياً بالكامل في الرابط العامّ الجديد /news/dd/mm/yyyy/{id}/).
     *
     * @return array<int,string>
     */
    public static function article(
        Article $article,
        array $oldCategorySlugs = [],
        array $oldTags = [],
        ?int $oldAuthorId = null,
    ): array {
        $tags = [
            'homepage',        // getHomepageFeed (Hero, Latest, Breaking, Editors Pick)
            'feed:latest',     // getLatestFeed (قسم /latest + الشريط الإخباري)
            'feed:most_read',  // getMostReadFeed («الأكثر قراءة» + /trending)
            "article:{$article->id}", // getArticle (صفحة تفاصيل المقال) — بالـ id فقط
            // P0 (Cache Invalidation Audit): searchArticles() تستخدم هذا الوسم لكنه لم يكن
            // يُبطَل إطلاقًا — نتيجة بحث لمقال جديد/محذوف كانت تنتظر سقف revalidate=60 فقط.
            'search',
            // إبطال احتياطي مؤقت (2026-08-12): يطابق getCategoryFeed('homepage-sections')
            // في frontend/src/lib/feed.ts — غير مشروط لأن أيّ تصنيف قد يكون أحد أقسام
            // الرئيسية. يُزال إن ثبت أن category:{slug} وحده كافٍ بعد التحقيق.
            'homepage-sections',
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
        // P0 (Cache Invalidation Audit): كانت feed:breaking تُستخدَم في الواجهة
        // (getBreakingFeed) بلا أي إبطال خلفي مطلقًا — لم تكن is_breaking مُعالَجة هنا إطلاقًا.
        if ($article->is_breaking || $article->wasChanged('is_breaking')) {
            $tags[] = 'feed:breaking';
        }

        // 2. Category transitions
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

        // 3. Author transitions
        // الوسم `writer:{id}` لا `author_articles:{id}`: الواجهة توسم به الجلبتين معاً —
        // ملف الكاتب (writer.ts: ['writers', writer:{id}]) وقائمة مقالاته (writer.ts:
        // ['articles', writer:{id}]) — فيُبطلهما وسم واحد. الاسم القديم لم يكن له وجود في
        // الواجهة إطلاقاً، فكان نشر مقال لا يُبطل صفحة كاتبه بأي وسم وتبقى قديمة حتى سقف
        // الـISR (36000 ثانية = 10 ساعات).
        $authorId = $article->author_id;
        if ($authorId) {
            $tags[] = "writer:{$authorId}";
        }
        if ($oldAuthorId !== null && $oldAuthorId !== $authorId) {
            $tags[] = "writer:{$oldAuthorId}";
        }

        // 4. Tag transitions
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
     * وسوم التغطية المباشرة لمقال — يُبطلها إنشاء/تعديل/حذف/نقل أي تحديث خط (P0 Cache
     * Invalidation Audit: كانت هذه العمليات تُفرِّغ Cache::tags(['live_updates']) الخلفي
     * فقط دون إخطار الواجهة، فتبقى صفحة "مباشر" على حالها حتى انقضاء revalidate=1800).
     *
     * @return array<int,string>
     */
    public static function liveUpdates(Article $article): array
    {
        return ['live_updates', "live:{$article->slug}"];
    }

    /**
     * وسوم البثّ — تُبنى مباشرة (وليس بالترجمة من BroadcastCacheTags الخلفي، الذي لا
     * يُضمِّن kind في وسم التفاصيل بينما الواجهة تحتاجه: lib/broadcast.ts يستهلك
     * broadcast:{kind}:{slug} — ترجمة ساذجة كانت ستُنتج سلسلة لا تطابق شيئًا).
     *
     * @return array<int,string>
     */
    public static function broadcast(Broadcast $broadcast, ?string $oldKind = null, ?string $oldSlug = null): array
    {
        $kind = $broadcast->kind->value;
        $slug = (string) $broadcast->slug;

        $tags = ["broadcast-feed:{$kind}", "broadcast:{$kind}:{$slug}"];

        if ($oldKind !== null && $oldKind !== $kind) {
            $tags[] = "broadcast-feed:{$oldKind}";
        }
        if ($oldSlug !== null && $oldSlug !== '' && $oldSlug !== $slug) {
            $tags[] = 'broadcast:'.($oldKind ?? $kind).":{$oldSlug}";
        }

        return $tags;
    }

    /**
     * وسوم كل خلاصات البثّ الثلاث — تُستخدَم عند تغيير تصنيف بثّ (لا وسم فرونت إند
     * خاصّ بتصنيف البثّ اليوم، خلافًا للفيديو؛ التصنيفات تُعرَض ضمن نفس خلاصات الأنواع).
     *
     * @return array<int,string>
     */
    public static function broadcastCategoryChange(): array
    {
        return array_map(fn (string $kind): string => "broadcast-feed:{$kind}", \App\Enums\BroadcastKind::values());
    }

    /**
     * وسم خلاصة الجريدة الرقمية — الواجهة (lib/epaper.ts) لا تملك وسم تفاصيل عدد
     * منفصل؛ صفحة القارئ نفسها تقرأ من نفس getEpapers() المُوسَّم بهذا فقط.
     *
     * @return array<int,string>
     */
    public static function epaper(Epaper $epaper, ?string $oldLocale = null): array
    {
        $tags = ["epaper-feed:{$epaper->locale}"];

        if ($oldLocale !== null && $oldLocale !== $epaper->locale) {
            $tags[] = "epaper-feed:{$oldLocale}";
        }

        return $tags;
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
