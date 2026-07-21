<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Public\Account\UpdatePhoneController;
use App\Http\Controllers\Api\V1\Public\AccountActivityController;
use App\Http\Controllers\Api\V1\Public\AccountStatsController;
use App\Http\Controllers\Api\V1\Public\Ad\AdRequestController;
use App\Http\Controllers\Api\V1\Public\Advertising\AdServeController;
use App\Http\Controllers\Api\V1\Public\Broadcast\BroadcastController;
use App\Http\Controllers\Api\V1\Public\Broadcast\BroadcastNotificationController;
use App\Http\Controllers\Api\V1\Public\Broadcast\BroadcastReactionController;
use App\Http\Controllers\Api\V1\Public\Broadcast\PresenceController;
use App\Http\Controllers\Api\V1\Public\Contact\ContactMessageController;
use App\Http\Controllers\Api\V1\Public\Content\ArticleController;
use App\Http\Controllers\Api\V1\Public\Content\CategoryController;
use App\Http\Controllers\Api\V1\Public\Content\CommentController;
use App\Http\Controllers\Api\V1\Public\Content\EngagementController;
use App\Http\Controllers\Api\V1\Public\Content\EpaperController;
use App\Http\Controllers\Api\V1\Public\Content\FeedController;
use App\Http\Controllers\Api\V1\Public\Content\LiveUpdateController;
use App\Http\Controllers\Api\V1\Public\Content\PageController;
use App\Http\Controllers\Api\V1\Public\Content\ReelController;
use App\Http\Controllers\Api\V1\Public\Content\WriterArticleController;
use App\Http\Controllers\Api\V1\Public\Content\WriterProfileController;
use App\Http\Controllers\Api\V1\Public\Content\WriterReelController;
use App\Http\Controllers\Api\V1\Public\Content\WriterVideoController;
use App\Http\Controllers\Api\V1\Public\Follow\FollowController;
use App\Http\Controllers\Api\V1\Public\MatchBarController;
use App\Http\Controllers\Api\V1\Public\SportsHomeBarController;
use App\Http\Controllers\Api\V1\Public\Media\WriterMediaController;
use App\Http\Controllers\Api\V1\Public\NotificationController;
use App\Http\Controllers\Api\V1\Public\Polls\PollController;
use App\Http\Controllers\Api\V1\Public\SiteController;
use App\Http\Controllers\Api\V1\Public\SportMenuController;
use App\Http\Controllers\Api\V1\Public\Team\TeamMemberController;
use App\Http\Controllers\Api\V1\Public\VideoLibrary\PlaylistController;
use App\Http\Controllers\Api\V1\Public\VideoLibrary\VideoController;
use App\Http\Controllers\Api\V1\Public\Whatsapp\WhatsappSubscriptionController;
use App\Http\Controllers\Api\V1\Public\WriterRequestController;
use App\Modules\Notifications\Http\Controllers\DeviceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public API Routes — /api/v1/*
|--------------------------------------------------------------------------
|
| Guest:         بدون أي middleware — مفتوح للجميع (مع ترويسات كاش/CDN).
| Authenticated: auth:sanctum + abilities:user + active
|
*/

// ─── إعدادات الموقع العامة — بدون بادئة locale (مستقلّة عن اللغة) ──────────
Route::middleware(['public.cache', 'throttle:public.read'])
    ->get('/site', [SiteController::class, 'settings']);

// ─── قائمة "أقسام الرياضة" العامّة (Header 1 Sections dropdown) — قراءة فقط، مفعَّلة+بلغة الطلب
// فقط عبر ?locale=، نفس نمط /site تمامًا (لا بادئة {locale} في المسار). راجع
// ListPublicSportMenuAction لسبب فصلها عن نظيرتها الإداريّة.
Route::middleware(['public.cache', 'throttle:public.read'])
    ->get('/sport-menu', [SportMenuController::class, 'index']);

