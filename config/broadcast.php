<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Broadcast — operational config (non-secret)
|--------------------------------------------------------------------------
| بثّ خارجي موثوق فقط. لكل نوع مصدر قائمة مضيفات موثوقة (allow-list صارمة) إضافةً
| إلى حارس SafeUrl (HTTPS عام، لا مضيفات خاصّة/مُبهَمة). تُطابَق بالمضيف نفسه أو
| كنطاق فرعي (suffix). قائمة فارغة ⇒ يُرفَض كل رابط لذلك النوع (افتراضي آمن).
|
| مضيفات يوتيوب لايف معروفة ومُضمَّنة افتراضياً؛ بقية الأنواع يضبطها المشغّل بيئياً
| (مفصولة بفواصل) كي لا يُقبل أي رابط حتى يُصرّح بمضيفاته الموثوقة.
*/

$list = static fn (string $env): array => array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env($env, ''))
)));

return [
    'allowed_hosts' => [
        'youtube_live' => ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
        'hls' => $list('BROADCAST_HLS_ALLOWED_HOSTS'),
        'iptv' => $list('BROADCAST_IPTV_ALLOWED_HOSTS'),
        'external_provider' => $list('BROADCAST_PROVIDER_ALLOWED_HOSTS'),
        'icecast' => $list('BROADCAST_RADIO_ALLOWED_HOSTS'),
        'shoutcast' => $list('BROADCAST_RADIO_ALLOWED_HOSTS'),
    ],

    /*
    | مراقبة صحّة المصدر (B3). فحص آمن-ضدّ-SSRF بمهلة صارمة، بلا متابعة إعادة توجيه،
    | بقراءة محدودة. التواتر متدرّج حسب النوع. قاطع دائرة (circuit breaker) بعدد
    | إخفاقات متتالية قبل وسم failed (مقاومة الارتعاش flapping).
    */
    'health' => [
        'timeout' => (int) env('BROADCAST_HEALTH_TIMEOUT', 5),
        'connect_timeout' => (int) env('BROADCAST_HEALTH_CONNECT_TIMEOUT', 3),
        'fail_threshold' => max(1, (int) env('BROADCAST_HEALTH_FAIL_THRESHOLD', 3)),
        // إعادة-ربط DNS: يُحلّ المضيف ويُرفَض إن أشار لعنوان خاص (مُعطَّل في الاختبارات).
        'verify_resolved_ip' => (bool) env('BROADCAST_HEALTH_VERIFY_IP', true),
        'history_retention_days' => max(1, (int) env('BROADCAST_HEALTH_RETENTION_DAYS', 30)),
        // ثوانٍ بين الفحوصات حسب النوع — live أسرع (أحداث/عاجل)، tv/radio أبطأ (مستقرّ).
        'cadence' => [
            'live' => (int) env('BROADCAST_HEALTH_CADENCE_LIVE', 60),
            'tv' => (int) env('BROADCAST_HEALTH_CADENCE_TV', 300),
            'radio' => (int) env('BROADCAST_HEALTH_CADENCE_RADIO', 300),
        ],
    ],

    /*
    | محرّك الحضور (B5). نموذج HTTP heartbeat فقط (لا WebSockets عامة). التخزين في
    | الكاش (Redis إنتاجاً) فقط — لا كتابة قاعدة بيانات لكل نبضة. العدّ تقريبيّ بحبيبة
    | النبضة. الرمز موقّع (HMAC) ومربوط بالبثّ والعضو. حدود معدّل ضدّ التضخيم/الإساءة.
    */
    'presence' => [
        // نبضة العميل (ثوانٍ) — ضمن 30–45، وهي أيضاً حجم دلو الاحتساب التقريبي.
        'heartbeat_interval' => max(15, (int) env('BROADCAST_PRESENCE_HEARTBEAT', 40)),
        // عمر لقطة الحالة + كاش الحافة (CDN) لقراءة العدّ/الحالة — قصير لطزاجة معقولة.
        'count_cache_ttl' => max(1, (int) env('BROADCAST_PRESENCE_COUNT_TTL', 15)),
        // عمر رمز الجلسة الموقّع (ثوانٍ) — يُعاد طلبه عند الانتهاء (إعادة اتصال آمنة).
        'token_ttl' => max(60, (int) env('BROADCAST_PRESENCE_TOKEN_TTL', 1800)),
        // عمر الطرد المؤقّت (ثوانٍ) قبل السماح بالعودة.
        'kick_ttl' => max(30, (int) env('BROADCAST_PRESENCE_KICK_TTL', 300)),
        // الحظر المؤقّت (B6): المدّة الافتراضية والسقف (دقائق) — TTL هو الانتهاء التلقائي.
        'default_ban_minutes' => max(1, (int) env('BROADCAST_PRESENCE_DEFAULT_BAN_MIN', 60)),
        'max_ban_minutes' => max(1, (int) env('BROADCAST_PRESENCE_MAX_BAN_MIN', 10080)), // 7 أيام
        // حدود معدّل لكل فاعل/دقيقة — الانضمام (إصدار رمز) والنبضة.
        'join_rate_limit' => max(1, (int) env('BROADCAST_PRESENCE_JOIN_RATE', 20)),
        'heartbeat_rate_limit' => max(1, (int) env('BROADCAST_PRESENCE_HEARTBEAT_RATE', 20)),
    ],

    /*
    | إشعارات البثّ (B8). التسليم بنموذج المواضيع (FCM topics): الخادم ينشر رسالة واحدة
    | لموضوع فيتولّى المزوّد توزيعها على المشتركين — لا حلقة على آلاف المستخدمين. التذكير
    | يُرسَل قبل البدء المجدوَل بمدّة محدّدة. النقل الفعلي (FCM) خلف بوّابة قابلة للاستبدال
    | (Firebase Messaging غير مُهيّأ بعد — فقط تخزين Firebase). الأهليّة/منع التكرار/
    | الجدولة كلها حقيقية ومُختبَرة.
    */
    'notifications' => [
        'enabled' => (bool) env('BROADCAST_NOTIFICATIONS_ENABLED', true),
        // الناقل الفعليّ (BroadcastPushDriver المُربَط في AppServiceProvider) — "log" هو
        // المُقلِّد الوحيد المُنفَّذ اليوم. تفعيل FCM لاحقاً = كتابة ناقل جديد يطبّق العقد
        // وضبط هذه القيمة على "fcm"، بلا تعديل BroadcastPushGateway أو أيّ مستدعٍ.
        'push_driver' => (string) env('BROADCAST_PUSH_DRIVER', 'log'),
        // دقائق قبل البدء المجدوَل لإرسال التذكير.
        'reminder_lead_minutes' => max(1, (int) env('BROADCAST_REMINDER_LEAD_MIN', 30)),
        // مواضيع التسليم (FCM topics) — موضوع عام + قالب لكل حدث.
        'topics' => [
            'live' => (string) env('BROADCAST_TOPIC_LIVE', 'broadcasts-live'),
            'event_prefix' => (string) env('BROADCAST_TOPIC_EVENT_PREFIX', 'broadcast.'),
        ],
    ],

    /*
    | تحليلات البثّ (تيليمتري إلى-الأمام فقط). عيّنات الحضور المتزامن (everyMinute) في
    | نافذة متدحرجة لحدّ النمو على القنوات الدائمة (tv/radio). ذروة كلّ الأزمنة محفوظة
    | على عمود broadcasts.peak_viewer_count (تتجاوز هذه النافذة المتدحرجة).
    */
    'analytics' => [
        'sample_retention_days' => max(1, (int) env('BROADCAST_ANALYTICS_SAMPLE_RETENTION_DAYS', 30)),
    ],
];
