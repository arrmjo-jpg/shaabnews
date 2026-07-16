# تدقيق أداء تنفيذي (Runtime) — AlphaCMS على Docker Compose المحلي

## تنويه صريح قبل أي شيء

طلبك يطلب تدقيقاً **تنفيذياً بالكامل** — لا نظري، كل استنتاج مدعوم بقياس فعلي.
هذا صحيح منهجياً ومطلوب. لكن بيئة العمل التي أكتب منها هذا الملف هي حاوية
Linux معزولة **بلا Docker daemon وبلا اتصال بجهازك** (لا SSH، لا متصفح متصل
حالياً — تحققتُ عبر أداة Chrome المتصلة ووجدت صفر متصفحات). هذا يعني حرفياً:
لا أستطيع تنفيذ `docker compose exec` ولا `docker stats` ولا فتح المتصفح على
`localhost:3000` بنفسي الآن. أي رقم "مُقاس" كنت لأكتبه بدل ذلك سيكون **اختلاقاً**
— بالضبط ما طلبت صراحة عدم فعله.

الحل العملي: بنيت هذه الحقيبة لتُنفَّذ **على جهازك** (حيث الحاويات تعمل فعلاً)،
وتُخرج نتائج خام منظّمة ترسلها لي فأكتب التقرير الهندسي الكامل (12 قسماً كما
طلبت) من أرقام حقيقية بدل استدلال. هذا هو نفس النمط الذي اتّبعناه في تدقيق
Docker السابق، ونجح.

## ما يمكن قياسه بهذه الحقيبة الآن (بلا أي تثبيت جديد)

| المرحلة | ما يُقاس | الأداة |
|---|---|---|
| 1 — البيئة | حالة كل حاوية، الصحة، عدد إعادات التشغيل، استخدام CPU/Memory حيّ | `docker compose ps` + `docker stats` + `docker inspect` |
| 2/4/9 — زمن الاستجابة | TTFB والزمن الكلي الفعلي لكل نقطة (API + صفحات Next.js + admin) | `curl -w` (5 عيّنات لكل مسار) |
| 3 — قاعدة البيانات | EXPLAIN فعلي، الفهارس الموجودة، متوسط عدد الاستعلامات لكل طلب (قياس تفاضلي حقيقي، ليس تخميناً) | `php artisan tinker` عبر `docker compose exec` |
| 5 — Redis | INFO الكامل (hit/miss/memory/evictions)، DBSIZE، عيّنة مفاتيح فعلية | نفس الآلية (Redis facade داخل الحاوية) |
| 6 — Meilisearch | `/health`, `/stats`, زمن بحث فعلي (5 عيّنات) | `curl` مباشرة (المنفذ 7700 منشور) |
| 7 — Workers | حجم كل طابور فعلياً (Redis LLEN)، عدد Jobs الفاشلة، سجلّات worker الأخيرة | Redis + `queue:failed` + `docker compose logs` |
| 8 — Docker Runtime | استخدام القرص الفعلي لكل حاوية/volume، أعلى العمليات استهلاكاً للـCPU داخل كل حاوية | `docker system df -v` + `docker compose top` |

## ما لا يمكن قياسه بهذه الحقيبة — ولماذا، وما البديل

**Phase 2 التفصيلي (middleware/controller/model hydration/view rendering منفصلة عن بعضها، Cache hit ratio على مستوى الطلب الواحد):**
لا يوجد Laravel Telescope ولا Pulse ولا Debugbar ولا Clockwork مثبَّتاً في
`composer.json` (تحقّقت مباشرة — القائمة فارغة). بلا أحدها، أقصى ما يُقاس هو
الزمن الكلي للطلب (متوفر أعلاه عبر curl) لا تفكيكه لمراحل داخلية. **الخيار:**
إن وافقت، أُثبّت **Laravel Pulse** (حزمة Laravel الرسمية، خفيفة، آمنة للإزالة
لاحقاً بأمر واحد) — تعطي مباشرة: أبطأ الاستعلامات، أبطأ الطلبات، توزيع
الاستثناءات، حجم الطوابير حيّاً. هذا تغيير كود (composer + migration)، لذا لم
أنفّذه من تلقاء نفسي — أخبرني إن أردته.

**Phase 4 الحقيقي (LCP/CLS/INP، Network waterfall، hydration، الحزم الأكبر، JavaScript غير المستخدم):**
هذه تحتاج متصفحاً حقيقياً يُحمّل الصفحة فعلياً. عندي أداة Chrome متصلة لكن لا
يوجد متصفح مسجَّل على حسابك حالياً. **خياران:**
1. صِل امتداد Claude in Chrome على جهازك — عندها أستطيع فتح `localhost:3000`
   وقراءة Network/Console/Performance مباشرة بنفسي.
2. أو نفّذ بنفسك (بلا أي تثبيت جديد، Node موجود أصلاً لديك):
   ```
   npx lighthouse http://localhost:3000/ --output=json --output-path=lighthouse-home.json --only-categories=performance
   npx lighthouse http://localhost:3000/articles/<slug> --output=json --output-path=lighthouse-article.json --only-categories=performance
   ```
   يعطي LCP/CLS/INP(TBT)/TTFB فعلية + قائمة JS غير مستخدم مرتّبة بالحجم. أرسل
   لي ملفَي JSON الناتجين وأحلّلهما بدقة.

## طريقة التشغيل

```powershell
cd F:\website\shaabjo
.\ops-toolkit\09-runtime-audit-docker\audit.ps1
```

خيارات:
- `.\audit.ps1 -Only 1,5,6` — مراحل محددة فقط (أرقام الجدول أعلاه).
- `.\audit.ps1 -SkipSlowLog` — يتخطّى تفعيل/تعطيل `slow_query_log` المؤقت في
  Phase 3 كلياً إن كنت لا تريد لمس أي إعداد MySQL عام حتى مؤقتاً (يُعاد
  تلقائياً لوضعه الأصلي في نهاية نفس التشغيل على أي حال — لكن الخيار موجود
  لمن يفضّل عدم المخاطرة إطلاقاً).

المدة التقريبية: 2-3 دقائق (أطول جزء هو 15 ثانية من عيّنات `docker stats`).

## ماذا بعد التشغيل

أرسل مجلد `ops-toolkit\09-runtime-audit-docker\results-<timestamp>\` كاملاً (أو
الصق كل ملف عند الطلب). من هذه الملفات فقط سأكتب التقرير الكامل:

1. Executive Summary
2. Runtime Architecture
3. Performance Measurements (من ملفاتك مباشرة، لا تقدير)
4. Bottleneck Ranking (Critical/High/Medium/Low، بدليل لكل بند)
5. Critical Issues
6. Optimization Roadmap
7. Quick Wins
8. Long-term Improvements
9. Estimated Performance Gain
10. Verification Checklist

أي بند لا يدعمه رقم فعلي من ملفاتك أو من Lighthouse/Chrome سيُذكر صراحة في
التقرير كـ"غير مُقاس — يتطلب [الأداة]" بدل استنتاج نظري، تماماً كما طلبت.
