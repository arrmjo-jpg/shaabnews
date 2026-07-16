# خطة ترحيل storage/app/public — من named volume إلى bind mount

هذا خاص فقط بـ **PR2** (تعديل `docker-compose.yml`). لا علاقة له بـ`public/uploads` — ذاك
مسار bind mount حقيقي على القرص أصلاً منذ قبل هذا التدقيق ولا يحتاج ترحيلاً.

نطاق التأثير عند التطبيق: يتطلب إعادة إنشاء 4 حاويات فقط (`backend`, `worker`, `worker-media`,
`scheduler`) — لا يمسّ `frontend` ولا `admin` ولا `meilisearch`. توقّف API خلال إعادة الإنشاء
يُقاس بثوانٍ إلى دقيقة، لا أكثر، إن اتُّبعت الخطوات بالترتيب.

## 0. قبل أي شيء — تحديد اسم الـ volume الفعلي على الخادم

اسم الـ named volume في Compose هو `media`، لكن Docker يُبادِله باسم مُسبوق باسم المشروع
(project name — عادة اسم المجلد أو ما يضبطه Coolify). نفّذوا على الخادم:

```bash
docker volume ls | grep media
# مثال متوقّع: alphacms_media   أو   <project>_media
```

احتفظوا بهذا الاسم — سيُستخدم في كل خطوة أدناه بدل `<VOLUME_NAME>`.

## 1. إنشاء مسار bind mount الجديد على المضيف

```bash
sudo mkdir -p /data/storage-public
# UID/GID الحاوية: php-fpm يعمل كـ www-data (عادة 33 داخل صورة php:8.4-fpm الرسمية — تأكّدوا برقم
# فعلي: docker run --rm alphacms-backend:latest id www-data)
sudo chown -R 33:33 /data/storage-public
```

إن كان `STORAGE_PUBLIC_HOST_PATH` سيُضبَط لمسار مختلف عن `/data/storage-public` الافتراضي،
استخدموا ذلك المسار بدلاً منه في كل ما يلي.

## 2. نسخ البيانات من الـ volume القديم — تمريرة أولى (أونلاين، بلا توقّف)

هذه التمريرة تنسخ الجزء الأكبر من البيانات بينما الموقع لا يزال يعمل بالكامل على الإعداد
القديم. آمنة لأنها للقراءة فقط من الـ volume القديم:

```bash
docker run --rm \
  -v <VOLUME_NAME>:/from:ro \
  -v /data/storage-public:/to \
  alpine sh -c "apk add --no-cache rsync >/dev/null && rsync -a --info=progress2 /from/ /to/"
```

## 3. التحقّق من التطابق (قبل أي توقّف)

```bash
docker run --rm -v <VOLUME_NAME>:/from:ro alpine sh -c "find /from -type f | wc -l"
find /data/storage-public -type f | wc -l
# الرقمان يجب أن يتطابقا أو يكونا قريبين جدًا (فرق بسيط مقبول = ملفات كُتبت أثناء التمريرة الأولى)
```

## 4. نافذة صيانة قصيرة — التمريرة النهائية + التبديل

```bash
# أ) أوقفوا الكتّاب فقط (لا الموقع كله) لمنع كتابة أثناء التمريرة الأخيرة
docker compose stop worker worker-media scheduler backend

# ب) rsync أخير لالتقاط أي فرق تبقّى من الخطوة 2
docker run --rm \
  -v <VOLUME_NAME>:/from:ro \
  -v /data/storage-public:/to \
  alpine sh -c "apk add --no-cache rsync >/dev/null && rsync -a --delete /from/ /to/"

# ج) انشروا docker-compose.yml الجديد (من هذا الـ PR) — يحتوي bind mount الجديد بالفعل
docker compose up -d backend worker worker-media scheduler
```

`--delete` في الخطوة (ب) فقط لأن الكتّاب متوقفون؛ لا خطر من فقدان كتابة جارية.

## 5. التحقّق بعد النشر

```bash
# الحاوية ترى الملفات القديمة؟
docker compose exec backend ls storage/app/public | head

# رفع تجريبي من لوحة الإدارة (صورة صغيرة) ثم:
ls -la /data/storage-public/<اسم الملف المرفوع حديثًا>

# الموقع العام لا يزال يخدم صورة قديمة معروفة عبر /storage/... (نفس الرابط من قبل الترحيل)
curl -I https://alpha-cms.shop/storage/<مسار صورة معروفة مسبقًا>
```

## 6. خطة التراجع (Rollback)

لا تحذفوا `<VOLUME_NAME>` القديم فورًا — أبقوه كشبكة أمان. إن ظهرت مشكلة بعد الخطوة 4:

```bash
git checkout HEAD~1 -- docker-compose.yml   # أو استعادة النسخة السابقة يدويًا
docker compose up -d backend worker worker-media scheduler
```

بما أن الـ volume القديم لم يُمسّ (النسخ في الخطوة 2/4 قراءة فقط منه)، هذا التراجع فوري وآمن
بلا فقدان بيانات.

## 7. التنظيف (بعد فترة ثقة — يوم إلى أسبوع، وليس فورًا)

```bash
docker volume rm <VOLUME_NAME>
```

## ملاحظة صريحة

لم يُنفَّذ أي من هذا فعليًا في جلسة التدقيق — لا Docker daemon متاح في بيئة العمل. هذه خطوات
مكتوبة بناءً على فهم توثيق Docker وrsync القياسي، لم تُختبَر بالتنفيذ الفعلي على خادمكم. أنصح
بتجربتها أولاً على بيئة staging إن وُجدت، أو على نسخة تجريبية صغيرة من البيانات قبل تطبيقها على
الإنتاج الحقيقي.
