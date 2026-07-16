# تفعيل صفحة حالة php-fpm — قياس التشبّع الفعلي بدل الحساب النظري

كلا التقريرين استندا إلى `pm.max_children=30` من `docker/php/zz-fpm.conf`
لاستنتاج سقف نظري — لكن لا شيء يثبت أن العمليات الـ30 تصل فعلاً للاستخدام
الكامل تحت الحمل الحقيقي. صفحة الحالة تكشف هذا مباشرة: كم عملية **نشطة
فعلاً** الآن، وكم **في الانتظار** (listen queue)، مقارنة بالسقف.

## 1) تفعيل صفحة الحالة (تعديل واحد على zz-fpm.conf)

أضف هذا السطر داخل بلوك `[www]` في `docker/php/zz-fpm.conf` (بجانب
`pm.max_children` الموجود أصلاً):

```ini
[www]
pm = dynamic
pm.max_children = 30
pm.start_servers = 8
pm.min_spare_servers = 4
pm.max_spare_servers = 12
pm.max_requests = 500

; ── جديد — صفحة حالة PHP-FPM (JSON) ──────────────────────────────
pm.status_path = /fpm-status
ping.path = /fpm-ping
ping.response = pong
```

وأضف موقعاً (location) في `docker/php/nginx-backend.conf` يعرضها **محلياً
فقط** (لا تعرّضها للإنترنت العام مطلقاً — تكشف تفاصيل داخلية):

```nginx
location ~ ^/(fpm-status|fpm-ping)$ {
    allow 127.0.0.1;
    allow 172.16.0.0/12;   # شبكة Docker الداخلية النموذجية — تحقق من شبكتك الفعلية
    deny all;
    fastcgi_pass 127.0.0.1:9000;   # أو unix socket حسب إعدادكم الفعلي
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
}
```

أعد بناء/تشغيل حاوية backend بعد التعديل.

## 2) القراءة

```bash
# من داخل الحاوية أو عبر SSH tunnel محلي:
curl "http://127.0.0.1/fpm-status?json&full"
```

استخدم `monitor-fpm.sh` المرفق لتحويل هذا إلى سلسلة زمنية قابلة للقراءة
ولحساب نسبة الإشغال تلقائياً أثناء اختبار الحمل (k6) في نفس اللحظة —
شغّلهما معاً في نافذتي طرفية لربط رقم VUs في k6 برقم "active processes"
هنا مباشرة.
