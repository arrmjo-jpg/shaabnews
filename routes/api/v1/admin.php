<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Admin\Activity\ActivityController;
use App\Http\Controllers\Api\V1\Admin\Ad\AdRequestController;
use App\Http\Controllers\Api\V1\Admin\Advertising\AdAnalyticsController;
use App\Http\Controllers\Api\V1\Admin\Advertising\AdCampaignController;
use App\Http\Controllers\Api\V1\Admin\Advertising\AdCreativeController;
use App\Http\Controllers\Api\V1\Admin\Advertising\AdPlacementController;
use App\Http\Controllers\Api\V1\Admin\Advertising\AdZoneController;
use App\Http\Controllers\Api\V1\Admin\Ai\AiCopilotController;
use App\Http\Controllers\Api\V1\Admin\Ai\AiUsageController;
use App\Http\Controllers\Api\V1\Admin\Analytics\SiteAnalyticsController;
use App\Http\Controllers\Api\V1\Admin\Auth\AdminAuthController;
use App\Http\Controllers\Api\V1\Admin\Broadcast\BroadcastCategoryController;
use App\Http\Controllers\Api\V1\Admin\Broadcast\BroadcastController;
use App\Http\Controllers\Api\V1\Admin\Broadcast\BroadcastLifecycleController;
use App\Http\Controllers\Api\V1\Admin\Broadcast\BroadcastModerationController;
use App\Http\Controllers\Api\V1\Admin\Chat\ChatController;
use App\Http\Controllers\Api\V1\Admin\Contact\ContactMessageController;
use App\Http\Controllers\Api\V1\Admin\Content\ArticleController;
use App\Http\Controllers\Api\V1\Admin\Content\AuthorMediaController;
use App\Http\Controllers\Api\V1\Admin\Content\CategoryController;
use App\Http\Controllers\Api\V1\Admin\Content\CommentController;
use App\Http\Controllers\Api\V1\Admin\Content\EntityController;
use App\Http\Controllers\Api\V1\Admin\Content\LiveUpdateController;
use App\Http\Controllers\Api\V1\Admin\Content\PageController;
use App\Http\Controllers\Api\V1\Admin\Content\ReelController;
use App\Http\Controllers\Api\V1\Admin\Content\TagController;
use App\Http\Controllers\Api\V1\Admin\Epaper\EpaperController;
use App\Http\Controllers\Api\V1\Admin\Epaper\NewspaperSettingsController;
use App\Http\Controllers\Api\V1\Admin\Inbox\InboxController;
use App\Http\Controllers\Api\V1\Admin\Media\MediaAssetController;
use App\Http\Controllers\Api\V1\Admin\Permissions\PermissionController;
use App\Http\Controllers\Api\V1\Admin\Permissions\PermissionGroupController;
use App\Http\Controllers\Api\V1\Admin\Polls\PollController;
use App\Http\Controllers\Api\V1\Admin\Profile\ProfileController;
use App\Http\Controllers\Api\V1\Admin\Roles\RoleController;
use App\Http\Controllers\Api\V1\Admin\Scheduler\SchedulerController;
use App\Http\Controllers\Api\V1\Admin\Settings\MediaController;
use App\Http\Controllers\Api\V1\Admin\Settings\SettingsController;
use App\Http\Controllers\Api\V1\Admin\Sport\CompetitionController;
use App\Http\Controllers\Api\V1\Admin\Sport\MatchBarSettingsController;
use App\Http\Controllers\Api\V1\Admin\System\FailedJobController;
use App\Http\Controllers\Api\V1\Admin\System\OpsController;
use App\Http\Controllers\Api\V1\Admin\System\SystemController;
use App\Http\Controllers\Api\V1\Admin\Team\TeamMemberController;
use App\Http\Controllers\Api\V1\Admin\Users\UserController;
use App\Http\Controllers\Api\V1\Admin\Vertix\VertixMigrationController;
use App\Http\Controllers\Api\V1\Admin\VideoLibrary\VideoCategoryController;
use App\Http\Controllers\Api\V1\Admin\VideoLibrary\VideoController;
use App\Http\Controllers\Api\V1\Admin\VideoLibrary\VideoPlaylistController;
use App\Http\Controllers\Api\V1\Admin\Whatsapp\WhatsappCampaignController;
use App\Http\Controllers\Api\V1\Admin\Whatsapp\WhatsappContactController;
use App\Http\Controllers\Api\V1\Admin\Whatsapp\WhatsappGroupController;
use App\Http\Controllers\Api\V1\Admin\WpMigration\WpMigrationController;
use App\Http\Controllers\Api\V1\Admin\WriterRequests\WriterRequestController;
use App\Modules\CDN\Http\Controllers\CdnController;
use App\Modules\Notifications\Http\Controllers\AudienceController as NotificationAudienceController;
use App\Modules\Notifications\Http\Controllers\CampaignController as NotificationCampaignController;
use App\Modules\Notifications\Http\Controllers\EventMatrixController;
use App\Modules\Notifications\Http\Controllers\HealthController as NotificationHealthController;
use App\Modules\Notifications\Http\Controllers\SettingsController as NotificationSettingsController;
use App\Modules\Notifications\Http\Controllers\TemplateController as NotificationTemplateController;
use Illuminate\Support\Facades\Route;
use Spatie\Health\Http\Controllers\HealthCheckJsonResultsController;

/*
|--------------------------------------------------------------------------
| Admin API Routes — /api/v1/admin/*
|--------------------------------------------------------------------------
| جميع المسارات هنا محمية بـ:
|   auth:sanctum + abilities:admin + active + role:...
| (مُطبَّقة من routes/api.php)
*/

// ─── Admin Auth Protected ──────────────────────────────────────────────
Route::prefix('auth')->group(function (): void {
    Route::post('/logout', [AdminAuthController::class, 'logout']);
    Route::get('/me', [AdminAuthController::class, 'me']);
});

// ─── Self Profile (self-only — no permission, $request->user()) ────────
Route::prefix('profile')->group(function (): void {
    Route::get('/', [ProfileController::class, 'show']);
    Route::put('/', [ProfileController::class, 'update']);
    Route::post('/password', [ProfileController::class, 'changePassword']);
    Route::get('/activity', [ProfileController::class, 'activity']);
    Route::get('/analytics', [ProfileController::class, 'analytics']);
    Route::get('/permissions', [ProfileController::class, 'permissions']);
    Route::get('/security', [ProfileController::class, 'security']);
    Route::get('/sessions', [ProfileController::class, 'sessions']);
    Route::delete('/sessions/{id}', [ProfileController::class, 'revokeSession'])
        ->whereNumber('id');
    Route::post('/sessions/revoke-others', [ProfileController::class, 'revokeOtherSessions']);
});

// ─── Users Management ──────────────────────────────────────────────────
// تفويض قائم على الصلاحيات عبر Spatie permission middleware
Route::prefix('users')->group(function (): void {
    Route::get('/', [UserController::class, 'index'])
        ->middleware('permission:users.view');

    Route::post('/', [UserController::class, 'store'])
        ->middleware('permission:users.create');

    // رفع صورة مستقل (إضافة/تعديل) — قبل مسارات {user}
    Route::post('/avatar', [UserController::class, 'uploadAvatar'])
        ->middleware('permission:users.create|users.edit');

    Route::get('/{user}', [UserController::class, 'show'])
        ->middleware('permission:users.view');

    Route::put('/{user}', [UserController::class, 'update'])
        ->middleware('permission:users.edit');

    Route::patch('/{user}/status', [UserController::class, 'updateStatus'])
        ->middleware('permission:users.edit');

    Route::post('/{user}/password-reset', [UserController::class, 'sendPasswordReset'])
        ->middleware('permission:users.edit');

    Route::delete('/{user}', [UserController::class, 'destroy'])
        ->middleware('permission:users.delete');

    Route::post('/{user}/restore', [UserController::class, 'restore'])
        ->withTrashed()
        ->middleware('permission:users.delete');
});

// ─── Content → Categories ──────────────────────────────────────────────
Route::prefix('categories')->group(function (): void {
    Route::get('/', [CategoryController::class, 'index'])
        ->middleware('permission:categories.view');

    Route::post('/', [CategoryController::class, 'store'])
        ->middleware('permission:categories.create');

    // تعديل جماعي للحالة/الظهور — قبل مسارات {category} الرقمية.
    Route::patch('/bulk', [CategoryController::class, 'bulkUpdate'])
        ->middleware('permission:categories.edit');

    // المحذوفات (قائمة مسطّحة) — قبل مسارات {category} الرقمية.
    Route::get('/trashed', [CategoryController::class, 'trashed'])
        ->middleware('permission:categories.view');

    // إعادة ترتيب ضمن الإخوة (أعلى/أسفل).
    Route::patch('/{category}/move', [CategoryController::class, 'move'])
        ->middleware('permission:categories.edit')
        ->whereNumber('category');

    Route::get('/{category}', [CategoryController::class, 'show'])
        ->middleware('permission:categories.view')
        ->whereNumber('category');

    Route::put('/{category}', [CategoryController::class, 'update'])
        ->middleware('permission:categories.edit')
        ->whereNumber('category');

    Route::delete('/{category}', [CategoryController::class, 'destroy'])
        ->middleware('permission:categories.delete')
        ->whereNumber('category');

    // استرجاع تصنيف محذوف (يربط النموذج المحذوف عبر withTrashed).
    Route::post('/{category}/restore', [CategoryController::class, 'restore'])
        ->middleware('permission:categories.restore')
        ->withTrashed()
        ->whereNumber('category');

    // حذف نهائي — لا يمكن استرجاعه.
    Route::delete('/{category}/force', [CategoryController::class, 'forceDelete'])
        ->middleware('permission:categories.force_delete')
        ->withTrashed()
        ->whereNumber('category');
});