// ─── Guest — قراءة عامة بادئة {locale} للتوجيه ومفاتيح الكاش الموحّدة ──
// throttle:public.read — حارس إساءة/DoS لكل عميل/دقيقة على كامل سطح القراءة العام.
Route::middleware(['public.cache', 'throttle:public.read'])
    ->where(['locale' => 'ar|en'])
    ->prefix('{locale}')
    ->group(function (): void {
        // التصنيفات: شجرة كاملة + تفاصيل تصنيف بالـ slug
        Route::get('/categories', [CategoryController::class, 'index']);
        Route::get('/categories/{slug}', [CategoryController::class, 'show']);

        // دليل الكتّاب (Writers Directory) + بروفيل كاتب عامّ بالـ id. {id} رقميّ فلا يتقاطع.
        Route::get('/writers', [WriterProfileController::class, 'index']);
        Route::get('/writers/{id}', [WriterProfileController::class, 'show'])->whereNumber('id');

        // المقالات: قائمة (filter/sort/pagination) + المسار السريع للعاجل + تفاصيل بالـ slug.
        // المسار الثابت breaking قبل {slug} لتفادي التقاطه كـ slug.
        Route::get('/articles', [ArticleController::class, 'index']);
        Route::get('/articles/breaking', [ArticleController::class, 'breaking']);
        Route::get('/articles/most-read', [ArticleController::class, 'mostRead']);
        Route::get('/articles/trending', [ArticleController::class, 'trending']);
        Route::get('/articles/{slug}', [ArticleController::class, 'show']);

        // الريلز: قائمة + مميّزة + رائجة (تفاعل حقيقي) + تفاصيل بالـ slug.
        // المسارات الثابتة (featured/trending) قبل {slug} لتفادي التقاطها كـ slug.
        Route::get('/reels', [ReelController::class, 'index']);
        Route::get('/reels/featured', [ReelController::class, 'featured']);
        Route::get('/reels/trending', [ReelController::class, 'trending']);
        Route::get('/reels/{slug}', [ReelController::class, 'show']);

        // مكتبة الفيديو: قائمة + مميّز + رائج + خلاصة تصنيف + تفاصيل + ذات صلة.
        // الثابتة (featured/trending) قبل {slug}؛ ومسار related أعمق فلا يتقاطع.
        Route::get('/videos', [VideoController::class, 'index']);
        Route::get('/videos/featured', [VideoController::class, 'featured']);
        Route::get('/videos/trending', [VideoController::class, 'trending']);
        Route::get('/videos/{slug}', [VideoController::class, 'show']);
        Route::get('/videos/{slug}/related', [VideoController::class, 'related']);
        Route::get('/video-categories/{slug}', [VideoController::class, 'byCategory']);

        // قوائم التشغيل: قائمة + تفاصيل بالـ slug (أعضاء عامون مرتّبون).
        Route::get('/playlists', [PlaylistController::class, 'index']);
        Route::get('/playlists/{slug}', [PlaylistController::class, 'show']);

        // الصفحات الثابتة: قائمة (تنقّل/خريطة، مرشّح placement) + تفاصيل بالـ slug.
        Route::get('/pages', [PageController::class, 'index']);
        Route::get('/pages/{slug}', [PageController::class, 'show']);

        // التغذيات (P7.2): مناطق العرض المدفوعة بأعلام الخبر + latest، وتجميع الرئيسية
        Route::get('/feed/{kind}', [FeedController::class, 'show'])
            ->where('kind', 'hero|breaking|header|editors_pick|latest');
        Route::get('/homepage', [FeedController::class, 'homepage']);

        // الجريدة الرقمية (أعداد PDF) — مقيّدة ببوّابة المنتج newspaper.enabled.
        Route::get('/epaper', [EpaperController::class, 'index'])->middleware('newspaper.enabled');
    });

// ─── التغطية الحيّة (P8.3) — خارج public.cache عمداً ────────────────────
// الـ Action يضبط ترويسات كاش أقصر خاصّة بالمسار الحيّ (نافذة تحقّق ETag/304)
// وكاش tag=live_updates منفصل عن بيانات المقال الوصفية (فصل الاهتمامات).
Route::middleware('throttle:public.read')
    ->where(['locale' => 'ar|en'])
    ->prefix('{locale}')
    ->group(function (): void {
        Route::get('/articles/{slug}/live-updates', [LiveUpdateController::class, 'index']);

        // التعليقات العامة (قراءة) — المعتمَدة فقط، مبوَّبة، بوّابة العرض (عالميّ ∧ مقال)
        Route::get('/articles/{slug}/comments', [CommentController::class, 'index']);

        // مُحلِّل إعادة التوجيه 301 للمسارات القانونية القديمة (SEO/هجرة) — خارج
        // public.cache: استجابة 301 خاصّة لا تُخزَّن كمحتوى.
        Route::get('/redirects/articles', [ArticleController::class, 'redirect']);
        Route::get('/redirects/pages', [PageController::class, 'redirect']);
        Route::get('/redirects/reels', [ReelController::class, 'redirect']);
        Route::get('/redirects/videos', [VideoController::class, 'redirect']);
        Route::get('/redirects/playlists', [PlaylistController::class, 'redirect']);
    });

