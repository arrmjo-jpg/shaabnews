<?php

declare(strict_types=1);

namespace App\Providers;

use App\Contracts\Ai\AiProvider;
use App\Contracts\Broadcast\BroadcastPushDriver;
use App\Enums\ClientSource;
use App\Events\Content\ArticleStatusChanged;
use App\Events\Content\ReelStatusChanged;
use App\Events\Content\VideoStatusChanged;
use App\Health\Checks\ArticleSearchHealthCheck;
use App\Health\Checks\BroadcastPushHealthCheck;
use App\Health\Checks\BroadcastSearchHealthCheck;
use App\Health\Checks\BroadcastSourceHealthCheck;
use App\Health\Checks\CacheTaggingCheck;
use App\Health\Checks\EpaperOcrHealthCheck;
use App\Health\Checks\EpaperSearchHealthCheck;
use App\Health\Checks\MediaProcessingHealthCheck;
use App\Health\Checks\RedisProductionCheck;
use App\Health\Checks\ReelSearchHealthCheck;
use App\Health\Checks\RemoteStorageHealthCheck;
use App\Health\Checks\SchedulerHealthCheck;
use App\Health\Checks\VideoSearchHealthCheck;
use App\Modules\Notifications\Events\NotificationEvent;
use App\Modules\Notifications\Listeners\RouteNotificationEvent;
use App\Settings\GeneralSettings;
use App\Settings\ThirdPartySettings;
use App\Support\Advertising\AdClientIp;
use App\Support\Ai\Providers\FailoverAiProvider;
use App\Support\Ai\Providers\GeminiProvider;
use App\Support\Ai\Providers\OpenAiProvider;
use App\Support\Broadcast\Push\LogBroadcastPushDriver;
use App\Support\Content\Listeners\InvalidateArticleCacheOnStatusChanged;
use App\Support\Content\Listeners\InvalidateReelCacheOnStatusChanged;
use App\Support\Content\Listeners\InvalidateVideoCacheOnStatusChanged;
use App\Support\Content\Listeners\NotifyWriterOnArticleStatusChanged;
use App\Support\Content\Listeners\NotifyWriterOnReelStatusChanged;
use App\Support\Content\Listeners\NotifyWriterOnVideoStatusChanged;
use App\Support\Content\Listeners\PurgeArticleCdnOnStatusChanged;
use App\Support\Content\Listeners\PurgeReelCdnOnStatusChanged;
use App\Support\Content\Listeners\RevalidateVideoFrontendOnStatusChanged;
use App\Support\Epaper\DefaultEpaperAccessPolicy;
use App\Support\Epaper\EpaperAccessPolicy;
use App\Support\Epaper\Ocr\DefaultEpaperOcrProvider;
use App\Support\Epaper\Ocr\EpaperOcrProvider;
use App\Support\Media\RemoteStorage;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use RuntimeException;
use Spatie\Health\Checks\Checks\CacheCheck;
use Spatie\Health\Checks\Checks\DatabaseCheck;
use Spatie\Health\Checks\Checks\QueueCheck;
use Spatie\Health\Checks\Checks\RedisCheck;
use Spatie\Health\Checks\Checks\ScheduleCheck;
use Spatie\Health\Checks\Checks\UsedDiskSpaceCheck;
use Spatie\Health\Facades\Health;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // مزوّد الذكاء الاصطناعي مع تجاوز الفشل (failover): المزوّد المُختار في
        // اللوحة (ThirdPartySettings) أساسيّ، والآخر احتياطيّ. لا قفل على مزوّد،
        // ولا قراءة من .env. يُحلّ عند الطلب (بعد الترحيل).
        $this->app->bind(AiProvider::class, function (): AiProvider {
            $gemini = new GeminiProvider;
            $openai = new OpenAiProvider;

            $ordered = app(ThirdPartySettings::class)->ai_provider === 'gemini'
                ? [$gemini, $openai]
                : [$openai, $gemini];

            return new FailoverAiProvider($ordered);
        });

        // عقد الوصول للعدد — سياسة افتراضية محافظة (لا محرّك اشتراكات). يعيد المضيف
        // ربطه في مزوّده لدمج منطق الاشتراك/الاستحقاق الفعليّ.
        $this->app->bind(EpaperAccessPolicy::class, DefaultEpaperAccessPolicy::class);

        // مزوّد OCR للعدد — المركّب الافتراضيّ: يفضّل النصّ المضمَّن (بلا تكلفة)،
        // ويصعّد إلى Google Document AI إن فُعِّل. المضيف حرّ بإعادة ربطه.
        $this->app->bind(EpaperOcrProvider::class, DefaultEpaperOcrProvider::class);

        // ناقل دفع البثّ — نقطة التبديل الوحيدة لتفعيل FCM لاحقاً (إعداد فقط،
        // بلا تعديل كود): broadcast.notifications.push_driver. اسم غير معروف
        // يفشل هنا فوراً وبصوتٍ عالٍ بدل الرجوع الصامت لناقل السجلّ.
        $this->app->bind(BroadcastPushDriver::class, function (): BroadcastPushDriver {
            $driver = (string) config('broadcast.notifications.push_driver', 'log');

            return match ($driver) {
                'log' => new LogBroadcastPushDriver,
                default => throw new RuntimeException("Unknown broadcast push driver: '{$driver}'."),
            };
        });
    }

    public function boot(): void
    {
        $this->configurePasswordPolicy();
        $this->configureRateLimiters();
        $this->configurePasswordReset();
        $this->configureMailFromSettings();
        // قرص المرآة البعيد يُبنى من الإعدادات (لا env للتشغيل). المنطق مركزيّ في
        // RemoteStorage::configureDisk() ويُعاد استدعاؤه داخل وظائف المرآة/السحب
        // كي يلتقط الـ worker الطويل العمر أي تغيير من اللوحة بلا إعادة تشغيل.
        RemoteStorage::configureDisk();
        $this->configureHealthChecks();
        $this->configureNotificationRouting();
        $this->configureContentEvents();
        $this->configureSlowQueryLog();
    }

    /**
     * يربط حدث الإشعارات الوحيد (NotificationEvent) بالعقل المركزيّ عبر مستمع واحد — كلّ
     * المصادر تمرّ عبر NotificationManager، فلا مسار إرسال ثانٍ داخل النظام (Event-First).
     */
    private function configureNotificationRouting(): void
    {
        Event::listen(NotificationEvent::class, RouteNotificationEvent::class);
    }

    /**
     * يسجّل SQL queries التي تتجاوز الحد الأدنى (بالمللي ثانية) في قناة perf.
     *
     * مُعطَّل افتراضياً (PERF_SLOW_QUERY_MS=0) — صفر overhead في الإنتاج العادي.
     * فعّله وقت التحقيق فقط: PERF_SLOW_QUERY_MS=200
     *
     * كل سطر في perf.log سيحتوي: sql, time_ms, bindings, request_id, url, pid
     * مما يعطيك الدليل القاطع على أي SQL هو الذي أكل الوقت.
     */
    private function configureSlowQueryLog(): void
    {
        $threshold = (int) env('PERF_SLOW_QUERY_MS', 0);

        if ($threshold <= 0) {
            return;
        }

        DB::listen(function (QueryExecuted $query) use ($threshold): void {
            if ($query->time < $threshold) {
                return;
            }

            Log::channel('perf')->warning('SlowQuery detected', [
                'sql' => $query->sql,
                'time_ms' => $query->time,
                'bindings' => array_map(fn ($b) => is_string($b) ? mb_strimwidth($b, 0, 80) : $b, $query->bindings),
                'connection' => $query->connectionName,
                'request_id' => request()->header('X-Request-ID', 'n/a'),
                'url' => request()->fullUrl(),
                'pid' => getmypid(),
            ]);
        });
    }

    /**
     * مستمعو ArticleStatusChanged (ADR-E2) — متزامنون عمداً وبنفس ترتيب
     * النداءات الأمريّة السابقة (كاش ثم CDN ثم إشعار) كي يبقى السلوك مطابقاً
     * حرفياً لِما قبل التغليف.
     */
    private function configureContentEvents(): void
    {
        Event::listen(ArticleStatusChanged::class, InvalidateArticleCacheOnStatusChanged::class);
        Event::listen(ArticleStatusChanged::class, PurgeArticleCdnOnStatusChanged::class);
        Event::listen(ArticleStatusChanged::class, NotifyWriterOnArticleStatusChanged::class);

        Event::listen(VideoStatusChanged::class, InvalidateVideoCacheOnStatusChanged::class);
        Event::listen(VideoStatusChanged::class, RevalidateVideoFrontendOnStatusChanged::class);
        Event::listen(VideoStatusChanged::class, NotifyWriterOnVideoStatusChanged::class);

        Event::listen(ReelStatusChanged::class, InvalidateReelCacheOnStatusChanged::class);
        Event::listen(ReelStatusChanged::class, PurgeReelCdnOnStatusChanged::class);
        Event::listen(ReelStatusChanged::class, NotifyWriterOnReelStatusChanged::class);
    }

    /**
     * سياسة كلمة المرور الموحّدة للتطبيق (Password::defaults) — تحكم التدفّقات
     * الإدارية الحسّاسة (إنشاء/تعديل مستخدم، تغيير كلمة المرور الذاتية، إعادة
     * تعيين كلمة مرور الإداري). الحدّ الأدنى 12 محرفاً + أحرف كبيرة/صغيرة +
     * أرقام + رموز. فحص التسريب (uncompromised عبر HIBP) يُفعَّل في الإنتاج فقط
     * (يتطلّب شبكة؛ يُتجنّب في الاختبار/التطوير دون المساس بباقي القواعد).
     *
     * ملاحظة: تدفّقات المستخدم العام (تسجيل/إعادة تعيين عام) تستخدم min:8 صراحةً
     * في طلباتها، فلا تتأثّر بهذا التشديد (نطاق هذا السبرنت إداري فقط).
     */
    private function configurePasswordPolicy(): void
    {
        Password::defaults(function (): Password {
            $rule = Password::min(12)
                ->mixedCase()
                ->numbers()
                ->symbols();

            return $this->app->isProduction() ? $rule->uncompromised() : $rule;
        });
    }

    /**
     * فحوصات الصحّة الأساسية (DB / كاش / مساحة قرص). تُشغَّل عبر
     * health:check المجدول، وتُقرأ نتائجها من مسار محمي.
     */
    private function configureHealthChecks(): void
    {
        $checks = [
            DatabaseCheck::new(),
            CacheCheck::new(),
            CacheTaggingCheck::new(), // حارس إنتاج: كاش المحتوى يتطلّب وسوماً (redis)
            RedisProductionCheck::new(), // حارس إنتاج: الطابور+الكاش على redis (إنتاج فقط)
            UsedDiskSpaceCheck::new()
                ->warnWhenUsedSpaceIsAbovePercentage(80)
                ->failWhenUsedSpaceIsAbovePercentage(90),
            // مراقبة الوسائط والمُجدوِل (Phase 5)
            MediaProcessingHealthCheck::new(),
            SchedulerHealthCheck::new(),
            // صحّة المرآة البعيدة (fail-safe — تحذير لا فشل حرج)
            RemoteStorageHealthCheck::new(),
            // صحّة مصادر البثّ (B3) — يُبرز البثّ ذا المصدر الفاشل للمشغّل
            BroadcastSourceHealthCheck::new(),
            // حالة دفع إشعارات البثّ (مُعطَّل/مُقلَّد/حقيقيّ) — Task B، مراجعة الإنتاج
            BroadcastPushHealthCheck::new(),
            // الجريدة (Enterprise): صحّة فهرس البحث + تراكم/تعليق استخراج OCR
            EpaperSearchHealthCheck::new(),
            EpaperOcrHealthCheck::new(),
            // صحّة فهارس Meilisearch القياسيّة (انحراف العدّ فهرس/قاعدة) — Task 14 finding
            ArticleSearchHealthCheck::new(),
            VideoSearchHealthCheck::new(),
            ReelSearchHealthCheck::new(),
            BroadcastSearchHealthCheck::new(),
            // نبض المُجدوِل (يكشف توقّفه كلياً) — يتطلّب health:schedule-check-heartbeat
            ScheduleCheck::new()->heartbeatMaxAgeInMinutes(5),
            // نبض عمّال الطوابير — heartbeat مستقلّ عن السائق (database/redis): يكشف موت العامل
            // بصمت (إصلاح كاش حدثيّ: كانت Events تنام بلا إنذار). يتطلّب health:queue-check-heartbeat.
            QueueCheck::new()->onQueue(['default', 'media', 'cdn-purge', 'search']),
        ];

        // فحص خاصّ بـ Redis (الإنتاج) — صحّة اتصال Redis نفسه.
        if (config('queue.default') === 'redis' || config('cache.default') === 'redis') {
            $checks[] = RedisCheck::new();
        }

        Health::checks($checks);
    }

    /**
     * يربط إعدادات البريد المخزَّنة في لوحة الإدارة بناقل البريد الفعلي
     * عالمياً، فتستخدمها كل الرسائل (إعادة التعيين، الإشعارات…).
     * يُتجاوَز بأمان إن لم تُضبط الإعدادات بعد أو تعذّر قراءتها.
     */
    private function configureMailFromSettings(): void
    {
        try {
            $s = app(GeneralSettings::class);

            if ($s->mail_host === '') {
                return; // غير مُهيّأ — أبقِ ناقل .env الافتراضي
            }

            $encryption = in_array($s->mail_encryption, ['', 'null'], true)
                ? null
                : $s->mail_encryption;

            Config::set('mail.mailers.settings_smtp', [
                'transport' => 'smtp',
                'host' => $s->mail_host,
                'port' => $s->mail_port,
                'encryption' => $encryption,
                'username' => $s->mail_username,
                'password' => $s->mail_password,
                'timeout' => 10,
            ]);
            Config::set('mail.default', 'settings_smtp');

            $from = $s->mail_from_email !== '' ? $s->mail_from_email : $s->site_email;
            if ($from !== '') {
                Config::set('mail.from', [
                    'address' => $from,
                    'name' => $s->mail_from_name !== '' ? $s->mail_from_name : config('app.name'),
                ]);
            }
        } catch (Throwable) {
            // إعدادات غير متاحة (قبل الترحيل مثلاً) — تجاهل بأمان
        }
    }

    /**
     * رابط إعادة التعيين يوجّه إلى الواجهة المناسبة (SPA) — لا مسار web.
     * الإداريون → لوحة الإدارة، المستخدمون → الواجهة العامة.
     */
    private function configurePasswordReset(): void
    {
        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            $base = $notifiable->isAdmin()
                ? config('frontend.admin_url')
                : config('frontend.public_url');

            $email = urlencode($notifiable->getEmailForPasswordReset());

            return rtrim((string) $base, '/')."/reset-password?token={$token}&email={$email}";
        });

        // محتوى بريد إعادة التعيين بالعربية بالكامل
        ResetPassword::toMailUsing(function (object $notifiable, string $token): MailMessage {
            $base = $notifiable->isAdmin()
                ? config('frontend.admin_url')
                : config('frontend.public_url');
            $email = urlencode($notifiable->getEmailForPasswordReset());
            $url = rtrim((string) $base, '/')."/reset-password?token={$token}&email={$email}";

            $expire = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);

            $app = config('app.name');
            try {
                $siteName = app(GeneralSettings::class)->site_name;
                if ($siteName !== '') {
                    $app = $siteName;
                }
            } catch (Throwable) {
                // إعدادات غير متاحة — أبقِ اسم التطبيق الافتراضي
            }

            $ctx = app()->bound('auth.reset_origin')
                ? app('auth.reset_origin')
                : ['source' => ClientSource::key(ClientSource::fromRequest()), 'ip' => (string) request()->ip()];

            $origin = __('auth.reset_email.origin', [
                'source' => ClientSource::labelForKey($ctx['source'] ?? null),
                'ip' => (string) ($ctx['ip'] ?? ''),
            ]);

            return (new MailMessage)
                ->subject(__('auth.reset_email.subject'))
                ->greeting(__('auth.reset_email.greeting'))
                ->line(__('auth.reset_email.line1'))
                ->action(__('auth.reset_email.action'), $url)
                ->line(__('auth.reset_email.expire', ['count' => $expire]))
                ->line($origin)
                ->line(__('auth.reset_email.line2'))
                ->salutation(__('auth.reset_email.salutation', ['app' => $app]));
        });
    }

    private function configureRateLimiters(): void
    {
        // ─── Public Auth ──────────────────────────────────────────────────

        // تسجيل الدخول العام: 10 محاولات/دقيقة لكل IP
        RateLimiter::for('public.login', function (Request $request): Limit {
            return Limit::perMinute(10)->by($request->ip());
        });

        // التسجيل: 5 محاولات/دقيقة لكل IP
        RateLimiter::for('public.register', function (Request $request): Limit {
            return Limit::perMinute(5)->by($request->ip());
        });

        // نسيت كلمة المرور: 5 محاولات/15 دقيقة لكل IP
        RateLimiter::for('public.forgot-password', function (Request $request): Limit {
            return Limit::perMinutes(15, 5)->by($request->ip());
        });

        // ─── Admin Auth — أكثر تشدداً ────────────────────────────────────

        // تسجيل دخول الإدارة: 5 محاولات/دقيقة لكل IP
        RateLimiter::for('admin.login', function (Request $request): Limit {
            return Limit::perMinute(5)->by($request->ip());
        });

        // نسيت كلمة المرور للإدارة: 3 محاولات/15 دقيقة لكل IP
        RateLimiter::for('admin.forgot-password', function (Request $request): Limit {
            return Limit::perMinutes(15, 3)->by($request->ip());
        });

        // ─── AI Copilot — حماية من الإساءة + التكلفة ─────────────────────
        // حدّ لكل مستخدم/دقيقة (قابل للضبط عبر AI_RATE_LIMIT).
        RateLimiter::for('ai', function (Request $request): Limit {
            $max = (int) config('ai.rate_limit', 20);

            return Limit::perMinute($max)->by(
                (string) ($request->user()?->id ?? $request->ip())
            );
        });

        // ─── Engagement — مقاومة إساءة كتابة التفاعل العام ────────────────
        // حدّ لكل فاعل/دقيقة (مستخدم أو IP + بصمة العميل).
        RateLimiter::for('engagement', function (Request $request): Limit {
            $actor = $request->user()?->id
                ?? $request->header('X-Client-Id')
                ?? $request->ip();

            return Limit::perMinute(60)->by('eng:'.$actor);
        });

        // ─── منارة المشاهدة — حارس إساءة على نبضات الاحتساب ──────────────
        // أعلى من حدّ react (المشاهدات أكثر تواتراً مع تصفّح الصفحات). المفتاح:
        // العميل (X-Client-Id) إن وُجد وإلا IP.
        RateLimiter::for('engagement.view', function (Request $request): Limit {
            $max = (int) config('performance.view_beacon.rate_limit', 120);
            $actor = $request->user()?->id
                ?? $request->header('X-Client-Id')
                ?? $request->ip();

            return Limit::perMinute($max)->by('engview:'.$actor);
        });

        // ─── Public reads — حارس إساءة/DoS على القراءة العامة ─────────────
        // يحمي قوائم/تفاصيل/خرائط الموقع وإعادة التوجيه من الكشط والاستعلامات
        // المُولّدة (filter[q]) التي تُفجّر مفاتيح الكاش. سخيّ (CDN يمتصّ المعظم)؛
        // المفتاح: العميل (X-Client-Id) إن وُجد وإلا IP — متسق مع حدّ engagement.
        RateLimiter::for('public.read', function (Request $request): Limit {
            // مُتجاوز موثوق: نداءات SSR من Next (خادم-لخادم) تحمل توكناً داخليّاً ⇒ خارج حارس الإساءة العام.
            // لولاه لتشاركت كلّ قراءات أصل Next (IP واحد، بلا X-Client-Id) دلواً واحداً (120/د) ⇒ 429 تحت الحِمل.
            $internal = (string) config('services.internal_api.token', '');
            if ($internal !== '' && hash_equals($internal, (string) $request->header('X-Internal-Token'))) {
                return Limit::none();
            }

            $max = (int) config('performance.public_read_rate_limit', 120);
            $actor = $request->header('X-Client-Id') ?: $request->ip();

            return Limit::perMinute($max)->by('pubread:'.$actor);
        });

        // ─── Epaper archive search — حارس أضيق (استعلام محرّك أثقل من قراءةٍ عاديّة) ─
        // يُكدَّس فوق public.read على مسار بحث الأرشيف فقط؛ المفتاح: العميل ثم IP.
        RateLimiter::for('epaper.search', function (Request $request): Limit {
            $max = (int) config('epaper.search.rate_limit', 30);
            $actor = $request->header('X-Client-Id') ?: $request->ip();

            return Limit::perMinute($max)->by('epsearch:'.$actor);
        });

        // ─── Presence (B5) — حارس تضخيم/إساءة على الحضور ──────────────────
        // join يُصدِر رمز هوية (تقييده يحدّ مزارع الرموز)؛ heartbeat أكثر تواتراً.
        // المفتاح: المستخدم ثم بصمة العميل ثم IP — متسق مع حدود التفاعل.
        RateLimiter::for('presence.join', function (Request $request): Limit {
            $actor = $request->user()?->id ?? $request->header('X-Client-Id') ?? $request->ip();

            return Limit::perMinute((int) config('broadcast.presence.join_rate_limit', 20))->by('bpjoin:'.$actor);
        });

        RateLimiter::for('presence.heartbeat', function (Request $request): Limit {
            $actor = $request->user()?->id ?? $request->header('X-Client-Id') ?? $request->ip();

            return Limit::perMinute((int) config('broadcast.presence.heartbeat_rate_limit', 20))->by('bphb:'.$actor);
        });

        // ─── الإعلانات (Batch 5) — حراس إساءة على سطح الخدمة العام ──────────
        // serve مُكاش على الحافة (الأصل قليل الإصابة) ⇒ حدّ سخيّ. التتبّع/النقرة غير
        // مُخزَّنين (no-store) فيضربان الأصل دائماً ⇒ حدّ من إعداد التتبّع.
        // طبقتان (V1): حدّ لكل عميل (X-Client-Id) + سقف صارم لكل IP يكمّله ضدّ تدوير
        // الترويسة. سقف الـ IP مُعطَّل (0) افتراضياً ويُفعَّل فقط بعد ضبط TRUSTED_PROXIES.
        RateLimiter::for('ads.serve', function (Request $request): array {
            $actor = $request->header('X-Client-Id') ?: $request->ip();

            return $this->withAdIpCeiling(
                Limit::perMinute((int) config('advertising.serve.rate_limit', 300))->by('adserve:'.$actor),
                'adserve:ip:',
                (int) config('advertising.serve.per_ip_rate_limit', 0),
                $request,
            );
        });

        RateLimiter::for('ads.track', function (Request $request): array {
            $actor = $request->user()?->id ?? $request->header('X-Client-Id') ?? $request->ip();

            return $this->withAdIpCeiling(
                Limit::perMinute((int) config('advertising.tracking.rate_limit.max', 60))->by('adtrack:'.$actor),
                'adtrack:ip:',
                (int) config('advertising.tracking.per_ip_rate_limit', 0),
                $request,
            );
        });

        RateLimiter::for('ads.click', function (Request $request): array {
            $actor = $request->user()?->id ?? $request->header('X-Client-Id') ?? $request->ip();

            return $this->withAdIpCeiling(
                Limit::perMinute((int) config('advertising.tracking.rate_limit.max', 60))->by('adclick:'.$actor),
                'adclick:ip:',
                (int) config('advertising.tracking.per_ip_rate_limit', 0),
                $request,
            );
        });

        // ─── الاستطلاعات (التصويت العام — Phase 2) ───────────────────────
        // حدّ لكل فاعل (مستخدم/X-Client-Id/IP) + سقف صارم اختياريّ لكل IP (مُعطَّل = 0
        // افتراضاً؛ يتطلّب TrustProxies). يُطبَّع الـ IP عبر AdClientIp (/64).
        RateLimiter::for('poll.vote', function (Request $request): array {
            $actor = $request->user()?->id ?? $request->header('X-Client-Id') ?? $request->ip();
            $limits = [Limit::perMinute((int) config('polls.vote.rate_limit', 30))->by('pollvote:'.$actor)];

            $perIp = (int) config('polls.vote.per_ip_rate_limit', 0);
            if ($perIp > 0) {
                $limits[] = Limit::perMinute($perIp)->by('pollvote:ip:'.AdClientIp::key($request));
            }

            return $limits;
        });

        // طلب الترقية لكاتب (P1.4 Hardening) — فعل نادر؛ 5/دقيقة لكل مستخدم يكبح الإساءة.
        RateLimiter::for('writer-requests.submit', function (Request $request): Limit {
            return Limit::perMinute(5)->by('writerrequest:'.($request->user()?->id ?? $request->ip()));
        });

        // التعليقات العامة — حارس إساءة/سبام: حدّ لكل فاعل (مستخدم/عميل/IP) دقيقياً.
        RateLimiter::for('comments.submit', function (Request $request): Limit {
            $actor = $request->user()?->id ?? $request->header('X-Client-Id') ?? $request->ip();

            return Limit::perMinute((int) config('comments.submit.rate_limit', 5))->by('comment:'.$actor);
        });

        // استماع للمقال (Gemini TTS) — حارس كلفة: نداء مدفوع لكلّ تشغيل. حدّ لكلّ عميل/دقيقة.
        RateLimiter::for('public.tts', function (Request $request): Limit {
            $actor = $request->header('X-Client-Id') ?: $request->ip();

            return Limit::perMinute((int) config('tts.rate_limit', 10))->by('tts:'.$actor);
        });

        // اتصل بنا (عام) — قرار المراجعة الحرج: حدّ لكل عميل (X-Client-Id) + سقف صارم
        // اختياريّ لكل IP (مقاوم لتدوير الترويسة؛ مُعطَّل=0 حتى ضبط TrustProxies). يُعيد
        // استخدام withAdIpCeiling الموجود (نمط الإعلانات ثنائيّ الطبقة) — لا منطق جديد.
        RateLimiter::for('public.contact', function (Request $request): array {
            $actor = $request->header('X-Client-Id') ?: $request->ip();

            return $this->withAdIpCeiling(
                Limit::perMinute((int) config('contact.submit.rate_limit', 5))->by('contact:'.$actor),
                'contact:ip:',
                (int) config('contact.submit.per_ip_rate_limit', 0),
                $request,
            );
        });

        // اشتراك واتساب (عام) — نفس النمط الثنائيّ الطبقة (client X-Client-Id + سقف IP اختياريّ).
        RateLimiter::for('public.whatsapp-subscribe', function (Request $request): array {
            $actor = $request->header('X-Client-Id') ?: $request->ip();

            return $this->withAdIpCeiling(
                Limit::perMinute((int) config('whatsapp.subscribe.rate_limit', 5))->by('wasub:'.$actor),
                'wasub:ip:',
                (int) config('whatsapp.subscribe.per_ip_rate_limit', 0),
                $request,
            );
        });

        // طلب إعلان (عام) — نفس النمط الثنائيّ الطبقة (client + سقف IP اختياريّ).
        RateLimiter::for('public.ad-request', function (Request $request): array {
            $actor = $request->header('X-Client-Id') ?: $request->ip();

            return $this->withAdIpCeiling(
                Limit::perMinute((int) config('ad_request.submit.rate_limit', 5))->by('adreq:'.$actor),
                'adreq:ip:',
                (int) config('ad_request.submit.per_ip_rate_limit', 0),
                $request,
            );
        });
    }

    /**
     * يضيف سقفاً صارماً لكل IP فوق حدّ العميل لحدود الإعلانات (V1). السقف ≤ 0 ⇒ مُعطَّل
     * (لا تُضاف طبقة الـ IP) — الحالة الافتراضية الآمنة قبل ضبط TrustProxies.
     *
     * @return array<int,Limit>
     */
    private function withAdIpCeiling(Limit $perClient, string $ipKeyPrefix, int $perIpMax, Request $request): array
    {
        if ($perIpMax <= 0) {
            return [$perClient];
        }

        return [
            $perClient,
            Limit::perMinute($perIpMax)->by($ipKeyPrefix.AdClientIp::key($request)),
        ];
    }
}