// ─── Content → Articles (نطاق أساسي C2 — لا انتقالات حالة/API عام) ──────
Route::prefix('articles')->group(function (): void {
    Route::get('/', [ArticleController::class, 'index'])
        ->middleware('permission:articles.view');

    Route::post('/', [ArticleController::class, 'store'])
        ->middleware('permission:articles.create');

    // محلّل تضمينات (allow-list) — قبل مسارات {article} الرقمية
    Route::post('/embeds/resolve', [ArticleController::class, 'resolveEmbed'])
        ->middleware('permission:articles.edit');

    // إلغاء كافة الأخبار العاجلة — مسار ثابت قبل مسارات {article}
    Route::post('/clear-breaking', [ArticleController::class, 'clearBreaking'])
        ->middleware('permission:articles.edit');

    // إلغاء تثبيت كل المقالات المثبَّتة — مسار ثابت قبل مسارات {article}
    Route::post('/clear-pinned', [ArticleController::class, 'clearPinned'])
        ->middleware('permission:articles.edit');

    // إحصائات الأخبار (بطاقات العرض) — مسار ثابت قبل مسارات {article}
    Route::get('/stats', [ArticleController::class, 'stats'])
        ->middleware('permission:articles.view');

    // تحليلات أسطول المقالات (عبر-المقالات) — مسار ثابت قبل مسارات {article}
    Route::get('/analytics', [ArticleController::class, 'analytics'])
        ->middleware('permission:articles.view');

    // فحص توفّر slug + اقتراح بديل — مسار ثابت قبل مسارات {article}
    Route::get('/slug-check', [ArticleController::class, 'slugCheck'])
        ->middleware('permission:articles.create|articles.edit');

    // معاينة حقيقية (حمولة عامة + إرشاد SEO) — لأي حالة
    Route::get('/{article}/preview', [ArticleController::class, 'preview'])
        ->middleware('permission:articles.view')
        ->whereNumber('article');

    // تحليلات مقال واحد (نطاق زمني: تفاعل/اتجاه/زيارات/أداء)
    Route::get('/{article}/analytics', [ArticleController::class, 'entityAnalytics'])
        ->middleware('permission:articles.view')
        ->whereNumber('article');

    // وسائط المقال (P3) — رفع/حذف + قائمة/إعادة ترتيب (P9.1)
    Route::get('/{article}/media', [ArticleController::class, 'mediaIndex'])
        ->middleware('permission:articles.edit')
        ->whereNumber('article');

    Route::post('/{article}/media', [ArticleController::class, 'uploadMedia'])
        ->middleware('permission:articles.edit')
        ->whereNumber('article');

    // إعادة الترتيب — قبل مسار {media} الرقمي
    Route::patch('/{article}/media/reorder', [ArticleController::class, 'reorderMedia'])
        ->middleware('permission:articles.edit')
        ->whereNumber('article');

    Route::delete('/{article}/media/{media}', [ArticleController::class, 'deleteMedia'])
        ->middleware('permission:articles.edit')
        ->whereNumber(['article', 'media']);

    Route::get('/{article}', [ArticleController::class, 'show'])
        ->middleware('permission:articles.view')
        ->whereNumber('article');

    Route::put('/{article}', [ArticleController::class, 'update'])
        ->middleware('permission:articles.edit')
        ->whereNumber('article');

    // سير عمل النشر — البوابة capability=edit؛ صلاحيات الانتقال
    // (نشر/جدولة/رفض/أرشفة = تحريري فقط) تُفرَض في ArticleWorkflowGuard
    Route::patch('/{article}/status', [ArticleController::class, 'status'])
        ->middleware('permission:articles.edit')
        ->whereNumber('article');

    // التغطية الحيّة (P8) — خط زمني تابع لمقال type=live.
    // البوابة capability=edit؛ القيد التحريري التعاوني يُفرَض في LiveUpdateGuard.
    Route::prefix('/{article}/live-updates')
        ->whereNumber('article')
        ->group(function (): void {
            Route::get('/', [LiveUpdateController::class, 'index'])
                ->middleware('permission:articles.view');

            Route::post('/', [LiveUpdateController::class, 'store'])
                ->middleware('permission:articles.edit');

            Route::put('/{liveUpdate}', [LiveUpdateController::class, 'update'])
                ->middleware('permission:articles.edit')
                ->whereNumber('liveUpdate');

            // إعادة ترتيب: نقل لأعلى/أسفل (تبديل مع الجار)
            Route::patch('/{liveUpdate}/move', [LiveUpdateController::class, 'move'])
                ->middleware('permission:articles.edit')
                ->whereNumber('liveUpdate');

            Route::delete('/{liveUpdate}', [LiveUpdateController::class, 'destroy'])
                ->middleware('permission:articles.edit')
                ->whereNumber('liveUpdate');
        });

    Route::delete('/{article}', [ArticleController::class, 'destroy'])
        ->middleware('permission:articles.delete')
        ->whereNumber('article');

    // استرجاع مقال محذوف (حذف ناعم) — يربط النموذج المحذوف عبر withTrashed
    Route::post('/{article}/restore', [ArticleController::class, 'restore'])
        ->middleware('permission:articles.restore')
        ->withTrashed()
        ->whereNumber('article');

    // حذف نهائي — لا يمكن استرجاعه
    Route::delete('/{article}/force', [ArticleController::class, 'forceDelete'])
        ->middleware('permission:articles.force_delete')
        ->withTrashed()
        ->whereNumber('article');
});

// ─── Content → Reels (نوع محتوى من الدرجة الأولى) ──────────────────────
Route::prefix('reels')->group(function (): void {
    Route::get('/', [ReelController::class, 'index'])
        ->middleware('permission:reels.view');

    // عدّادات بطاقات الحالة (لوحة الريلز) — قبل {reel} (غير عددي فلا يتقاطع).
    Route::get('/stats', [ReelController::class, 'stats'])
        ->middleware('permission:reels.view');

    // تحليلات أسطول الريلز (مجاميع + متصدّرون) — مسار ثابت قبل {reel}.
    Route::get('/analytics', [ReelController::class, 'analytics'])
        ->middleware('permission:reels.view');

    Route::post('/', [ReelController::class, 'store'])
        ->middleware('permission:reels.create');

    Route::get('/{reel}', [ReelController::class, 'show'])
        ->middleware('permission:reels.view')
        ->whereNumber('reel');

    // تحليلات ريل واحد (سياقيّة) — نطاق زمني عبر range/from/to.
    Route::get('/{reel}/analytics', [ReelController::class, 'entityAnalytics'])
        ->middleware('permission:reels.view')
        ->whereNumber('reel');

    Route::put('/{reel}', [ReelController::class, 'update'])
        ->middleware('permission:reels.edit')
        ->whereNumber('reel');

    // انتقال الحالة — البوابة reels.edit؛ النشر/الأرشفة يُفرضان في الـ Action.
    Route::patch('/{reel}/status', [ReelController::class, 'status'])
        ->middleware('permission:reels.edit')
        ->whereNumber('reel');

    Route::delete('/{reel}', [ReelController::class, 'destroy'])
        ->middleware('permission:reels.delete')
        ->whereNumber('reel');

    // استرجاع ريل محذوف (يربط النموذج المحذوف عبر withTrashed).
    Route::post('/{reel}/restore', [ReelController::class, 'restore'])
        ->middleware('permission:reels.restore')
        ->withTrashed()
        ->whereNumber('reel');

    // حذف نهائي — لا يمكن استرجاعه.
    Route::delete('/{reel}/force', [ReelController::class, 'forceDelete'])
        ->middleware('permission:reels.force_delete')
        ->withTrashed()
        ->whereNumber('reel');
});

// ─── Content → Pages (صفحات ثابتة من الدرجة الأولى — تُدار من اللوحة) ────
Route::prefix('pages')->group(function (): void {
    Route::get('/', [PageController::class, 'index'])
        ->middleware('permission:pages.view');

    Route::post('/', [PageController::class, 'store'])
        ->middleware('permission:pages.create');

    Route::get('/{page}', [PageController::class, 'show'])
        ->middleware('permission:pages.view')
        ->whereNumber('page');

    Route::put('/{page}', [PageController::class, 'update'])
        ->middleware('permission:pages.edit')
        ->whereNumber('page');

    // انتقال الحالة — البوابة pages.edit؛ النشر/الأرشفة يُفرضان في الـ Action.
    Route::patch('/{page}/status', [PageController::class, 'status'])
        ->middleware('permission:pages.edit')
        ->whereNumber('page');

    Route::delete('/{page}', [PageController::class, 'destroy'])
        ->middleware('permission:pages.delete')
        ->whereNumber('page');

    // استرجاع صفحة محذوفة (يربط النموذج المحذوف عبر withTrashed).
    Route::post('/{page}/restore', [PageController::class, 'restore'])
        ->middleware('permission:pages.restore')
        ->withTrashed()
        ->whereNumber('page');

    // حذف نهائي — لا يمكن استرجاعه.
    Route::delete('/{page}/force', [PageController::class, 'forceDelete'])
        ->middleware('permission:pages.force_delete')
        ->withTrashed()
        ->whereNumber('page');
});