// ─── التعليقات العامة (إنشاء/رد) — حدّ معدّل comments.submit؛ parent_id ⇒ رد؛ يُنشأ pending ──
Route::middleware('throttle:comments.submit')
    ->where(['locale' => 'ar|en'])
    ->prefix('{locale}')
    ->group(function (): void {
        Route::post('/articles/{slug}/comments', [CommentController::class, 'store']);
    });

// ─── اتصل بنا (عام) — locale-less. حماية: reCAPTCHA الحاليّ (recaptcha:contact) + ──
// throttle ثنائيّ الطبقة (public.contact: حدّ client + سقف IP اختياريّ). صفر نظام جديد.
Route::middleware(['throttle:public.contact', 'recaptcha:contact'])
    ->post('/contact', [ContactMessageController::class, 'store']);

// ─── طلب إعلان (عام) — locale-less. حماية: recaptcha:ad_request + throttle ثنائيّ الطبقة. ──
Route::middleware(['throttle:public.ad-request', 'recaptcha:ad_request'])
    ->post('/ad-requests', [AdRequestController::class, 'store']);

// ─── اشتراك واتساب (عام) — locale-less. الاسم + phone فقط ⇒ مجموعة «مشتركو الموقع». ──
// حماية: throttle ثنائيّ الطبقة (public.whatsapp-subscribe). الإلغاء بتوكن سرّيّ (idempotent).
Route::middleware('throttle:public.whatsapp-subscribe')
    ->post('/whatsapp/subscribe', [WhatsappSubscriptionController::class, 'subscribe']);
Route::middleware('throttle:public.whatsapp-subscribe')
    ->post('/whatsapp/unsubscribe', [WhatsappSubscriptionController::class, 'unsubscribe']);

// ─── أجهزة الموبايل (push) — locale-less. ضيف + bearer اختياريّ (يربط user_id عبر sanctum). ──
// تسجيل/تدوير توكن/إلغاء + مزامنة topics (السيرفر يملك الحالة المرغوبة، قرار B). throttle:public.read
// مفتاحه X-Client-Id ⇒ يتفادى تصادم NAT. الإرسال نفسه يبقى خلف NotificationManager.
Route::middleware('throttle:public.read')->group(function (): void {
    Route::post('/devices', [DeviceController::class, 'register']);
    Route::patch('/devices/token', [DeviceController::class, 'updateToken']);
    Route::get('/devices/topics', [DeviceController::class, 'topics']);
    Route::delete('/devices/{deviceId}', [DeviceController::class, 'unregister'])
        ->where('deviceId', '[A-Za-z0-9\-]+');
});

// ─── فريق العمل (عام) — نطاق مستقل عربي فقط: لا بادئة {locale} ────────────
// محتوى تعريفيّ (صفحات أشخاص). داخل public.cache (CDN/ETag) + throttle:public.read.
// «team» قطعة مسار ثابتة فلا تتقاطع مع مجموعة {locale} (ar|en).
Route::middleware(['public.cache', 'throttle:public.read'])
    ->prefix('team')
    ->group(function (): void {
        Route::get('/', [TeamMemberController::class, 'index']);
        Route::get('/{slug}', [TeamMemberController::class, 'show']);
    });

// مُحلِّل إعادة التوجيه 301 لأعضاء الفريق (مسار قانوني قديم كامل ?path=) — بلا بادئة
// locale وخارج public.cache: استجابة 301 خاصّة لا تُخزَّن كمحتوى.
Route::middleware('throttle:public.read')
    ->get('/redirects/team', [TeamMemberController::class, 'redirect']);

// ─── شريط المباريات (عام) — نطاق مستقل عربي فقط: لا بادئة {locale}، مثل team/broadcasts.
// منظر مُصفّى فوق بيانات مُزامَنة أصلًا (Competition::is_tracked) — راجع BuildCompetitionBarAction.
Route::middleware(['public.cache', 'throttle:public.read'])
    ->get('/match-bar', [MatchBarController::class, 'show']);

// ─── شريط الصفحة الرئيسية للرياضة (عام) — ميزة مستقلّة تمامًا عن شريط المباريات أعلاه، تشترك
// معه فقط بجدول Competition كمصدر بطولات واحد ونفس BuildCompetitionBarAction بأعمدة مختلفة.
Route::middleware(['public.cache', 'throttle:public.read'])
    ->get('/sports-home-bar', [SportsHomeBarController::class, 'show']);

