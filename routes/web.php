<?php

use App\Http\Controllers\Api\V1\Public\Auth\SocialAuthController;
use App\Http\Controllers\Public\BroadcastPageController;
use App\Http\Controllers\Public\EpaperDocumentController;
use App\Http\Controllers\Public\EpaperReaderController;
use App\Http\Controllers\Public\EpaperReaderStateController;
use App\Http\Controllers\Public\EpaperTrackController;
use App\Http\Controllers\Public\RobotsController;
use App\Http\Controllers\Public\RssController;
use App\Http\Controllers\Public\SitemapController;
use Illuminate\Support\Facades\Route;

// مسار قابل للتخزين (route:cache) — لا إغلاق
Route::view('/', 'welcome');

// ─── Social login OAuth callback — browser redirect target matching the provider's registered
// redirect URI (e.g. /auth/google/callback). Stateless Socialite; the controller issues a token and
// bounces to the frontend. Kept here (root path) so it matches what is configured in Google Console.
Route::middleware('throttle:public.read')
    ->get('/auth/{provider}/callback', [SocialAuthController::class, 'callback'])
    ->where('provider', 'google|facebook')
    ->name('social.callback');

// ─── Broadcast public surface (B10) — SSR HTML pages ──────────────────
// صفحات عامة بـ Blade للبثّ: /live · /tv · /radio + تفاصيل /{kind}/{slug}.
// kind محصور بـ where(live|tv|radio) فلا يصطدم بـ / أو robots.txt أو sitemap*.xml.
// throttle:public.read — نفس حارس الإساءة السخيّ المُستخدَم للزواحف/القراءة العامة.
Route::middleware('throttle:public.read')->group(function (): void {
    Route::get('/{kind}', [BroadcastPageController::class, 'index'])
        ->where('kind', 'live|tv|radio')
        ->name('broadcast.index');

    Route::get('/{kind}/{slug}', [BroadcastPageController::class, 'show'])
        ->where('kind', 'live|tv|radio')
        ->name('broadcast.show');
});

// ─── Epaper public reader (Phase 2) — SSR HTML pages ──────────────────
// أرشيف العدد + قارئ مسبوق باللغة: /{locale}/epaper · /{locale}/epaper/{id}-{slug} · …/p/{n}.
// locale محصور بـ ar|en (لا يصطدم بـ /{kind} للبثّ). newspaper.enabled: الوحدة المعطَّلة = 404
// (دلالة "معطَّل = غير موجود"، عموماً كما إدارياً). throttle:public.read — حارس القراءة العامّ.
Route::middleware(['throttle:public.read', 'newspaper.enabled'])->group(function (): void {
    // صفحات القارئ (Blade/SSR) فقط — 'epaper.reader-root' يفرض جذر الروابط المطلقة التي تُبنى
    // أثناء عرض هذه الصفحات (@vite، وroute() المُستدعاة داخل EpaperReaderController::show() لبناء
    // data-doc-endpoint وبقيّة نقاط الجلب) على مضيف الطلب الوارد الموثوق بدل APP_URL الثابت. انظر
    // App\Http\Middleware\ForceReaderPublicRootUrl للتفصيل الكامل. لا يشمل نقاط التسليم/الحالة
    // أدناه عمداً — تلك تُستدعى كطلبات JS منفصلة لاحقًا، لا تُنتج هي نفسها روابط @vite/route()
    // إضافية يلزم تصحيح جذرها.
    Route::middleware('epaper.reader-root')->group(function (): void {
        Route::get('/{locale}/epaper', [EpaperReaderController::class, 'index'])
            ->where('locale', 'ar|en')
            ->name('epaper.index');

        Route::get('/{locale}/epaper/{issue}', [EpaperReaderController::class, 'show'])
            ->where('locale', 'ar|en')
            ->where('issue', '[0-9]+-[^/]+')
            ->name('epaper.show');

        Route::get('/{locale}/epaper/{issue}/p/{page}', [EpaperReaderController::class, 'show'])
            ->where('locale', 'ar|en')
            ->where('issue', '[0-9]+-[^/]+')
            ->where('page', '[0-9]+')
            ->name('epaper.page');
    });

    // تسليم الوثيقة — يصكّ رابطاً موقَّتاً بعد فحص canView (لا روابط PDF خام في الصفحة).
    Route::get('/{locale}/epaper/{issue}/document', [EpaperDocumentController::class, 'document'])
        ->where('locale', 'ar|en')
        ->where('issue', '[0-9]+-[^/]+')
        ->name('epaper.document');

    // تنزيل — استحقاق مفروض خادمياً (canDownload).
    Route::get('/{locale}/epaper/{issue}/download', [EpaperDocumentController::class, 'download'])
        ->where('locale', 'ar|en')
        ->where('issue', '[0-9]+-[^/]+')
        ->name('epaper.download');

    // ─── احتفاظ القارئ + التحليلات (Phase 5) ──────────────────────────────
    // حالة القارئ (مُصادَق فقط؛ الزوّار يستخدمون localStorage): متابعة + إشارات.
    Route::get('/{locale}/epaper/{issue}/state', [EpaperReaderStateController::class, 'show'])
        ->where('locale', 'ar|en')->where('issue', '[0-9]+-[^/]+')->name('epaper.state');
    Route::put('/{locale}/epaper/{issue}/progress', [EpaperReaderStateController::class, 'saveProgress'])
        ->where('locale', 'ar|en')->where('issue', '[0-9]+-[^/]+')->name('epaper.progress');
    Route::post('/{locale}/epaper/{issue}/bookmarks', [EpaperReaderStateController::class, 'addBookmark'])
        ->where('locale', 'ar|en')->where('issue', '[0-9]+-[^/]+')->name('epaper.bookmarks.store');
    Route::delete('/{locale}/epaper/{issue}/bookmarks/{page}', [EpaperReaderStateController::class, 'removeBookmark'])
        ->where('locale', 'ar|en')->where('issue', '[0-9]+-[^/]+')->where('page', '[0-9]+')->name('epaper.bookmarks.destroy');
    // تحليلات القراءة: بيكون مجهول واحد عند نهاية الجلسة (queue-safe).
    Route::post('/{locale}/epaper/{issue}/track', [EpaperTrackController::class, 'store'])
        ->where('locale', 'ar|en')->where('issue', '[0-9]+-[^/]+')->name('epaper.track');
});