// ─── Internal Chat (شات بين المدراء — متاح لكل أدمن، الوصول بالعضوية لا بصلاحية) ─
// لا permission middleware عمداً: الغلاف (auth:sanctum+abilities:admin+active+role)
// يكفي؛ الوصول لكل محادثة row-level (عضوية) داخل الـ Actions.
Route::prefix('chat')->group(function (): void {
    Route::get('/contacts', [ChatController::class, 'contacts']);

    Route::get('/conversations', [ChatController::class, 'conversations']);
    Route::post('/conversations', [ChatController::class, 'storeConversation']);

    Route::get('/conversations/{conversation}/messages', [ChatController::class, 'messages'])
        ->whereNumber('conversation');
    Route::post('/conversations/{conversation}/messages', [ChatController::class, 'send'])
        ->whereNumber('conversation');
    Route::post('/conversations/{conversation}/read', [ChatController::class, 'markRead'])
        ->whereNumber('conversation');

    Route::patch('/messages/{message}', [ChatController::class, 'updateMessage'])
        ->whereNumber('message');
    Route::delete('/messages/{message}', [ChatController::class, 'deleteMessage'])
        ->whereNumber('message');
});

// ─── Team Members (صفحات تعريفية بفريق العمل — كيان مستقلّ، نطاق عربيّ أحادي) ─
Route::prefix('team-members')->group(function (): void {
    Route::get('/', [TeamMemberController::class, 'index'])
        ->middleware('permission:team.view');

    Route::post('/', [TeamMemberController::class, 'store'])
        ->middleware('permission:team.create');

    // إعادة الترتيب — مسار حرفيّ قبل {teamMember} الرقمي.
    Route::patch('/reorder', [TeamMemberController::class, 'reorder'])
        ->middleware('permission:team.edit');

    Route::get('/{teamMember}', [TeamMemberController::class, 'show'])
        ->middleware('permission:team.view')
        ->whereNumber('teamMember');

    Route::put('/{teamMember}', [TeamMemberController::class, 'update'])
        ->middleware('permission:team.edit')
        ->whereNumber('teamMember');

    // تبديل الحالة (active/inactive) — البوابة team.edit (لا نشر/أرشفة منفصلة).
    Route::patch('/{teamMember}/status', [TeamMemberController::class, 'status'])
        ->middleware('permission:team.edit')
        ->whereNumber('teamMember');

    Route::delete('/{teamMember}', [TeamMemberController::class, 'destroy'])
        ->middleware('permission:team.delete')
        ->whereNumber('teamMember');

    // استرجاع عضو محذوف (يربط النموذج المحذوف عبر withTrashed).
    Route::post('/{teamMember}/restore', [TeamMemberController::class, 'restore'])
        ->middleware('permission:team.restore')
        ->withTrashed()
        ->whereNumber('teamMember');

    // حذف نهائي — لا يمكن استرجاعه.
    Route::delete('/{teamMember}/force', [TeamMemberController::class, 'forceDelete'])
        ->middleware('permission:team.force_delete')
        ->withTrashed()
        ->whereNumber('teamMember');
});

// ─── Competitions (تغطية المزامنة + أعلام شريط المباريات التحريريّة — مستقلّان بنيويًّا،
// راجع Competition::class docblock). حجم متوقَّع صغير ⇒ بلا ترقيم صفحات/حذف ناعم. ────
Route::prefix('competitions')->group(function (): void {
    Route::get('/', [CompetitionController::class, 'index'])
        ->middleware('permission:competitions.view');

    Route::post('/', [CompetitionController::class, 'store'])
        ->middleware('permission:competitions.manage');

    Route::put('/{competition}', [CompetitionController::class, 'update'])
        ->middleware('permission:competitions.manage')
        ->whereNumber('competition');

    Route::delete('/{competition}', [CompetitionController::class, 'destroy'])
        ->middleware('permission:competitions.manage')
        ->whereNumber('competition');
});

// ─── إعدادات شريط المباريات — وضع واحد حصريّ (MatchBarSource). القراءة مصادَقة عامّة؛
// التبديل settings.edit (مطابق لنمط NewspaperSettingsController). ────────────────────
Route::prefix('settings/match-bar')->group(function (): void {
    Route::get('/', [MatchBarSettingsController::class, 'show']);
    Route::put('/', [MatchBarSettingsController::class, 'update'])
        ->middleware('permission:settings.edit');
});

// ─── Video Library → Videos (نطاق من الدرجة الأولى) ────────────────────
Route::prefix('videos')->group(function (): void {
    Route::get('/', [VideoController::class, 'index'])
        ->middleware('permission:videos.view');

    Route::get('/stats', [VideoController::class, 'stats'])
        ->middleware('permission:videos.view');

    // لوحة مكتبة الفيديو (مجاميع للواجهة/الموبايل) — قبل {video}.
    Route::get('/dashboard', [VideoController::class, 'dashboard'])
        ->middleware('permission:videos.view');

    // تحليلات (مجاميع تفاعل حقيقية) ومركز عمليات — مسارات ثابتة قبل {video}.
    Route::get('/analytics', [VideoController::class, 'analytics'])
        ->middleware('permission:videos.view');

    Route::get('/operations', [VideoController::class, 'operations'])
        ->middleware('permission:videos.view');

    // عمليات جماعية (نجاح جزئي) — بوابة خشنة videos.edit؛ صلاحية كل عملية في الـ Action.
    Route::post('/bulk', [VideoController::class, 'bulk'])
        ->middleware('permission:videos.edit');

    Route::post('/', [VideoController::class, 'store'])
        ->middleware('permission:videos.create');

    Route::get('/{video}', [VideoController::class, 'show'])
        ->middleware('permission:videos.view')
        ->whereNumber('video');

    // تحليلات فيديو واحد (سياقيّة) — بعد /{video} لكنها لا تتعارض (مقطع ثابت).
    Route::get('/{video}/analytics', [VideoController::class, 'entityAnalytics'])
        ->middleware('permission:videos.view')
        ->whereNumber('video');

    Route::put('/{video}', [VideoController::class, 'update'])
        ->middleware('permission:videos.edit')
        ->whereNumber('video');

    // انتقال الحالة — البوابة videos.edit؛ النشر/الأرشفة يُفرضان في الـ Action.
    Route::patch('/{video}/status', [VideoController::class, 'status'])
        ->middleware('permission:videos.edit')
        ->whereNumber('video');

    // إعادة معالجة وسائط فيديو مرفوع (retry) — صلاحية مخصّصة videos.reprocess.
    Route::post('/{video}/reprocess', [VideoController::class, 'reprocess'])
        ->middleware('permission:videos.reprocess')
        ->whereNumber('video');

    Route::delete('/{video}', [VideoController::class, 'destroy'])
        ->middleware('permission:videos.delete')
        ->whereNumber('video');

    Route::post('/{video}/restore', [VideoController::class, 'restore'])
        ->middleware('permission:videos.restore')
        ->withTrashed()
        ->whereNumber('video');

    Route::delete('/{video}/force', [VideoController::class, 'forceDelete'])
        ->middleware('permission:videos.force_delete')
        ->withTrashed()
        ->whereNumber('video');
});

// ─── Video Library → Categories (تصنيف مستقل خاص بالفيديو) ─────────────
Route::prefix('video-categories')->group(function (): void {
    Route::get('/', [VideoCategoryController::class, 'index'])
        ->middleware('permission:video-categories.view');

    Route::post('/', [VideoCategoryController::class, 'store'])
        ->middleware('permission:video-categories.manage');

    Route::patch('/{videoCategory}/move', [VideoCategoryController::class, 'move'])
        ->middleware('permission:video-categories.manage')
        ->whereNumber('videoCategory');

    Route::get('/{videoCategory}', [VideoCategoryController::class, 'show'])
        ->middleware('permission:video-categories.view')
        ->whereNumber('videoCategory');

    Route::put('/{videoCategory}', [VideoCategoryController::class, 'update'])
        ->middleware('permission:video-categories.manage')
        ->whereNumber('videoCategory');

    Route::delete('/{videoCategory}', [VideoCategoryController::class, 'destroy'])
        ->middleware('permission:video-categories.manage')
        ->whereNumber('videoCategory');

    Route::post('/{videoCategory}/restore', [VideoCategoryController::class, 'restore'])
        ->middleware('permission:video-categories.manage')
        ->withTrashed()
        ->whereNumber('videoCategory');

    Route::delete('/{videoCategory}/force', [VideoCategoryController::class, 'forceDelete'])
        ->middleware('permission:video-categories.manage')
        ->withTrashed()
        ->whereNumber('videoCategory');
});