// ─── البثّ العام (B4) — نطاق مستقل عربي فقط: لا بادئة {locale} ────────────
// النوع قطعةُ مسارٍ محصورة بـ where (live|tv|radio) فلا تُلتقط كـ slug ولا تتقاطع
// مع مجموعة {locale} (ar|en). داخل public.cache (CDN/ETag) + throttle:public.read.
Route::middleware(['public.cache', 'throttle:public.read'])
    ->where(['kind' => 'live|tv|radio'])
    ->group(function (): void {
        Route::get('/{kind}', [BroadcastController::class, 'index']);
        Route::get('/{kind}/{slug}', [BroadcastController::class, 'show']);
    });

// ─── حضور البثّ (B5) — نموذج HTTP heartbeat (لا WebSockets عامة). لا بادئة لغة ──
// {broadcast} مُعرّف رقمي (لا ربط نموذج — لا ضرب قاعدة بيانات على المسار الساخن).
// GET العدّ/الحالة CDN-safe (الـ Action يضبط كاشاً عامّاً قصيراً)؛ join/heartbeat
// محدودة المعدّل ولا تُخزَّن (no-store) — حارس تضخيم/إساءة.
Route::prefix('broadcasts/{broadcast}/presence')
    ->where(['broadcast' => '[0-9]+'])
    ->group(function (): void {
        Route::get('/', [PresenceController::class, 'show'])->middleware('throttle:public.read');
        Route::post('/join', [PresenceController::class, 'join'])->middleware('throttle:presence.join');
        Route::post('/heartbeat', [PresenceController::class, 'heartbeat'])->middleware('throttle:presence.heartbeat');
    });

// ─── التفاعل الموحّد (Phase 2) — عام للزوّار والمستخدمين (فاعل هجين) ──────
// لا بادئة locale (مستقلّ عن اللغة). كتابة محدودة المعدّل (مقاومة الإساءة)؛
// قراءة الحالة دون حدّ. منع التكرار مضمون في الخدمة (قيد فرادة + dedup).
Route::prefix('engagement/{type}/{id}')
    ->where(['id' => '[0-9]+'])
    ->group(function (): void {
        Route::get('/', [EngagementController::class, 'state']);

        Route::middleware('throttle:engagement')->group(function (): void {
            Route::post('/react', [EngagementController::class, 'react']);
            Route::delete('/react', [EngagementController::class, 'removeReaction']);
            Route::post('/favorite', [EngagementController::class, 'toggleFavorite']);
        });

        // منارة المشاهدة (uncached): احتساب دقيق خلف الـ CDN — رمز موقّع + حدّ أعلى.
        Route::post('/view', [EngagementController::class, 'view'])
            ->middleware('throttle:engagement.view');
    });

// ─── الإعلانات (الخدمة العامة — Batch 5) — مستقلّ عن اللغة (locale معامل استعلام) ──
// serve: اختيار في الخادم مُكاش على الحافة بنافذة الدلو (public.cache يحترم ترويسة
// الـ Action). التتبّع منفصل: الانطباع يُؤكَّد بمنارة العميل (served != rendered)؛ نقرة
// إبداع الصورة تحويل موقّع لوجهة مُخزَّنة (no-store، لا open redirect)؛ نقرة إبداع HTML
// (روابطه الخاصّة) تُحتسب بمنارة POST /track/click (V2). كلّها محدودة المعدّل.
Route::prefix('ads')->group(function (): void {
    // دفعة الصفحة: كلّ مساحاتها في استجابة واحدة (?page= → chrome + مساحات الصفحة). نفس المحرّك/الرموز/
    // كاش الحافة كنقطة العرض المفردة؛ الواجهة تمرّر page فقط (فصل تامّ عن أسماء المساحات).
    Route::get('/', [AdServeController::class, 'batch'])
        ->middleware(['public.cache', 'throttle:ads.serve']);

    Route::get('/serve/{zoneKey}', [AdServeController::class, 'serve'])
        ->where('zoneKey', '[a-z0-9_]+')
        ->middleware(['public.cache', 'throttle:ads.serve']);

    Route::post('/track/impression', [AdServeController::class, 'impression'])
        ->middleware('throttle:ads.track');

    // منارة نقرة HTML (V2) — تحتسب فقط (لا تحويل)؛ إبداعات الصورة تستخدم تحويل /click/{token}.
    Route::post('/track/click', [AdServeController::class, 'trackClick'])
        ->middleware('throttle:ads.click');

    Route::get('/click/{token}', [AdServeController::class, 'click'])
        ->where('token', '[A-Za-z0-9._\-]+')
        ->middleware('throttle:ads.click');
});

