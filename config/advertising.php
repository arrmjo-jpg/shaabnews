<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Advertising Subsystem
|--------------------------------------------------------------------------
| إعدادات نظام الإعلانات: الخدمة (الاختيار في الخادم) + التتبّع غير المتزامن.
| القيم قابلة للضبط بيئياً؛ مدد الكاش الدلالية تبقى عبر CacheTtl في الكود.
*/

return [

    // ─── الخدمة (server-side selection) ──────────────────────────────
    'serve' => [
        // أقصى عدد مرشّحين مُكاشين لكل مساحة (يحمي حجم الكاش على المساحات الكبيرة).
        'max_candidates_per_zone' => (int) env('ADS_MAX_CANDIDATES', 500),

        // الاستراتيجية الافتراضية حين لا تحدّد المساحة واحدة: weighted|round_robin|even.
        'default_selector' => (string) env('ADS_DEFAULT_SELECTOR', 'weighted'),

        // مدّة كاش بِركة المرشّحين بالثواني (طبقة Redis — مصدر الحقيقة للخدمة).
        'pool_ttl' => (int) env('ADS_POOL_TTL', 300),

        // نافذة الدلو الزمني للتدوير الثابت بالثواني (server-side, CDN-friendly):
        // العرض يُكاش على الحافة بهذه المدّة، والاختيار حتميّ ضمن الدلو.
        'bucket_window' => (int) env('ADS_BUCKET_WINDOW', 30),

        // حدّ معدّل نقطة العرض العامة لكل عميل/دقيقة (سخيّ — الـ CDN يمتصّ المعظم،
        // وقد تحوي الصفحة عدّة مساحات). حارس إساءة على الأصل.
        'rate_limit' => (int) env('ADS_SERVE_RATE_LIMIT', 300),

        // سقف صارم لكل IP يكمّل حدّ العميل (V1) — حارس ضدّ تدوير X-Client-Id. 0 = مُعطَّل
        // (الحالة الافتراضية الآمنة). لا تُفعِّله إلا بعد ضبط TRUSTED_PROXIES وقفل الأصل
        // على الـ CDN، وإلا انهارت كلّ القراءات إلى عناوين الحافة فخُنِق الملء الشرعيّ.
        'per_ip_rate_limit' => (int) env('ADS_SERVE_PER_IP_RATE_LIMIT', 0),

        // سقف عدد المساحات في دفعة واحدة (GET /ads?page=) — حارس حجم الحمولة/الطلب.
        'max_zones_per_batch' => (int) env('ADS_MAX_ZONES_PER_BATCH', 40),
    ],

    // ─── خرائط الصفحات → المساحات (الدفعة الواحدة) ───────────────────
    // المصدر الخلفيّ الوحيد لعلاقة صفحة↔مساحات: تطلب الواجهة دفعةً واحدة بـ page= فقط (بلا معرفة
    // أسماء المساحات — فصل تامّ عن معماريّة المواضع). 'chrome' مساحات مشترَكة (هيدر/سلايدر) تُدمَج
    // مع كلّ صفحة. عند غياب page في الخريطة تُعاد chrome وحدها. (تُغلَّب بمعامل zones= الصريح للحالات
    // النادرة — صفحة بمساحة/اثنتين، req 10.)
    'pages' => [
        'chrome' => [
            'aalan_fwq_alhydr_fy_bdaya_almwqa',
            'aalan_fwq_alhydr',
            'aalan_kbyr_asfl_alhydr_mbashra',
            'aalan_fy_qsm_slaydr_kbyr_1410',
            'aalan_asfl_alhydr_mbashra_ymyn',
            'aalan_asfl_alhydr_mbashra_shmal',
        ],
        'homepage' => [
            'aalan_kbyr_asfl_alhyrw_1410',
            'aalan_asfl_alslaydr_mbarshraymyn',
            'aalan_asfl_alslaydr_mbarshra_shmal',
            'aalan_fwq_akhr_almstjdat_ymyn',
            'aalan_fwq_akhr_almstjdat_shmal',
            'aalan_fwq_qsm_alrylz_ymyn',
            'aalan_fwq_qsm_alrylz_shmal',
            'aalan_kbyr_fwq_qsm_alakthr_shywha',
        ],
        'article' => [
            'aalan_asfl_alkhbr_rym_1',
            'aalan_asfl_alkhbr_rym_2',
        ],
        'inner' => [
            'aalan_fy_alsfhat_aldakhlya_llmntjat',
        ],
    ],

    // ─── التتبّع (impressions/clicks) ────────────────────────────────
    'tracking' => [
        // تجميع Redis ثم تفريغ مجدوَل (مرآة view_buffer). عطّله ⇒ زيادة مباشرة.
        'buffer_enabled' => (bool) env('ADS_TRACKING_BUFFER', true),

        // نافذة منع تكرار احتساب الحدث لكل (مرشّح + فاعل) بالدقائق.
        'dedup_minutes' => (int) env('ADS_DEDUP_MINUTES', 30),

        // عمر رمز المنارة الموقّع (HMAC) بالثواني.
        'beacon_ttl' => (int) env('ADS_BEACON_TTL', 3600),

        // حدّ معدّل نبضات التتبّع لكل عميل (الطلبات/النافذة بالثواني).
        'rate_limit' => [
            'max' => (int) env('ADS_TRACK_RATE_MAX', 60),
            'window' => (int) env('ADS_TRACK_RATE_WINDOW', 60),
        ],

        // سقف صارم لكل IP لنبضات التتبّع/النقر يكمّل حدّ العميل (V1). 0 = مُعطَّل (آمن
        // افتراضياً). يتطلّب IP عميل صحيحاً (TrustProxies) — انظر تحذير serve.per_ip_rate_limit.
        'per_ip_rate_limit' => (int) env('ADS_TRACK_PER_IP_RATE_LIMIT', 0),

        // منع تكرار النقر مرتكزاً على IP (نقرة واحدة لكل IP/إسناد/دلو) بدل الفاعل — أقوى
        // ضدّ تدوير X-Client-Id لكنه يطوي نقرات عدّة مستخدمين خلف IP مشترك. يتطلّب IP عميل
        // صحيحاً. false = ارتكاز على الفاعل (السلوك الافتراضي الآمن).
        'strict_click_dedup' => (bool) env('ADS_STRICT_CLICK_DEDUP', false),
    ],

    // ─── الإبداعات (HTML) — حدود تنقية صارمة (HTMLPurifier) ──────────
    // إبداعات HTML طرف-أول موثوقة، لكنها تبقى ضمن قائمة بيضاء صريحة: لا
    // script/iframe/object/embed، ولا معالِجات أحداث ضمنية (on*)، ووسوم/خصائص/أنماط
    // محصورة. القيم مُثبَّتة هنا عمداً (حدّ أمان مُراجَع — لا تجاوز بيئيّ صامت).
    'creatives' => [
        'html' => [
            // الوسوم + الخصائص المسموح بها (صيغة HTMLPurifier — HTML.Allowed).
            'allowed_html' => 'a[href|title|target|rel],b,strong,i,em,u,br,'
                .'p[class|style],div[class|style],span[class|style],'
                .'ul[class],ol[class],li,h1,h2,h3,h4,h5,h6,'
                .'img[src|alt|width|height|class|style]',

            // خصائص CSS المضمّنة المسموح بها (style) — قائمة بيضاء محصورة.
            // ملاحظة: HTMLPurifier يدعم مجموعة محدّدة من خصائص CSS؛ غير المدعوم (مثل
            // display/position) يُجرَّد تلقائياً. نقتصر هنا على المدعوم فعلاً.
            'allowed_css' => [
                'color', 'background-color', 'text-align', 'font-size', 'font-weight',
                'font-style', 'line-height', 'margin', 'padding', 'width', 'height',
                'max-width', 'border', 'text-decoration',
            ],

            // مخطّطات الروابط المسموح بها (href/src) — يمنع javascript:/data:.
            'allowed_schemes' => ['http', 'https', 'mailto'],
        ],
    ],

];
