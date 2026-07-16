-- =====================================================================
-- MySQL Slow Query Log — تفعيل + EXPLAIN ANALYZE لأهم استعلامين مشكوك بهما
-- =====================================================================
-- الغرض: تحويل "استعلام COUNT يكلّف 1.4 ثانية" (رقم منقول من مراجعة قديمة،
-- غير مُعاد قياسه في أي من التقريرين) إلى رقم مُقاس الآن، وكشف أي استعلامات
-- بطيئة أخرى لم يذكرها أي تقرير سابق لأن المراجعة كانت قراءة كود لا قياساً.
--
-- تحذير: long_query_time=0.5 سيسجّل كل استعلام أبطأ من نصف ثانية — على
-- قاعدة بيانات إنتاجية هذا قد يُنتج ملف سجل كبير بسرعة. شغّله لفترة محدودة
-- (ساعة أو ساعتين وقت حركة طبيعية) ثم أعده لقيمته الأصلية أو 1-2 ثانية.

-- 1) القراءة أولاً — لا تغيّر شيئاً قبل تسجيل القيم الحالية للاستعادة لاحقاً.
SHOW VARIABLES LIKE 'slow_query_log%';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'log_output';

-- 2) التفعيل المؤقت (جلسة الخادم الحالية — يُفقد عند إعادة التشغيل، وهذا مقصود
--    لتفادي نسيانه مفعّلاً بشكل دائم). لتفعيل دائم عدّل my.cnf بدل هذا.
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5;         -- نصف ثانية — عدّل حسب حساسية النظام
SET GLOBAL log_output = 'TABLE';          -- أسهل للاستعلام من ملف نصي عبر SQL مباشرة
-- بديل: SET GLOBAL log_output = 'FILE';  -- إن كنت تفضل mysqldumpslow/pt-query-digest

-- 3) بعد ساعة-ساعتين من حركة حقيقية، استعلم أبطأ الاستعلامات مباشرة:
SELECT
    start_time,
    query_time,
    lock_time,
    rows_sent,
    rows_examined,
    LEFT(sql_text, 200) AS query_preview,
    db
FROM mysql.slow_log
ORDER BY query_time DESC
LIMIT 30;

-- 4) تجميع حسب نمط الاستعلام (يكشف الاستعلام الأكثر تكراراً وليس الأبطأ مرة
--    واحدة فقط — غالباً الأهم فعلياً لأن N×50ms قد يفوق 1×1400ms في التأثير
--    التراكمي على الخادم، وهذا بالضبط ما لا يستطيع أي تقرير قراءة-كود رؤيته):
SELECT
    LEFT(sql_text, 120) AS query_pattern,
    COUNT(*) AS occurrences,
    ROUND(AVG(query_time), 3) AS avg_seconds,
    ROUND(SUM(query_time), 1) AS total_seconds_cost,
    ROUND(AVG(rows_examined), 0) AS avg_rows_examined
FROM mysql.slow_log
GROUP BY query_pattern
ORDER BY total_seconds_cost DESC
LIMIT 20;

-- 5) إعادة الإيقاف بعد جمع العيّنة الكافية (لا تترك هذا مفعّلاً دائماً بلا مراقبة):
-- SET GLOBAL slow_query_log = 'OFF';

-- =====================================================================
-- EXPLAIN ANALYZE لأهم استعلامين مشكوك بهما تحديداً من التقريرين السابقين
-- =====================================================================
-- استبدل :locale بـ 'ar' فعلياً (MySQL لا يدعم named parameters في سطر أوامر خام).

-- (أ) استعلام COUNT على قائمة المقالات — الادّعاء الأصلي: 1436ms على 217,460 صف.
--     شغّل هذا واقرأ Actual Time وBuffer Pool hit ratio فعلياً بدل الرقم المنقول:
EXPLAIN ANALYZE
SELECT COUNT(*) FROM articles
WHERE status = 'published' AND locale = 'ar' AND deleted_at IS NULL;

-- (ب) نفس القائمة لكن مع JOIN تصنيف — النمط الفعلي المستخدم في ListPublicArticlesAction:
EXPLAIN ANALYZE
SELECT articles.*
FROM articles
WHERE status = 'published' AND locale = 'ar' AND deleted_at IS NULL
ORDER BY published_at DESC
LIMIT 15 OFFSET 0;

-- (ج) نفس الاستعلام على صفحة عميقة (page=95 → offset=1410) — يختبر تدهور
--     أداء offset pagination مع عمق الصفحة، وهو بالضبط ما يبرر حماية
--     max_page=100 المذكورة في الكود:
EXPLAIN ANALYZE
SELECT articles.*
FROM articles
WHERE status = 'published' AND locale = 'ar' AND deleted_at IS NULL
ORDER BY published_at DESC
LIMIT 15 OFFSET 1410;

-- (د) مسار cursor المُدَّعى أنه أسرع (بلا COUNT، بلا OFFSET) — للمقارنة المباشرة
--     رقماً برقم بدل افتراض أنه أسرع لأن الكود يقول ذلك:
EXPLAIN ANALYZE
SELECT articles.*
FROM articles
WHERE status = 'published' AND locale = 'ar' AND deleted_at IS NULL
  AND id < 999999999   -- استبدل بآخر id من الصفحة السابقة فعلياً
ORDER BY id DESC
LIMIT 15;

-- =====================================================================
-- فحص إضافي لم يذكره أي تقرير سابق: هل جدول sessions فعلاً "ساخن" كما
-- استُنتج نظرياً من SESSION_DRIVER=database؟ قِس معدل الكتابة الفعلي:
-- =====================================================================
SELECT
    TABLE_NAME,
    TABLE_ROWS,
    ROUND(DATA_LENGTH / 1024 / 1024, 2) AS data_mb,
    ROUND(INDEX_LENGTH / 1024 / 1024, 2) AS index_mb
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('sessions', 'articles', 'jobs', 'failed_jobs')
ORDER BY TABLE_NAME;

-- عمق طابور DB (إن كان أي طابور fallback على DB_QUEUE بدل Redis) — يكشف تراكماً فعلياً:
SELECT queue, COUNT(*) AS pending_jobs, MIN(created_at) AS oldest_job
FROM jobs
GROUP BY queue
ORDER BY pending_jobs DESC;

SELECT COUNT(*) AS failed_jobs_total FROM failed_jobs;