// ─── Video Library → Playlists (قوائم منسَّقة مرتّبة) ──────────────────
Route::prefix('video-playlists')->group(function (): void {
    Route::get('/', [VideoPlaylistController::class, 'index'])
        ->middleware('permission:video-playlists.view');

    Route::post('/', [VideoPlaylistController::class, 'store'])
        ->middleware('permission:video-playlists.manage');

    Route::get('/{videoPlaylist}', [VideoPlaylistController::class, 'show'])
        ->middleware('permission:video-playlists.view')
        ->whereNumber('videoPlaylist');

    Route::put('/{videoPlaylist}', [VideoPlaylistController::class, 'update'])
        ->middleware('permission:video-playlists.manage')
        ->whereNumber('videoPlaylist');

    Route::delete('/{videoPlaylist}', [VideoPlaylistController::class, 'destroy'])
        ->middleware('permission:video-playlists.manage')
        ->whereNumber('videoPlaylist');

    Route::post('/{videoPlaylist}/restore', [VideoPlaylistController::class, 'restore'])
        ->middleware('permission:video-playlists.manage')
        ->withTrashed()
        ->whereNumber('videoPlaylist');

    Route::delete('/{videoPlaylist}/force', [VideoPlaylistController::class, 'forceDelete'])
        ->middleware('permission:video-playlists.manage')
        ->withTrashed()
        ->whereNumber('videoPlaylist');

    // إدارة فيديوهات القائمة: إضافة / إزالة / إعادة ترتيب (سحب).
    Route::post('/{videoPlaylist}/videos', [VideoPlaylistController::class, 'attachVideos'])
        ->middleware('permission:video-playlists.manage')
        ->whereNumber('videoPlaylist');

    Route::delete('/{videoPlaylist}/videos/{video}', [VideoPlaylistController::class, 'detachVideo'])
        ->middleware('permission:video-playlists.manage')
        ->whereNumber('videoPlaylist')
        ->whereNumber('video');

    Route::patch('/{videoPlaylist}/reorder', [VideoPlaylistController::class, 'reorderVideos'])
        ->middleware('permission:video-playlists.manage')
        ->whereNumber('videoPlaylist');
});

// ─── Broadcast → Broadcasts (نطاق مستقل — بثّ خارجي موثوق فقط) ──────────
Route::prefix('broadcasts')->group(function (): void {
    Route::get('/', [BroadcastController::class, 'index'])
        ->middleware('permission:broadcasts.view');

    // مركز العمليات (B9) — قبل /{broadcast} لتفادي الالتقاط (محصور رقمياً أصلاً).
    Route::get('/dashboard', [BroadcastController::class, 'dashboard'])
        ->middleware('permission:broadcasts.view');

    Route::post('/', [BroadcastController::class, 'store'])
        ->middleware('permission:broadcasts.create');

    Route::get('/{broadcast}', [BroadcastController::class, 'show'])
        ->middleware('permission:broadcasts.view')
        ->whereNumber('broadcast');

    // تحليلات بثّ واحد (سياقيّة) — نطاق زمني عبر range/from/to.
    Route::get('/{broadcast}/analytics', [BroadcastController::class, 'analytics'])
        ->middleware('permission:broadcasts.view')
        ->whereNumber('broadcast');

    Route::put('/{broadcast}', [BroadcastController::class, 'update'])
        ->middleware('permission:broadcasts.edit')
        ->whereNumber('broadcast');

    Route::delete('/{broadcast}', [BroadcastController::class, 'destroy'])
        ->middleware('permission:broadcasts.delete')
        ->whereNumber('broadcast');

    // ─── دورة الحياة (انتقالات صريحة — لا setStatus عام؛ آلة الحالة تفرض الشرعية) ──
    Route::post('/{broadcast}/schedule', [BroadcastLifecycleController::class, 'schedule'])
        ->middleware('permission:broadcasts.schedule')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/start', [BroadcastLifecycleController::class, 'start'])
        ->middleware('permission:broadcasts.control')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/offline', [BroadcastLifecycleController::class, 'offline'])
        ->middleware('permission:broadcasts.control')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/resume', [BroadcastLifecycleController::class, 'resume'])
        ->middleware('permission:broadcasts.control')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/end', [BroadcastLifecycleController::class, 'end'])
        ->middleware('permission:broadcasts.control')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/fail', [BroadcastLifecycleController::class, 'fail'])
        ->middleware('permission:broadcasts.control')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/archive', [BroadcastLifecycleController::class, 'archive'])
        ->middleware('permission:broadcasts.archive')
        ->whereNumber('broadcast');

    // ─── الإشراف على الجمهور (B6) — تحكّم تعاونيّ فوق محرّك الحضور (B5)؛ لا قطع بايت.
    // صلاحيات حبيبيّة منفصلة لكل قدرة (طرد/حظر/تحكّم بالجمهور/إيقاف طارئ).
    Route::post('/{broadcast}/moderation/kick', [BroadcastModerationController::class, 'kick'])
        ->middleware('permission:broadcasts.viewer_control')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/moderation/ban', [BroadcastModerationController::class, 'ban'])
        ->middleware('permission:broadcasts.viewer_ban')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/moderation/unban', [BroadcastModerationController::class, 'unban'])
        ->middleware('permission:broadcasts.viewer_ban')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/moderation/close', [BroadcastModerationController::class, 'close'])
        ->middleware('permission:broadcasts.audience_control')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/moderation/reopen', [BroadcastModerationController::class, 'reopen'])
        ->middleware('permission:broadcasts.audience_control')
        ->whereNumber('broadcast');

    Route::post('/{broadcast}/moderation/emergency-shutdown', [BroadcastModerationController::class, 'emergencyShutdown'])
        ->middleware('permission:broadcasts.emergency_shutdown')
        ->whereNumber('broadcast');
});

// ─── Broadcast → Categories (تصنيف مسطّح مستقل) ───────────────────────
Route::prefix('broadcast-categories')->group(function (): void {
    Route::get('/', [BroadcastCategoryController::class, 'index'])
        ->middleware('permission:broadcast-categories.view');

    Route::post('/', [BroadcastCategoryController::class, 'store'])
        ->middleware('permission:broadcast-categories.manage');

    Route::get('/{broadcastCategory}', [BroadcastCategoryController::class, 'show'])
        ->middleware('permission:broadcast-categories.view')
        ->whereNumber('broadcastCategory');

    Route::put('/{broadcastCategory}', [BroadcastCategoryController::class, 'update'])
        ->middleware('permission:broadcast-categories.manage')
        ->whereNumber('broadcastCategory');

    Route::delete('/{broadcastCategory}', [BroadcastCategoryController::class, 'destroy'])
        ->middleware('permission:broadcast-categories.manage')
        ->whereNumber('broadcastCategory');
});

// ─── Advertising → Campaigns (حملات — جدولة/أولوية/دورة حياة) ──────────
Route::prefix('campaigns')->group(function (): void {
    Route::get('/', [AdCampaignController::class, 'index'])
        ->middleware('permission:ads.view');

    Route::post('/', [AdCampaignController::class, 'store'])
        ->middleware('permission:ads.create');

    Route::get('/{adCampaign}', [AdCampaignController::class, 'show'])
        ->middleware('permission:ads.view')
        ->whereNumber('adCampaign');

    Route::put('/{adCampaign}', [AdCampaignController::class, 'update'])
        ->middleware('permission:ads.edit')
        ->whereNumber('adCampaign');

    // انتقال الحالة — بوابة ads.publish؛ آلة الحالة + حارس النافذة يُفرضان في الـ Action.
    Route::patch('/{adCampaign}/status', [AdCampaignController::class, 'status'])
        ->middleware('permission:ads.publish')
        ->whereNumber('adCampaign');

    Route::delete('/{adCampaign}', [AdCampaignController::class, 'destroy'])
        ->middleware('permission:ads.delete')
        ->whereNumber('adCampaign');

    // استرجاع حملة محذوفة (يربط النموذج المحذوف عبر withTrashed).
    Route::post('/{adCampaign}/restore', [AdCampaignController::class, 'restore'])
        ->middleware('permission:ads.restore')
        ->withTrashed()
        ->whereNumber('adCampaign');

    // حذف نهائي — لا يمكن استرجاعه.
    Route::delete('/{adCampaign}/force', [AdCampaignController::class, 'forceDelete'])
        ->middleware('permission:ads.force_delete')
        ->withTrashed()
        ->whereNumber('adCampaign');
});

// ─── Advertising → Creatives (الوحدة المعروضة — image/html؛ video مؤجّل) ──
Route::prefix('ad-creatives')->group(function (): void {
    Route::get('/', [AdCreativeController::class, 'index'])
        ->middleware('permission:ads.view');

    Route::post('/', [AdCreativeController::class, 'store'])
        ->middleware('permission:ads.create');

    Route::get('/{adCreative}', [AdCreativeController::class, 'show'])
        ->middleware('permission:ads.view')
        ->whereNumber('adCreative');

    Route::put('/{adCreative}', [AdCreativeController::class, 'update'])
        ->middleware('permission:ads.edit')
        ->whereNumber('adCreative');

    Route::delete('/{adCreative}', [AdCreativeController::class, 'destroy'])
        ->middleware('permission:ads.delete')
        ->whereNumber('adCreative');

    // استرجاع إبداع محذوف (يربط النموذج المحذوف عبر withTrashed).
    Route::post('/{adCreative}/restore', [AdCreativeController::class, 'restore'])
        ->middleware('permission:ads.restore')
        ->withTrashed()
        ->whereNumber('adCreative');

    // حذف نهائي — لا يمكن استرجاعه.
    Route::delete('/{adCreative}/force', [AdCreativeController::class, 'forceDelete'])
        ->middleware('permission:ads.force_delete')
        ->withTrashed()
        ->whereNumber('adCreative');
});