// بثّ احتياطيّ موقَّع (Range) — يُستخدَم فقط حين يتعذّر التخزين البعيد؛ التوقيع هو الحارس.
// 'media.root-url' يستبدل 'signed' المدمَج بالكامل لهذا المسار — يتحقّق من التوقيع بنفس جذر
// MediaUrl::origin() المستخدَم وقت التوقيع (EpaperDocumentDelivery::mint)، لا بمضيف الطلب الوارد
// فعليّاً كما يفعل 'signed' الافتراضيّ (كان يفشل دائمًا بـ"Invalid signature"، مؤكَّد حيّاً
// 2026-08-10) — انظر App\Http\Middleware\ForceMediaRootUrl للتفصيل الكامل.
Route::middleware(['media.root-url', 'newspaper.enabled'])
    ->get('/epaper/stream/{epaper}', [EpaperDocumentController::class, 'stream'])
    ->whereNumber('epaper')
    ->name('epaper.document.stream');

// ─── SEO Delivery (P7.3) ──────────────────────────────────────────────
// Sitemaps + robots are root-level (not /api/v1) so crawlers discover them
// at the canonical locations. Routes are named so the controller can use
// route() helpers to cross-reference index → leaves.
// throttle:public.read — حارس إساءة لكل عميل/دقيقة (سخيّ؛ الزواحف لا تتجاوزه عادةً).
Route::middleware('throttle:public.read')->group(function (): void {
    Route::get('/robots.txt', RobotsController::class)->name('robots');

    Route::get('/sitemap.xml', [SitemapController::class, 'index'])->name('sitemap.index');

    Route::get('/sitemap-articles-{locale}.xml', [SitemapController::class, 'articles'])
        ->where('locale', 'ar|en')
        ->name('sitemap.articles');

    Route::get('/sitemap-categories-{locale}.xml', [SitemapController::class, 'categories'])
        ->where('locale', 'ar|en')
        ->name('sitemap.categories');

    Route::get('/sitemap-news-{locale}.xml', [SitemapController::class, 'news'])
        ->where('locale', 'ar|en')
        ->name('sitemap.news');

    Route::get('/sitemap-reels-{locale}.xml', [SitemapController::class, 'reels'])
        ->where('locale', 'ar|en')
        ->name('sitemap.reels');

    Route::get('/sitemap-videos-{locale}.xml', [SitemapController::class, 'videos'])
        ->where('locale', 'ar|en')
        ->name('sitemap.videos');

    Route::get('/sitemap-video-categories-{locale}.xml', [SitemapController::class, 'videoCategories'])
        ->where('locale', 'ar|en')
        ->name('sitemap.video-categories');

    Route::get('/sitemap-playlists-{locale}.xml', [SitemapController::class, 'playlists'])
        ->where('locale', 'ar|en')
        ->name('sitemap.playlists');

    // فريق العمل — نطاق عربيّ أحادي (بلا locale).
    Route::get('/sitemap-team.xml', [SitemapController::class, 'team'])
        ->name('sitemap.team');

    // ─── RSS 2.0 feeds (separate from sitemaps) — one per content type ──
    Route::get('/rss/news.xml', [RssController::class, 'news'])->name('rss.news');
    Route::get('/rss/videos.xml', [RssController::class, 'videos'])->name('rss.videos');
    Route::get('/rss/reels.xml', [RssController::class, 'reels'])->name('rss.reels');
});
