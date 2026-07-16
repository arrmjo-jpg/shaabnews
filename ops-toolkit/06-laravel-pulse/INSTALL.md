# تثبيت Laravel Pulse — مراقبة داخلية بلا بنية تحتية إضافية

Prometheus/Grafana (المجلد 05) يراقبان النظام من الخارج (MySQL، Redis،
الموارد). Pulse يراقب **تطبيق Laravel نفسه من الداخل**: الاستعلامات
البطيئة الفعلية، الطلبات البطيئة، استخدام الطوابير، الاستثناءات — وهو
الأنسب هنا تحديداً لأنه يعرف بنية التطبيق (Actions، Jobs المُسمّاة) بعكس
مقاييس Prometheus العامة. يتطلب Redis (متوفر أصلاً) ولا يحتاج حاويات جديدة.

## 1) التثبيت

```bash
composer require laravel/pulse
php artisan vendor:publish --provider="Laravel\Pulse\PulseServiceProvider"
php artisan migrate
```

## 2) الإعداد — استهداف الفجوات المحدَّدة في التقريرين تحديداً

في `.env` (بيئة الإنتاج الفعلية، وليس نسخة العمل المحلية):

```env
PULSE_ENABLED=true
PULSE_DOMAIN=null
PULSE_PATH=pulse
PULSE_INGEST_DRIVER=redis
```

في `config/pulse.php`، فعّل تحديداً هذه الـ Recorders (بعضها معطّل
افتراضياً وهو بالضبط ما يسدّ فجوات المراجعتين):

```php
'recorders' => [
    Recorders\SlowQueries::class => [
        'enabled' => true,
        'threshold' => 500, // ms — يربط مباشرة باستعلام COUNT ~1400ms المشكوك به
    ],
    Recorders\SlowRequests::class => [
        'enabled' => true,
        'threshold' => 1000, // ms
    ],
    Recorders\SlowJobs::class => [
        'enabled' => true,
        'threshold' => 1000, // ms — يكشف مباشرة إن كانت مهمة AI/بحث فعلاً
                              // تحجب طابور الإشعارات كما استنتج التقرير الأول
    ],
    Recorders\Queues::class => [
        'enabled' => true,   // عمق الطابور الفعلي — لا افتراضاً
    ],
    Recorders\CacheInteractions::class => [
        'enabled' => true,   // Cache Hit/Miss فعلي من داخل Laravel نفسه —
                              // يكمّل redis-cli INFO stats (المجلد 03) برؤية
                              // على مستوى كل مفتاح/تاغ لا الخادم ككل
        'sample_rate' => 1,
    ],
    Recorders\Exceptions::class => ['enabled' => true],
    Recorders\Servers::class => ['enabled' => true], // CPU/ذاكرة الحاوية نفسها
],
```

## 3) الوصول

```php
// routes/web.php أو bootstrap/app.php حسب إصدار Laravel — قصر الوصول على
// super_admin فقط (نفس نمط RoleEscalationGuard الموجود أصلاً في المشروع):
use Laravel\Pulse\Facades\Pulse;

Gate::define('viewPulse', function ($user) {
    return $user->hasRole('super_admin');
});
```

افتح `https://api.alpha-cms.shop/pulse` (خلف مصادقة الإدارة).

## 4) ماذا تراقب تحديداً لحسم أسئلة التقريرين

| اللوحة في Pulse | يحسم أي سؤال مفتوح |
|---|---|
| Slow Queries | هل COUNT فعلاً 1.4 ثانية الآن، أم كان رقماً قديماً؟ |
| Slow Jobs | هل عامل الطابور الواحد فعلاً يُؤخّر مهام خفيفة خلف ثقيلة؟ |
| Cache | نسبة الإصابة الفعلية — العامل الذي حدّدته المراجعة النقدية كأهم من عدد العمليات نفسه |
| Exceptions | هل يظهر أي خطأ متعلق بـ SCOUT_QUEUE/Meilisearch فعلياً في الإنتاج؟ |
| Servers | استهلاك CPU/ذاكرة الحاوية الفعلي مقابل الحد النظري 15GB المحسوب في التقرير الأول |

## ملاحظة تشغيلية

Pulse نفسه يكتب إلى Redis بشكل متواصل — إن كان `CACHE_STORE=redis` و
`QUEUE_CONNECTION=redis` على نفس الخادم المُحمَّل أصلاً (كما هو الحال هنا)،
راقب أن Pulse نفسه لا يضيف حملاً غير مرغوب. `sample_rate` في
`CacheInteractions` أعلاه قابل للتخفيض إلى `0.1` (10% من التفاعلات) إن
لوحظ أي أثر.