// ─── Advertising → Placements (إسناد إبداع ↔ مساحة — المرشّح القابل للعرض) ──
Route::prefix('ad-placements')->group(function (): void {
    Route::get('/', [AdPlacementController::class, 'index'])
        ->middleware('permission:ads.view');

    // إسناد (إنشاء) — يفرض التوافق + منع التكرار في الـ Action.
    Route::post('/', [AdPlacementController::class, 'store'])
        ->middleware('permission:ads.create');

    Route::get('/{adPlacement}', [AdPlacementController::class, 'show'])
        ->middleware('permission:ads.view')
        ->whereNumber('adPlacement');

    Route::put('/{adPlacement}', [AdPlacementController::class, 'update'])
        ->middleware('permission:ads.edit')
        ->whereNumber('adPlacement');

    // فصل (حذف صلب — الإسناد رابط، لا حذف ناعم).
    Route::delete('/{adPlacement}', [AdPlacementController::class, 'destroy'])
        ->middleware('permission:ads.delete')
        ->whereNumber('adPlacement');
});

// ─── Advertising → Zones (كيان إعداد — مساحات عرض الإعلانات) ───────────
Route::prefix('ad-zones')->group(function (): void {
    Route::get('/', [AdZoneController::class, 'index'])
        ->middleware('permission:ad-zones.view');

    Route::post('/', [AdZoneController::class, 'store'])
        ->middleware('permission:ad-zones.manage');

    Route::get('/{adZone}', [AdZoneController::class, 'show'])
        ->middleware('permission:ad-zones.view')
        ->whereNumber('adZone');

    Route::put('/{adZone}', [AdZoneController::class, 'update'])
        ->middleware('permission:ad-zones.manage')
        ->whereNumber('adZone');

    Route::delete('/{adZone}', [AdZoneController::class, 'destroy'])
        ->middleware('permission:ad-zones.manage')
        ->whereNumber('adZone');
});

// ─── Advertising → Analytics (تجميعيّة — قراءة فقط، نطاق زمنيّ عبر range/from/to) ──
Route::get('ads/analytics', [AdAnalyticsController::class, 'index'])
    ->middleware('permission:ads.view');

// ─── Site Analytics Dashboard (موحّدة — قراءة فقط، تجميع عبر الأنظمة الفرعية) ──
Route::get('dashboard', [SiteAnalyticsController::class, 'index'])
    ->middleware('permission:analytics.view');

// ─── WhatsApp → Groups + Contacts (حملات واتساب — Phase 3: مجموعات وجهات اتصال) ──
Route::prefix('whatsapp-groups')->group(function (): void {
    Route::get('/', [WhatsappGroupController::class, 'index'])
        ->middleware('permission:whatsapp.view');

    Route::post('/', [WhatsappGroupController::class, 'store'])
        ->middleware('permission:whatsapp.manage');

    Route::put('/{whatsappGroup}', [WhatsappGroupController::class, 'update'])
        ->middleware('permission:whatsapp.manage')
        ->whereNumber('whatsappGroup');

    Route::delete('/{whatsappGroup}', [WhatsappGroupController::class, 'destroy'])
        ->middleware('permission:whatsapp.manage')
        ->whereNumber('whatsappGroup');
});

Route::prefix('whatsapp-contacts')->group(function (): void {
    Route::get('/', [WhatsappContactController::class, 'index'])
        ->middleware('permission:whatsapp.view');

    // الاستيراد/التصدير قبل مسارات {whatsappContact} المقيَّدة عددياً (لا تصادم — مقاطع نصّية).
    Route::post('import', [WhatsappContactController::class, 'import'])
        ->middleware(['permission:whatsapp.import', 'throttle:10,1']);

    Route::get('export', [WhatsappContactController::class, 'export'])
        ->middleware('permission:whatsapp.export');

    Route::post('/', [WhatsappContactController::class, 'store'])
        ->middleware('permission:whatsapp.manage');

    Route::put('/{whatsappContact}', [WhatsappContactController::class, 'update'])
        ->middleware('permission:whatsapp.manage')
        ->whereNumber('whatsappContact');

    Route::delete('/{whatsappContact}', [WhatsappContactController::class, 'destroy'])
        ->middleware('permission:whatsapp.manage')
        ->whereNumber('whatsappContact');
});

// ─── WhatsApp → Campaigns (إرسال إعلانيّ/خبر + سجلّ الحملات — Phase 5) ──
Route::prefix('whatsapp-campaigns')->group(function (): void {
    Route::get('/', [WhatsappCampaignController::class, 'index'])
        ->middleware('permission:whatsapp.view');

    // عدّ المستلمين قبل الحفظ — مقطع نصّيّ يسبق {whatsappCampaign} المقيَّد عددياً.
    Route::post('recipients-count', [WhatsappCampaignController::class, 'recipientsCount'])
        ->middleware('permission:whatsapp.send');

    Route::post('/', [WhatsappCampaignController::class, 'store'])
        ->middleware('permission:whatsapp.send');

    Route::get('/{whatsappCampaign}', [WhatsappCampaignController::class, 'show'])
        ->middleware('permission:whatsapp.view')
        ->whereNumber('whatsappCampaign');

    Route::get('/{whatsappCampaign}/messages', [WhatsappCampaignController::class, 'messages'])
        ->middleware('permission:whatsapp.view')
        ->whereNumber('whatsappCampaign');

    Route::get('/{whatsappCampaign}/preview', [WhatsappCampaignController::class, 'preview'])
        ->middleware('permission:whatsapp.send')
        ->whereNumber('whatsappCampaign');

    Route::post('/{whatsappCampaign}/test', [WhatsappCampaignController::class, 'test'])
        ->middleware(['permission:whatsapp.send', 'throttle:10,1'])
        ->whereNumber('whatsappCampaign');

    Route::post('/{whatsappCampaign}/send', [WhatsappCampaignController::class, 'send'])
        ->middleware(['permission:whatsapp.send', 'throttle:30,1'])
        ->whereNumber('whatsappCampaign');

    Route::post('/{whatsappCampaign}/cancel', [WhatsappCampaignController::class, 'cancel'])
        ->middleware('permission:whatsapp.send')
        ->whereNumber('whatsappCampaign');

    Route::delete('/{whatsappCampaign}', [WhatsappCampaignController::class, 'destroy'])
        ->middleware('permission:whatsapp.send')
        ->whereNumber('whatsappCampaign');
});

// ─── Polls (استطلاعات الرأي — Phase 1: المجال + CRUD الإداريّ) ───────────
// التفعيل (active) إجراء نشر مستقلّ ببوابة polls.publish — لا يُضبط عبر إنشاء/تعديل.
Route::prefix('polls')->group(function (): void {
    Route::get('/', [PollController::class, 'index'])
        ->middleware('permission:polls.view');

    Route::post('/', [PollController::class, 'store'])
        ->middleware('permission:polls.create');

    // تحليلات (Phase 4 — حساب-عند-القراءة). الأسطول قبل /{poll} (ترتيب نظيف).
    Route::get('/analytics', [PollController::class, 'analytics'])
        ->middleware('permission:polls.view');

    Route::get('/{poll}/analytics', [PollController::class, 'entityAnalytics'])
        ->middleware('permission:polls.view')
        ->whereNumber('poll');

    Route::get('/{poll}', [PollController::class, 'show'])
        ->middleware('permission:polls.view')
        ->whereNumber('poll');

    Route::put('/{poll}', [PollController::class, 'update'])
        ->middleware('permission:polls.edit')
        ->whereNumber('poll');

    // تفعيل/تعطيل — بوابة polls.publish (لا polls.edit).
    Route::patch('/{poll}/active', [PollController::class, 'toggleActive'])
        ->middleware('permission:polls.publish')
        ->whereNumber('poll');

    Route::delete('/{poll}', [PollController::class, 'destroy'])
        ->middleware('permission:polls.delete')
        ->whereNumber('poll');

    Route::post('/{poll}/restore', [PollController::class, 'restore'])
        ->middleware('permission:polls.restore')
        ->withTrashed()
        ->whereNumber('poll');

    Route::delete('/{poll}/force', [PollController::class, 'forceDelete'])
        ->middleware('permission:polls.force_delete')
        ->withTrashed()
        ->whereNumber('poll');
});