// ─── الاستطلاعات (التصويت العام — Phase 2) — معنونة بالـ uuid (غير قابلة للتعداد) ──
// التهيئة per-actor (has_voted/الرؤية) ⇒ no-store؛ النتائج العامّة قابلة للكاش؛ التصويت
// كتابة محدودة المعدّل (poll.vote) لا تُخزَّن. الفرض (الفتح/الجمهور/الرؤية) في الـ Actions.
Route::prefix('polls')->where(['uuid' => '[0-9a-fA-F-]{36}'])->group(function (): void {
    Route::get('/{uuid}', [PollController::class, 'show'])
        ->middleware('throttle:public.read');

    Route::post('/{uuid}/vote', [PollController::class, 'vote'])
        ->middleware('throttle:poll.vote');

    Route::get('/{uuid}/results', [PollController::class, 'results'])
        ->middleware('throttle:public.read');
});

// ─── Authenticated Public — يتطلب token بـ ability=user ───────────────
Route::middleware(['auth:sanctum', 'abilities:user', 'active'])->group(function (): void {
    // إحصاءات لوحة المستخدم (قراءة-فقط، مُكاش per-user عبر CacheKeys::accountStats + CacheTtl). متاحة لأي مستخدم مصادَق.
    Route::get('/account/stats', [AccountStatsController::class, 'index']);

    // حفظ رقم الهاتف + اختيار الاشتراك في حملات واتساب (نافذة ما بعد الدخول). يطبّع E.164 ويزامن
    // الخيار مع نظام whatsapp_contacts القائم (مصدر الحقيقة للإرسال). throttle: حدّ إساءة عامّ.
    Route::patch('/account/phone', UpdatePhoneController::class)
        ->middleware('throttle:public.read');

    // User Activity API (قراءة-فقط) — نشاط المستخدم الموحّد فوق engagements (SSoT): أعجبني/المحفوظات الآن،
    // قابل للتوسعة (history/continue) بمعامل activity دون نقطة جديدة. متاح لأي مستخدم مصادَق (ليس للكاتب فقط).
    Route::get('/account/activity', [AccountActivityController::class, 'index'])
        ->middleware('throttle:public.read');

    // ─── نظام «تابع» — متابعة كيانات 365 (فريق/بطولة/لاعب/مباراة). الحالة per-user (no-store)؛
    // التبديل كتابة محدودة المعدّل (يعيد استخدام throttle:engagement)؛ /follows لصفحة «أتابعهم».
    Route::get('/follows', [FollowController::class, 'index'])->middleware('throttle:public.read');
    Route::prefix('follow/{type}/{id}')->where(['id' => '[0-9]+'])->group(function (): void {
        Route::get('/', [FollowController::class, 'state'])->middleware('throttle:public.read');
        Route::post('/', [FollowController::class, 'toggle'])->middleware('throttle:engagement');
    });

    // طلب ترقية الحساب إلى كاتب — يدخل قائمة الانتظار (pending). throttle: حدّ إساءة 5/دقيقة/مستخدم (P1.4 Hardening).
    Route::post('/writer-requests', [WriterRequestController::class, 'store'])
        ->middleware('throttle:writer-requests.submit');

    // ─── وسائط الكاتب (Writer Media Ownership Layer) — رفع + استطلاع حالة المعالجة.
    // نفس StoreMediaAssetAction + StoreMediaAssetRequest + TranscodeVideoAssetJob الإداريّة
    // (لا خطّ موازٍ). الرفع يضبط uploaded_by للكاتب؛ والاطّلاع محصور بأصول الكاتب (IDOR).
    Route::post('/media', [WriterMediaController::class, 'store'])
        ->middleware(['writer', 'throttle:public.read']);
    Route::get('/media/{mediaAsset}', [WriterMediaController::class, 'show'])
        ->middleware('writer');

    // مقالات الكاتب نفسه (كل الحالات) — قراءة محصورة بـ author_id الفاعل.
    // مسار ثابت قبل أي {article} لتفادي التقاطه كمعامل.
    // تصنيفات نموذج الكاتب مفلترةً حسب النوع (news|opinion) — نفس قاعدة نطاق الحارس.
    Route::get('/article-categories', [WriterArticleController::class, 'categories'])
        ->middleware('writer');

    Route::get('/articles/mine', [WriterArticleController::class, 'mine'])
        ->middleware('writer');

    // إرسال مقال من الكاتب (أخبار/رأي) — يُنشأ مسودّةً مملوكةً ذاتياً.
    // بوّابة writer = طبقة حماية إضافية؛ التفويض الفعلي في ArticleAuthorizationGuard.
    Route::post('/articles', [WriterArticleController::class, 'store'])
        ->middleware('writer');

    // إرسال المقال للمراجعة (draft→submitted) — الحصر والملكية في ArticleWorkflowGuard.
    Route::patch('/articles/{article}/status', [WriterArticleController::class, 'submit'])
        ->middleware('writer');

    // ريلز الكاتب نفسه (كل الحالات) — قراءة محصورة بـ author_id الفاعل.
    // مسار ثابت قبل أي {reel} لتفادي التقاطه كمعامل.
    Route::get('/reels/mine', [WriterReelController::class, 'mine'])
        ->middleware('writer');

    // إرسال ريل من الكاتب — يُنشأ مسودّةً مملوكةً ذاتياً (بلا media — V1).
    Route::post('/reels', [WriterReelController::class, 'store'])
        ->middleware('writer');

    // إرسال الريل للمراجعة (draft→submitted) — الحصر والملكية في ReelWorkflowGuard.
    Route::patch('/reels/{reel}/status', [WriterReelController::class, 'submit'])
        ->middleware('writer');

    // فيديوهات الكاتب نفسه (كل الحالات) — قراءة محصورة بـ author_id الفاعل.
    // مسار ثابت قبل أي {video} لتفادي التقاطه كمعامل.
    Route::get('/videos/mine', [WriterVideoController::class, 'mine'])
        ->middleware('writer');

    // إرسال فيديو من الكاتب — يُنشأ مسودّةً مملوكةً ذاتياً (بلا media/source — V1).
    Route::post('/videos', [WriterVideoController::class, 'store'])
        ->middleware('writer');

    // إرسال الفيديو للمراجعة (draft→submitted) — الحصر والملكية في VideoWorkflowGuard.
    Route::patch('/videos/{video}/status', [WriterVideoController::class, 'submit'])
        ->middleware('writer');

    // ─── إشعارات المستخدم (database notifications) — **لكلّ مستخدم مُصادَق** (لا «writer» فقط): إشعارات «تابع»
    // (المرحلة 2) تصل أيّ مستخدم، وإشعارات الكاتب تبقى لِمن يملكها. **محصورة بالمالك** عبر علاقة Notifiable في
    // الـ Action ⇒ لا تسريب. literal «notifications» لا يتقاطع مع broadcasts/notifications. الحرفية قبل {uuid}.
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead'])
        ->whereUuid('notification');

    // ─── تفاعل البثّ (B7) — like/dislike للمُصادَقين فقط (لا زوّار). الكتابة محدودة
    // المعدّل (throttle:engagement)؛ القراءة (حالتي الحالية) بلا حدّ إضافي.
    Route::get('/broadcasts/{broadcast}/reaction', [BroadcastReactionController::class, 'show'])
        ->whereNumber('broadcast');

    Route::middleware('throttle:engagement')->group(function (): void {
        Route::post('/broadcasts/{broadcast}/reaction', [BroadcastReactionController::class, 'store'])
            ->whereNumber('broadcast');
        Route::delete('/broadcasts/{broadcast}/reaction', [BroadcastReactionController::class, 'destroy'])
            ->whereNumber('broadcast');
    });

    // ─── إشعارات البثّ (B8) — تفضيلات المُصادَق (عام + تذكير حدثٍ بعينه). literal
    // «notifications» لا يتقاطع مع {broadcast} الرقميّ (whereNumber).
    Route::get('/broadcasts/notifications/live', [BroadcastNotificationController::class, 'liveStatus']);
    Route::post('/broadcasts/notifications/live', [BroadcastNotificationController::class, 'subscribeLive']);
    Route::delete('/broadcasts/notifications/live', [BroadcastNotificationController::class, 'unsubscribeLive']);

    Route::get('/broadcasts/{broadcast}/reminder', [BroadcastNotificationController::class, 'reminderStatus'])
        ->whereNumber('broadcast');
    Route::post('/broadcasts/{broadcast}/reminder', [BroadcastNotificationController::class, 'subscribeReminder'])
        ->whereNumber('broadcast');
    Route::delete('/broadcasts/{broadcast}/reminder', [BroadcastNotificationController::class, 'unsubscribeReminder'])
        ->whereNumber('broadcast');
});