// ─── Epaper (Digital Newspaper issues — Core CRUD + lifecycle) ──────────
Route::prefix('epapers')->group(function (): void {
    // إعدادات الوحدة — القراءة متاحة لأي مشرف مصادَق (لتقييد التنقّل على enabled)؛
    // التبديل يتطلّب settings.edit. تسبق /{epaper} (المقيَّد عددياً) فلا تصادم.
    Route::get('settings', [NewspaperSettingsController::class, 'show']);
    Route::put('settings', [NewspaperSettingsController::class, 'update'])
        ->middleware('permission:settings.edit');

    // دلالة "معطَّل = غير موجود": كل مسارات الجريدة عدا الإعدادات تُحجب (404) ما لم تُفعَّل الوحدة.
    Route::middleware('newspaper.enabled')->group(function (): void {
        Route::get('/', [EpaperController::class, 'index'])
            ->middleware('permission:epapers.view');

        Route::post('/', [EpaperController::class, 'store'])
            ->middleware('permission:epapers.create');

        // لوحة تحليلات القارئ العابرة + الرؤية التشغيليّة (Final completion) — مسبقة على
        // /{epaper} (غير رقميّة فلا تصادم whereNumber). للقراءة فقط (epapers.view).
        Route::get('analytics', [EpaperController::class, 'dashboard'])
            ->middleware('permission:epapers.view');
        Route::get('operations', [EpaperController::class, 'operations'])
            ->middleware('permission:epapers.view');

        Route::get('/{epaper}', [EpaperController::class, 'show'])
            ->middleware('permission:epapers.view')
            ->whereNumber('epaper');

        Route::put('/{epaper}', [EpaperController::class, 'update'])
            ->middleware('permission:epapers.edit')
            ->whereNumber('epaper');

        Route::post('/{epaper}/replace-pdf', [EpaperController::class, 'replacePdf'])
            ->middleware('permission:epapers.edit')
            ->whereNumber('epaper');

        // رفع/تعيين غلاف العدد يدوياً (صورة) — conversions['cover'].
        Route::post('/{epaper}/cover', [EpaperController::class, 'setCover'])
            ->middleware('permission:epapers.edit')
            ->whereNumber('epaper');

        // إعادة تشغيل استخراج النصّ (OCR) — Phase 4a.
        Route::post('/{epaper}/ocr/rerun', [EpaperController::class, 'reprocessOcr'])
            ->middleware('permission:epapers.edit')
            ->whereNumber('epaper');

        // تحليلات القارئ (Phase 5) — تقرير أساسيّ لكل عدد.
        Route::get('/{epaper}/analytics', [EpaperController::class, 'analytics'])
            ->middleware('permission:epapers.view')
            ->whereNumber('epaper');

        Route::patch('/{epaper}/status', [EpaperController::class, 'status'])
            ->middleware('permission:epapers.edit')
            ->whereNumber('epaper');

        Route::post('/{epaper}/duplicate', [EpaperController::class, 'duplicate'])
            ->middleware('permission:epapers.create')
            ->whereNumber('epaper');

        Route::delete('/{epaper}', [EpaperController::class, 'destroy'])
            ->middleware('permission:epapers.delete')
            ->whereNumber('epaper');

        Route::post('/{epaper}/restore', [EpaperController::class, 'restore'])
            ->middleware('permission:epapers.restore')
            ->withTrashed()
            ->whereNumber('epaper');

        Route::delete('/{epaper}/force', [EpaperController::class, 'forceDelete'])
            ->middleware('permission:epapers.force_delete')
            ->withTrashed()
            ->whereNumber('epaper');
    });
});

// ─── WordPress Migration (Discovery → Execution platform) ───────────────
Route::prefix('wp-migration')->group(function (): void {
    Route::get('/runs', [WpMigrationController::class, 'index'])
        ->middleware('permission:wp-migration.view');

    Route::get('/runs/{run}', [WpMigrationController::class, 'show'])
        ->middleware('permission:wp-migration.view')
        ->whereNumber('run');

    // قراءة فقط على المصدر — اختبار/تدقيق مُقيَّد بمعدّل (يضرب قاعدة خارجية).
    Route::post('/connection/test', [WpMigrationController::class, 'testConnection'])
        ->middleware(['permission:wp-migration.manage', 'throttle:20,1']);

    Route::post('/runs', [WpMigrationController::class, 'store'])
        ->middleware('permission:wp-migration.manage');

    Route::post('/runs/{run}/audit', [WpMigrationController::class, 'audit'])
        ->middleware(['permission:wp-migration.manage', 'throttle:10,1'])
        ->whereNumber('run');

    // Step 3–4: اختيار التصنيفات وتنسيبها (أخبار/مقالات → هدف بنطاق مطابق).
    Route::get('/runs/{run}/categories', [WpMigrationController::class, 'categories'])
        ->middleware('permission:wp-migration.view')
        ->whereNumber('run');

    Route::get('/runs/{run}/target-categories', [WpMigrationController::class, 'targetCategories'])
        ->middleware('permission:wp-migration.view')
        ->whereNumber('run');

    Route::put('/runs/{run}/category-maps', [WpMigrationController::class, 'saveCategoryMaps'])
        ->middleware('permission:wp-migration.manage')
        ->whereNumber('run');

    // Step 4.5: استيراد التصنيفات (إنشاء تصنيفات AlphaCMS من المصدر) — بعد التنسيب، قبل المعاينة.
    Route::post('/runs/{run}/import-taxonomy', [WpMigrationController::class, 'importTaxonomy'])
        ->middleware('permission:wp-migration.manage')
        ->whereNumber('run');

    // Step 5: معاينة الأثر (قراءة فقط) + الاعتماد (بوّابة التنفيذ).
    Route::post('/runs/{run}/preview', [WpMigrationController::class, 'preview'])
        ->middleware(['permission:wp-migration.manage', 'throttle:10,1'])
        ->whereNumber('run');

    Route::post('/runs/{run}/approve', [WpMigrationController::class, 'approve'])
        ->middleware('permission:wp-migration.manage')
        ->whereNumber('run');

    // Step 6: تنفيذ مُنسَّق على الطابور (بوّابة صلبة + لقطة دفتر + توزيع ذاتيّ الجدولة).
    Route::post('/runs/{run}/start', [WpMigrationController::class, 'start'])
        ->middleware('permission:wp-migration.manage')
        ->whereNumber('run');

    // ⚠️ TEMPORARY FEATURE — Quick Incremental Import — Remove before Production release.
    // TODO(production): احذف هذا المسار أو عطّله (WP_MIGRATION_QUICK_INCREMENTAL=false).
    Route::post('/runs/{run}/quick-incremental', [WpMigrationController::class, 'quickIncremental'])
        ->middleware('permission:wp-migration.manage')
        ->whereNumber('run');

    Route::post('/runs/{run}/pause', [WpMigrationController::class, 'pause'])
        ->middleware('permission:wp-migration.manage')
        ->whereNumber('run');

    Route::post('/runs/{run}/resume', [WpMigrationController::class, 'resume'])
        ->middleware('permission:wp-migration.manage')
        ->whereNumber('run');

    Route::post('/runs/{run}/stop', [WpMigrationController::class, 'stop'])
        ->middleware('permission:wp-migration.manage')
        ->whereNumber('run');

    // Steps 7–9: مراقبة حيّة + تنقيب الفشل + تقرير ختام (قراءة) + إعادة المحاولة (إدارة).
    Route::get('/runs/{run}/stats', [WpMigrationController::class, 'stats'])
        ->middleware('permission:wp-migration.view')
        ->whereNumber('run');

    Route::get('/runs/{run}/items', [WpMigrationController::class, 'items'])
        ->middleware('permission:wp-migration.view')
        ->whereNumber('run');

    Route::get('/runs/{run}/report', [WpMigrationController::class, 'report'])
        ->middleware('permission:wp-migration.view')
        ->whereNumber('run');

    Route::post('/runs/{run}/retry', [WpMigrationController::class, 'retry'])
        ->middleware('permission:wp-migration.manage')
        ->whereNumber('run');
});

// ─── Vertix Migration (نظام مستقلّ تماماً عن WordPress — قسمان: أقسام ثمّ أخبار) ──
Route::prefix('vertix-migration')->group(function (): void {
    Route::get('/status', [VertixMigrationController::class, 'status'])
        ->middleware('permission:vertix-migration.view');

    Route::post('/import-categories', [VertixMigrationController::class, 'importCategories'])
        ->middleware('permission:vertix-migration.manage');

    Route::post('/import-news', [VertixMigrationController::class, 'importNews'])
        ->middleware('permission:vertix-migration.manage');

    Route::post('/stop-news', [VertixMigrationController::class, 'stopNews'])
        ->middleware('permission:vertix-migration.manage');
});

// ─── Content → Tags (autocomplete/search for the editor) ──────────────
Route::get('tags', [TagController::class, 'index'])
    ->middleware('permission:articles.edit|articles.create');

// ─── Content → Tags management (list + usage count + rename + delete) ──
Route::get('tags/manage', [TagController::class, 'managed'])
    ->middleware('permission:tags.view');
Route::put('tags/{tag}', [TagController::class, 'update'])
    ->middleware('permission:tags.edit')
    ->whereNumber('tag');
Route::delete('tags/{tag}', [TagController::class, 'destroy'])
    ->middleware('permission:tags.delete')
    ->whereNumber('tag');

// ─── Content → Entities (canonical registry — Task 12) ────────────────
Route::get('entities', [EntityController::class, 'index'])
    ->middleware('permission:articles.edit|articles.create|videos.edit|reels.edit');
Route::post('entities', [EntityController::class, 'store'])
    ->middleware('permission:entities.create');
Route::get('articles/{article}/entities', [EntityController::class, 'forArticle'])
    ->middleware('permission:articles.edit')
    ->whereNumber('article');
Route::patch('articles/{article}/entities', [EntityController::class, 'syncForArticle'])
    ->middleware('permission:articles.edit')
    ->whereNumber('article');
Route::get('videos/{video}/entities', [EntityController::class, 'forVideo'])
    ->middleware('permission:videos.edit')
    ->whereNumber('video');
Route::patch('videos/{video}/entities', [EntityController::class, 'syncForVideo'])
    ->middleware('permission:videos.edit')
    ->whereNumber('video');
Route::get('reels/{reel}/entities', [EntityController::class, 'forReel'])
    ->middleware('permission:reels.edit')
    ->whereNumber('reel');
Route::patch('reels/{reel}/entities', [EntityController::class, 'syncForReel'])
    ->middleware('permission:reels.edit')
    ->whereNumber('reel');

// ─── Content → Comments moderation (read + moderate + delete) ──────────
Route::get('comments', [CommentController::class, 'index'])
    ->middleware('permission:comments.view');
Route::patch('comments/{comment}/status', [CommentController::class, 'updateStatus'])
    ->middleware('permission:comments.approve')
    ->whereNumber('comment');
Route::delete('comments/{comment}', [CommentController::class, 'destroy'])
    ->middleware('permission:comments.delete')
    ->whereNumber('comment');

// ─── Contact Messages (inbox — view / mark-read / status / reply / delete) ─────
Route::prefix('contact-messages')->group(function (): void {
    Route::get('/', [ContactMessageController::class, 'index'])
        ->middleware('permission:contact-messages.view');
    Route::get('/{contactMessage}', [ContactMessageController::class, 'show'])
        ->middleware('permission:contact-messages.view')
        ->whereNumber('contactMessage');
    Route::post('/{contactMessage}/read', [ContactMessageController::class, 'markRead'])
        ->middleware('permission:contact-messages.view')
        ->whereNumber('contactMessage');
    Route::patch('/{contactMessage}/status', [ContactMessageController::class, 'updateStatus'])
        ->middleware('permission:contact-messages.reply')
        ->whereNumber('contactMessage');
    Route::post('/{contactMessage}/reply', [ContactMessageController::class, 'reply'])
        ->middleware('permission:contact-messages.reply')
        ->whereNumber('contactMessage');
    Route::delete('/{contactMessage}', [ContactMessageController::class, 'destroy'])
        ->middleware('permission:contact-messages.delete')
        ->whereNumber('contactMessage');
});

// ─── Advertisement Requests (sales inbox — view / mark-read / status / note / delete) ──
Route::prefix('ad-requests')->group(function (): void {
    Route::get('/', [AdRequestController::class, 'index'])
        ->middleware('permission:ad-requests.view');
    Route::get('/{adRequest}', [AdRequestController::class, 'show'])
        ->middleware('permission:ad-requests.view')
        ->whereNumber('adRequest');
    Route::get('/{adRequest}/attachment', [AdRequestController::class, 'downloadAttachment'])
        ->middleware('permission:ad-requests.view')
        ->whereNumber('adRequest');
    Route::post('/{adRequest}/read', [AdRequestController::class, 'markRead'])
        ->middleware('permission:ad-requests.view')
        ->whereNumber('adRequest');
    Route::patch('/{adRequest}/status', [AdRequestController::class, 'updateStatus'])
        ->middleware('permission:ad-requests.review')
        ->whereNumber('adRequest');
    Route::post('/{adRequest}/notes', [AdRequestController::class, 'addNote'])
        ->middleware('permission:ad-requests.review')
        ->whereNumber('adRequest');
    Route::delete('/{adRequest}', [AdRequestController::class, 'destroy'])
        ->middleware('permission:ad-requests.delete')
        ->whereNumber('adRequest');
});

// ─── Inbox unread badge — عدّاد موحّد (status='new') للوحدتين. مصدر Badge الوحيد (SSoT). ──
Route::get('inbox/unread-count', [InboxController::class, 'unreadCount'])
    ->middleware('permission:contact-messages.view|ad-requests.view');

// ─── Media Library (central shared assets — P9.2) ──────────────────────
Route::get('media', [MediaAssetController::class, 'index'])
    ->middleware('permission:media.view');

Route::post('media', [MediaAssetController::class, 'store'])
    ->middleware('permission:media.upload');

// فيديو خارجي (Wave 2) — معاينة + إنشاء أصل مكتبة مرتبط بمزوّد
Route::post('media/external/resolve', [MediaAssetController::class, 'resolveExternal'])
    ->middleware(['permission:media.upload', 'throttle:30,1']);

Route::post('media/external', [MediaAssetController::class, 'storeExternal'])
    ->middleware('permission:media.upload');

// إعادة توليد مشتقّات الصور لكل المكتبة (Wave 4) — مكلف، تقييد صارم
Route::post('media/regenerate-derivatives', [MediaAssetController::class, 'regenerateDerivatives'])
    ->middleware(['permission:settings.edit', 'throttle:3,1']);

// إعادة معالجة أصل مفرد (Wave 4 — retry للحالة failed)
Route::post('media/{mediaAsset}/reprocess', [MediaAssetController::class, 'reprocess'])
    ->middleware('permission:media.upload');

// أصل مفرد (بالـ uuid) — تفصيل + «أين يُستخدَم» + استطلاع حالة الفيديو
Route::get('media/{mediaAsset}', [MediaAssetController::class, 'show'])
    ->middleware('permission:media.view');

// حوكمة المكتبة — تعديل البيانات الوصفية + حذف بحارس استخدام
Route::patch('media/{mediaAsset}', [MediaAssetController::class, 'update'])
    ->middleware('permission:media.upload');

Route::delete('media/{mediaAsset}', [MediaAssetController::class, 'destroy'])
    ->middleware('permission:media.delete');

// ملاحظة: أُزيلت منظومة «التنسيبات التحريرية» (placements) — مكان عرض الخبر
// (هيرو/عاجل/هيدر/اخترنالكم) صار مدفوعاً بأعلام جدول الأخبار مباشرةً، يضبطها
// المحرّر من نموذج الخبر، فلا حاجة لمسارات/صفحة تنسيب منفصلة.

// ─── Content → Author avatar (Spatie MediaLibrary) ─────────────────────
Route::post('authors/{user}/avatar', [AuthorMediaController::class, 'avatar'])
    ->middleware('permission:users.edit')
    ->whereNumber('user');

// ─── AI Editorial Copilot ──────────────────────────────────────────────
// مساعدة تحريرية (اقتراحات يستعرضها الصحفي) — تفويض ai.use + تحديد معدّل.
Route::prefix('ai')->group(function (): void {
    Route::middleware(['permission:ai.use', 'throttle:ai'])->group(function (): void {
        Route::post('/headlines', [AiCopilotController::class, 'headlines']);
        Route::post('/excerpt', [AiCopilotController::class, 'excerpt']);
        Route::post('/rewrite', [AiCopilotController::class, 'rewrite']);
        Route::post('/tags', [AiCopilotController::class, 'tags']);
        Route::post('/seo', [AiCopilotController::class, 'seo']);
        Route::post('/analyze', [AiCopilotController::class, 'analyze']);
    });

    // رؤية الاستخدام/التكلفة (قراءة فقط) — مَن يضبط الحدود يراها (ai.settings).
    Route::get('/usage', [AiUsageController::class, 'index'])
        ->middleware('permission:ai.settings');
});

// ─── System Operations → Scheduler ─────────────────────────────────────
Route::prefix('system/scheduler')->group(function (): void {
    Route::get('/', [SchedulerController::class, 'index'])
        ->middleware('permission:scheduler.view');

    Route::get('/{task}', [SchedulerController::class, 'show'])
        ->middleware('permission:scheduler.view');

    Route::patch('/{task}', [SchedulerController::class, 'update'])
        ->middleware('permission:scheduler.manage');

    Route::post('/{task}/run', [SchedulerController::class, 'run'])
        ->middleware(['permission:scheduler.run', 'throttle:6,1']);
});

// ─── System Operations → Health (نتائج فحوصات الصحّة — محمي) ───────────
Route::get('system/health', HealthCheckJsonResultsController::class)
    ->middleware('permission:scheduler.view');

// ─── System Operations → Diagnostics (تشخيص آمن — قراءة) ───────────────
Route::get('system/diagnostics', [SystemController::class, 'diagnostics'])
    ->middleware('permission:scheduler.view');

// ─── System Operations → Clear Content Cache (استرداد تشغيلي) ──────────
Route::post('system/cache/clear', [SystemController::class, 'clearCache'])
    ->middleware(['permission:cache.clear', 'throttle:6,1']);

// ─── System Operations → Ops Overview (لوحة رصد موحّدة) ────────────────
Route::get('system/ops-overview', [OpsController::class, 'overview'])
    ->middleware('permission:scheduler.view');

// ─── System Operations → Failed Jobs (رؤية تشغيلية + إعادة محاولة/حذف) ──
Route::prefix('system/failed-jobs')->group(function (): void {
    Route::get('/', [FailedJobController::class, 'index'])
        ->middleware('permission:failed_jobs.view');

    // إعادة المحاولة/الحذف تُجري عمليات طابور — مُقيّدة المعدّل
    Route::post('/retry', [FailedJobController::class, 'retry'])
        ->middleware(['permission:failed_jobs.manage', 'throttle:30,1']);

    Route::post('/delete', [FailedJobController::class, 'destroy'])
        ->middleware(['permission:failed_jobs.manage', 'throttle:30,1']);
});

// ─── Activity Log (system-wide audit) ──────────────────────────────────
Route::get('activity', [ActivityController::class, 'index'])
    ->middleware('permission:activity.view');

// ─── Writer Requests (account upgrade review) ──────────────────────────
Route::prefix('writer-requests')->group(function (): void {
    Route::get('/', [WriterRequestController::class, 'index'])
        ->middleware('permission:writer-requests.view');

    Route::post('/{writerRequest}/approve', [WriterRequestController::class, 'approve'])
        ->middleware('permission:writer-requests.review');

    Route::post('/{writerRequest}/reject', [WriterRequestController::class, 'reject'])
        ->middleware('permission:writer-requests.review');
});

// ─── Roles Management ──────────────────────────────────────────────────
Route::prefix('roles')->group(function (): void {
    Route::get('/', [RoleController::class, 'index'])
        ->middleware('permission:roles.view');

    Route::post('/', [RoleController::class, 'store'])
        ->middleware('permission:roles.create');

    Route::get('/{role}', [RoleController::class, 'show'])
        ->middleware('permission:roles.view');

    Route::put('/{role}', [RoleController::class, 'update'])
        ->middleware('permission:roles.edit');

    Route::delete('/{role}', [RoleController::class, 'destroy'])
        ->middleware('permission:roles.delete');
});

// ─── Permissions Management (read-only) ────────────────────────────────
Route::get('permissions', [PermissionController::class, 'index'])
    ->middleware('permission:permissions.view');

Route::get('permission-groups', [PermissionController::class, 'groups'])
    ->middleware('permission:permissions.view');

// ─── Permission Groups Management (CRUD) ───────────────────────────────
Route::post('permission-groups', [PermissionGroupController::class, 'store'])
    ->middleware('permission:permission-groups.create');

Route::put('permission-groups/{permissionGroup}', [PermissionGroupController::class, 'update'])
    ->middleware('permission:permission-groups.edit');

Route::delete('permission-groups/{permissionGroup}', [PermissionGroupController::class, 'destroy'])
    ->middleware('permission:permission-groups.delete');

// ─── Settings Management (read — 3A) ───────────────────────────────────
Route::get('settings', [SettingsController::class, 'overview'])
    ->middleware('permission:settings.view');

// التخزين الهجين: الإعدادات + عدّادات المتراكم الحيّة + صحّة المرآة
Route::get('settings/media-storage', [SettingsController::class, 'mediaStorage'])
    ->middleware('permission:settings.view');

Route::get('settings/{group}', [SettingsController::class, 'show'])
    ->middleware('permission:settings.view')
    ->whereIn('group', ['general', 'third_party', 'cdn']);

// ─── Settings Management (write/integrations — 3B) ─────────────────────
Route::middleware('permission:settings.edit')->group(function (): void {
    Route::put('settings/general', [SettingsController::class, 'updateGeneral']);
    Route::put('settings/third_party', [SettingsController::class, 'updateThirdParty']);
    Route::put('settings/cdn', [SettingsController::class, 'updateCdn']);

    Route::post('settings/general/branding', [SettingsController::class, 'uploadBranding']);
    Route::post('settings/third_party/firebase-credentials', [SettingsController::class, 'uploadFirebase']);

    // اختبارات تُجري نداءات خارجية — مُقيّدة المعدّل لمنع إساءة الاستخدام
    Route::post('settings/mail/test', [SettingsController::class, 'testMail'])
        ->middleware('throttle:10,1');
    Route::post('settings/cdn/test', [SettingsController::class, 'testCdn'])
        ->middleware('throttle:10,1');

    Route::post('settings/third-party/test/sportmonks', [SettingsController::class, 'testSportmonks'])
        ->middleware('throttle:10,1');
    Route::post('settings/third-party/test/openweather', [SettingsController::class, 'testOpenweather'])
        ->middleware('throttle:10,1');
    Route::post('settings/third-party/test/whatsapp', [SettingsController::class, 'testWhatsapp'])
        ->middleware('throttle:10,1');

    // ─── Hybrid Media Storage (remote mirror) ──────────────────────────
    Route::put('settings/media-storage', [SettingsController::class, 'updateMediaStorage']);
    Route::post('settings/media-storage/test', [SettingsController::class, 'testMediaStorage'])
        ->middleware('throttle:10,1');
    Route::post('settings/media-storage/sync', [SettingsController::class, 'syncMediaStorage'])
        ->middleware('throttle:6,1');

    // ─── Media Foundation (settings assets) ────────────────────────────
    Route::post('settings/media/branding', [MediaController::class, 'uploadBranding']);
    Route::post('settings/media/firebase', [MediaController::class, 'uploadFirebase']);
    Route::delete('settings/media/{mediaAsset}', [MediaController::class, 'destroy']);
});

// ─── CDN Module (Cloudflare only) ──────────────────────────────────────
Route::prefix('cdn')->group(function (): void {
    Route::get('status', [CdnController::class, 'status'])
        ->middleware('permission:cdn.view');

    Route::put('settings', [CdnController::class, 'updateSettings'])
        ->middleware('permission:cdn.edit');

    Route::post('test', [CdnController::class, 'test'])
        ->middleware(['permission:cdn.view', 'throttle:10,1']);

    Route::post('purge', [CdnController::class, 'purge'])
        ->middleware(['permission:cdn.purge', 'throttle:30,1']);

    // مسح كامل للحافة — مكلف جداً، تقييد صارم
    Route::post('purge-all', [CdnController::class, 'purgeAll'])
        ->middleware(['permission:cdn.purge', 'throttle:3,1']);
});

// ─── Notification Center Module (الحملات/المصفوفة/القوالب/الجماهير/الصحّة) ───
// view=قراءة · manage=مصفوفة/قوالب/دورة حياة · send=تأليف يدويّ. الترتيب: الحرفيّ قبل {param}.
Route::prefix('notifications')->group(function (): void {
    // الحملات
    Route::get('campaigns', [NotificationCampaignController::class, 'index'])->middleware('permission:notifications.view');
    Route::get('campaigns/summary', [NotificationCampaignController::class, 'summary'])->middleware('permission:notifications.view');
    Route::post('campaigns', [NotificationCampaignController::class, 'store'])->middleware('permission:notifications.send');
    Route::get('campaigns/{campaign}', [NotificationCampaignController::class, 'show'])->middleware('permission:notifications.view');
    Route::post('campaigns/{campaign}/approve', [NotificationCampaignController::class, 'approve'])->middleware('permission:notifications.manage');
    Route::post('campaigns/{campaign}/pause', [NotificationCampaignController::class, 'pause'])->middleware('permission:notifications.manage');
    Route::post('campaigns/{campaign}/resume', [NotificationCampaignController::class, 'resume'])->middleware('permission:notifications.manage');
    Route::post('campaigns/{campaign}/cancel', [NotificationCampaignController::class, 'cancel'])->middleware('permission:notifications.manage');

    // مصفوفة (event × channel) — الكتالوج SoT؛ هنا يُحرَّر السلوك فقط
    Route::get('matrix', [EventMatrixController::class, 'index'])->middleware('permission:notifications.view');
    Route::put('matrix/channels/{eventChannel}', [EventMatrixController::class, 'updateChannel'])->middleware('permission:notifications.manage');
    Route::put('matrix/events/{event}/toggle', [EventMatrixController::class, 'toggleEvent'])->middleware('permission:notifications.manage');

    // القوالب (تعديلها لا يؤثّر على الحملات القائمة — immutable snapshot)
    Route::get('templates', [NotificationTemplateController::class, 'index'])->middleware('permission:notifications.view');
    Route::get('templates/variables', [NotificationTemplateController::class, 'variables'])->middleware('permission:notifications.view');
    Route::post('templates', [NotificationTemplateController::class, 'store'])->middleware('permission:notifications.manage');
    Route::get('templates/{template}', [NotificationTemplateController::class, 'show'])->middleware('permission:notifications.view');
    Route::put('templates/{template}', [NotificationTemplateController::class, 'update'])->middleware('permission:notifications.manage');
    Route::delete('templates/{template}', [NotificationTemplateController::class, 'destroy'])->middleware('permission:notifications.manage');

    // الجماهير (أنواع كوديّة + معاينة عدد حيّة)
    Route::get('audiences', [NotificationAudienceController::class, 'index'])->middleware('permission:notifications.view');
    Route::get('audiences/preview', [NotificationAudienceController::class, 'preview'])->middleware('permission:notifications.view');

    // صحّة القنوات
    Route::get('health', [NotificationHealthController::class, 'index'])->middleware('permission:notifications.view');
    Route::post('health/probe', [NotificationHealthController::class, 'probe'])->middleware(['permission:notifications.manage', 'throttle:10,1']);

    // إعدادات (Kill Switch + Quiet Hours) — استثناء مُحكَم بموافقة (تشغيليّ، NotificationSettings قائمة)
    Route::get('settings', [NotificationSettingsController::class, 'show'])->middleware('permission:notifications.view');
    Route::put('settings', [NotificationSettingsController::class, 'update'])->middleware('permission:notifications.manage');
});
