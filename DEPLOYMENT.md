# AlphaCMS (shaabnews) — Production Deployment Runbook

Self-hosted via **Coolify + Traefik** on a single Linux host. No Kubernetes, no separate edge
nginx — Traefik terminates TLS and routes by domain directly to each Application's container.

> **هذا الملف يوثّق مسار Docker/Coolify النشط فقط.** مسار نشر بديل بلا Docker (bare-metal،
> systemd/cron) موثّق بمعزل في `deployment/` — غير مُستخدَم حاليًا، يُحفَظ مرجعًا فقط.

---

## 1. Architecture — 5 independent Coolify Applications

المعمارية الموحَّدة القديمة (كل الخدمات في `docker-compose.yml` واحد، Coolify Application واحد)
اتّضح أنها تحمل عيبين بنيويّين خطيرين، أثبتهما تحقيق حوادث 2026-08-07/08/09:

1. **بناء frontend يعتمد على backend حيًّا وقت البناء** (SSG/ISR يحتاج بيانات فعلية من الـCMS) —
   إن كان backend معطّلاً لأي سبب، كل محاولة نشر لاحقة تفشل عند نفس البوّابة، فيصبح الموقع عالقًا
   بلا طريقة للخروج عبر نشر عادي (عطل ذاتيّ التكاثر).
2. **إعادة تدوير `queue:work --max-time=3600` الطبيعية (كل ساعة، لحماية الذاكرة) كانت PID 1
   للحاوية نفسها**، فكل خروج نظيف (`exit 0`) كان يُحسَب من Docker كـ`RestartCount++` — وبما أن
   worker كان يشارك نفس Coolify Application مع backend/frontend، بلوغ عتبة "Max Restarts" كان
   يُسقط **الموقع كاملاً**، لا worker وحده.

المعمارية الحالية تفصل كل مصدر فشل في Coolify Application مستقل بذاته، بحيث لا يستطيع فشل واحد
إسقاط الباقي بنيويًّا:

```
                         ┌─────────────┐
                         │   Traefik   │  (TLS, دومين لكل Application)
                         └──────┬──────┘
                                │
       ┌────────────────────────┼────────────────────────┐
       ▼                        ▼                        ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Frontend   │────────▶│   Backend   │◀────────│    Admin    │
│  Next.js    │  HTTPS  │   Laravel   │  HTTPS  │  React/Vite │
│ (harer.store)│        │(api.harer.  │        │(admin.harer.│
└─────────────┘         │   store)    │         │   store)    │
                         └──────┬──────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
                 MySQL       Redis      Meilisearch
                (external)  (external)  (own Application)
                    ▲           ▲
                    │           │
                    └─────┬─────┘
                          │
                   ┌──────▼───────┐
                   │   Workers    │  (worker + worker-media + scheduler,
                   │  supervisord │   كل واحد تحت supervisord — انظر §5)
                   └──────────────┘
```

| Application | Compose file | Domain | يبني من |
|---|---|---|---|
| `shaabnews-backend` | `docker-compose.backend.yml` | `api.harer.store` | `docker/php/Dockerfile` |
| `shaabnews-workers` | `docker-compose.workers.yml` | — (داخلي، بلا Traefik) | نفس Dockerfile |
| `shaabnews-frontend` | `docker-compose.frontend.yml` | `harer.store` | `frontend/Dockerfile` |
| `shaabnews-admin` | `docker-compose.admin.yml` | `admin.harer.store` | `admin-frontend/Dockerfile` |
| `shaabnews-meilisearch` | `docker-compose.meilisearch.yml` | — (داخلي) | صورة جاهزة |

**MySQL وRedis خارجيان** — غير معرَّفين في أيّ ملف Compose هنا؛ موارد Coolify Database (أو
خوادم مُدارة خارجيًا) يصلها backend/workers عبر `DB_HOST`/`REDIS_HOST` في `.env`. **العنوان
الفعليّ يُحدَّد ويُثبَت فعليًّا على السيرفر قبل أي نشر — لا يُخمَّن.**

**المتصفّح لا يتّصل بـbackend مباشرة إلا من admin** — استدعاءات frontend كلّها SSR (وقت البناء
ووقت التشغيل)، عبر `API_BASE_URL`/`BUILD_API_BASE_URL`، كلاهما الآن **نفس العنوان العام**
(`https://api.harer.store`) — انظر §3.

---

## 2. Build & first deploy (per Application)

كل Application يُبنى وينشر بشكل مستقل تمامًا عبر Coolify UI أو webhook. لا ترتيب بناء داخل ملف
واحد بعد الآن — الترتيب يُفرَض خارجيًا عبر `.github/workflows/deploy.yml` (انظر §7).

```bash
# لكل Application: Coolify يسحب المستودع، يبني من ملف Compose المخصَّص، ثم:
docker compose -f docker-compose.backend.yml run --rm backend php artisan key:generate      # مرّة واحدة فقط
docker compose -f docker-compose.backend.yml run --rm backend php artisan migrate --force   # مرّة واحدة لكل نشر
docker compose -f docker-compose.backend.yml run --rm backend php artisan scout:sync-index-settings
```

`meilisearch` (`shaabnews-meilisearch`) يجب أن يكون حيًّا وصحيًّا **قبل** أول `scout:import` من
backend.

---

## 3. Environment & secrets

**بناء frontend (يُخبَز، غير سرّي):** `CLIENT`، `BUILD_API_BASE_URL`، `SITE_URL`.
**تشغيل frontend:** `API_BASE_URL` (**نفس قيمة `BUILD_API_BASE_URL` حرفيًّا** — `build-gate-
config.mjs` يفشل البناء إن اختلفا)، `SITE_URL`، `REVALIDATE_SECRET`.
**تشغيل backend (`.env`):** `APP_KEY`، بيانات MySQL/Redis، `QUEUE_CONNECTION=redis`،
`CACHE_STORE=redis`، `FRONTEND_REVALIDATE_URL` + `FRONTEND_REVALIDATE_SECRET` (**يجب أن يطابق**
`REVALIDATE_SECRET` الخاص بـfrontend حرفيًّا — الآن اعتماد **عابر لـApplications منفصلة**، لا
مجرّد متغيّرين في نفس الملف كما سابقًا)، `MEILISEARCH_*`، إلخ.
**Traefik domains:** قيم حرفية داخل `labels:` كل ملف Compose (**ليست** متغيّرات بيئة) — انظر §6
للسبب.

**السرّية:** جميع الأسرار تعيش فقط في متغيّرات بيئة Coolify الخاصّة بكل Application — لا في Git،
لا في الصورة. `OPENWEATHER_API_KEY`/`INTERNAL_API_TOKEN` عبر BuildKit secret mounts حصرًا.

---

## 4. `BUILD_API_BASE_URL` = `API_BASE_URL` (قرار معماريّ دائم)

منذ انقسام backend إلى Application مستقل دائم التشغيل (لا يعتمد على frontend إطلاقًا)، القيمتان
**نفس العنوان العامّ** في كل بيئة — بلا استثناء لـCoolify، بلا `host.docker.internal`، بلا نشر
منفذ backend على المضيف. راجع `.env.example` و[ADR-017](docs/adr/017-build-time-cms-prerendering.md)
للتفاصيل الكاملة وللسياق التاريخيّ (كانت هناك فترة مؤقّتة، commit `0773979`، استُخدم فيها
`host.docker.internal` كترقيع لعطل معماريّ مختلف — زال المبرّر بعد هذا الانقسام).

الاعتماد الوحيد المتبقّي: **backend يجب أن يكون منشورًا بنجاح وصحيًّا فعليًّا قبل بدء بناء
frontend** — مشكلة *ترتيب نشر*، يحلّها §7، وليست مشكلة شبكة معزولة بعد الآن.

---

## 5. Workers — إعادة تدوير داخلية بلا Docker RestartCount

`worker`/`worker-media`/`scheduler` (Application `shaabnews-workers`) لا تُشغِّل
`php artisan queue:work`/`schedule:work` مباشرة كـPID 1 كما كان سابقًا. كل حاوية تشغِّل
`supervisord` (`docker/php/supervisord-{worker,worker-media,scheduler}.conf`) الذي يدير العملية
كطفل له:

- **إعادة تدوير طبيعية** (`--max-time=3600` ينتهي، `exit 0`، أو أي خروج بعد أكثر من `startsecs`
  من التشغيل): `supervisord` يعيد تشغيلها فورًا. `supervisord` نفسه (PID 1) لا يخرج أبدًا →
  **Docker RestartCount يبقى 0** → Coolify لا يرى أي إشارة إطلاقًا لهذه الحالة.
- **انهيار حقيقيّ متكرّر** (خروج داخل `startsecs` أكثر من `startretries` مرّات متتالية):
  `supervisord` ينقل البرنامج لحالة `FATAL` ويتوقّف عن إعادة المحاولة. عندها
  `docker/php/supervisor-fatal-exit.py` (مُسجَّل كـ`eventlistener` على حدث
  `PROCESS_STATE_FATAL`) يُنهي `supervisord` نفسه عمدًا → **الحاوية تخرج فعليًّا** → سياسة
  `restart: unless-stopped` تُعيد تشغيلها → **RestartCount يتصاعد فعلاً هذه المرّة** — إشارة
  صادقة لعطل حقيقيّ، لا صمت دائم ولا إنذار كاذب لإعادة التدوير الطبيعية.

`worker`/`scheduler` في Application منفصل تمامًا عن `backend`/`frontend`/`admin`: حتى لو حدث
انهيار حقيقيّ غير قابل للاسترداد، `StopApplication` (إن فُعِّلت لدى Coolify) لا تستطيع لمس أي
Application آخر بنيويًّا.

**Max Restarts في Coolify يبقى مضبوطًا (مثلاً 720) كشبكة أمان إضافية فقط — ليس جزءًا من الحلّ
الجذريّ.**

---

## 6. Migration domains (مؤقّت، أثناء الترحيل من المعمارية القديمة فقط)

⚠️ **مُصحَّح بعد اختبار حيّ فعليّ (Phase F، 2026-08-09):** المحاولة الأولى استخدمت
`BACKEND_DOMAIN`/`FRONTEND_DOMAIN`/`ADMIN_DOMAIN` كمتغيّرات بيئة `${...}` داخل `labels:` — فشلت
حيًّا: **Coolify لا يُفسِّر متغيّرات البيئة داخل قسم `labels:` إطلاقًا** (يمرّرها كنصّ خام، خلافًا
لـ`environment:`/`build.args:` التي يحلّها بشكل صحيح — مؤكَّد بمقارنة `docker exec ... env` مقابل
`docker inspect` على نفس الحاوية الفعلية: المتغيّر محقون بشكل صحيح داخل بيئة التشغيل، لكن الـlabel
الفعليّ ظلّ يحمل النص الحرفيّ غير المُفسَّر). **كذلك**: لا تُستخدَم خانة "Domain" المدمجة في واجهة
Coolify لـ`shaabnews-backend` — فشلت أيضًا حيًّا ("cannot be linked automatically with multiple
Services") لأن هذا الملف يعرّف خدمتَي Traefik (`backend` و`public-storage`) على حاوية واحدة، وآلية
Coolify التلقائية تفترض خدمة واحدة فقط.

**الحل المُعتمَد الآن**: دومينات **حرفية مباشرة** داخل `labels:` كل ملف Compose — يطابق تمامًا نمط
`docker-compose.yml` الموحَّد القديم المُثبَت العمل فعليًا. أثناء بناء واختبار الـ5 Applications
الجديدة، القديم لا يزال يخدم الدومينات الحقيقية (`api.harer.store` إلخ) — الجديد يستخدم دومينات
مؤقّتة (`api-new.harer.store`, `new.harer.store`, `admin-new.harer.store`) بحيث لا يرى Traefik
راوترين يطالبان بنفس `Host()` في آن واحد. **الانتقال النهائيّ (cutover) الآن تعديل ملف صريح**:
تبديل الدومينات الحرفية في `docker-compose.{backend,frontend,admin}.yml` للدومينات الحقيقية، ثم
commit → push → إعادة نشر — **ليس** مجرّد تغيير متغيّر بيئة في Coolify كما افتُرِض أوّلاً. القديم
يبقى **موجودًا وموقوفًا (لا محذوفًا)** كمسار تراجع فوريّ بعد الانتقال.

---

## 7. Deployment order — `.github/workflows/deploy.yml`

Coolify لا يدعم تسلسل نشر عبر Applications منفصلة أصلاً؛ الترتيب يُفرَض من GitHub Actions:

```
push → main
   │
   ├── تغيّر كود backend/workers؟
   │        ↓
   │     نشر backend → تأكيد نجاح النشر فعليًّا (لا /up فقط، قد يُرجِع 200 من نسخة قديمة
   │        ↓             إن فشل النشر الجديد) → نشر workers
   │
   ├── تغيّر كود frontend، أو backend أُعيد نشره؟
   │        ↓
   │     تأكيد backend صحّي فعليًّا → نشر frontend
   │
   └── تغيّر كود admin؟
            ↓
         نشر admin (مستقل، لا ترتيب مطلوب)
```

`frontend/scripts/build-gate-preflight.mjs` يبقى خطّ دفاع ثانٍ — يفشل البناء بصوت عالٍ لو تسلّل
خلل في هذا التسلسل بأي شكل، بدل خبز صفحات فارغة بصمت.

---

## 8. Migration acceptance tests (يجب اجتيازها جميعًا قبل cutover — انظر §6)

| # | الاختبار | أين |
|---|---|---|
| 1 | Worker recycling طبيعي ⇒ `RestartCount=0` بعد أكثر من دورة `--max-time=3600` كاملة | `shaabnews-workers` الجديد فقط |
| 2 | نشر backend فاشل عمدًا لا يُسقط النسخة العاملة | Application اختباريّ منفصل، **ليس الإنتاج** |
| 3 | نشر frontend فاشل لا يمسّ backend/admin/workers | نفس الشيء |
| 4 | انهيار حقيقيّ متكرّر لعامل يظهر عبر RestartCount (لا يختفي بصمت) | **worker اختباريّ مؤقّت أو Application الترحيل قبل cutover — لا يُختبَر أبدًا بقطع Redis/MySQL عن الإنتاج الحيّ** |
| 5 | `REVALIDATE_SECRET` متطابق فعليًّا بين backend/frontend الجديدين | نشر مقال تجريبيّ → تحديث فوريّ لصفحة frontend الجديد |
| 6 | تعطّل Meilisearch الجديد لا يُسقط باقي backend | إيقاف مؤقّت لـ`shaabnews-meilisearch` الجديد فقط |

---

## 9. Backups & recovery (spatie/laravel-backup)

`BACKUP_DESTINATION_DISKS=s3` (offsite إلزاميّ)، `BACKUP_ARCHIVE_PASSWORD`،
`BACKUP_NOTIFICATION_EMAIL`. يغطّي: تفريغ MySQL + مسارَي الوسائط (`STORAGE_PUBLIC_HOST_PATH`،
`UPLOADS_HOST_PATH`) — **bind mounts على مسارات مضيف مطلقة، مستقلّة عن أي Coolify Application**؛
الانقسام لا يؤثّر عليها إطلاقًا طالما backend/workers الجديدان يُشيران لنفس المسارين حرفيًّا.

---

## 10. Monitoring

- `php artisan health:check` كل 15 دقيقة (backend). `/up` (backend)، `/api/health` (frontend) —
  فحوصات Docker `healthcheck` مضبوطة لكل Application (انظر ملفات Compose المعنية).
- Workers: `pgrep` يتحقّق من وجود العملية؛ حالة `unhealthy` وحدها لا تُعيد تشغيل الحاوية (سياسة
  Docker لا تتفاعل إلا مع خروج فعليّ) — هذا مقصود، انظر §5 لآلية `PROCESS_STATE_FATAL` الفعلية.

---

## 11. Launch smoke-test checklist

نفس قائمة الفحص التشغيليّ السابقة (الصفحة الرئيسية، نشر مقال + تحديث فوريّ، الفيديوهات، الريلز،
البث المباشر، البحث، الاستطلاعات، الإعلانات، الخرائط، الجوّال، إبطال الكاش، ترويسات الأمان، رفع
وسائط كبيرة) — تُنفَّذ على domain الترحيل المؤقّت (§6) قبل cutover، ثم تُعاد بعد cutover على
الدومينات الحقيقية للتأكيد النهائيّ.

---

## 12. Production assumptions

- `frontend` نسخة واحدة (ISR cache لكل نسخة على حدة). `scheduler` نسخة واحدة حصرًا
  (`onOneServer` مُطبَّق أيضًا عبر أقفال Redis).
- Redis إلزاميّ (كاش موسوم، أقفال `onOneServer`/`withoutOverlapping`).
- TLS ينتهي عند Traefik (Let's Encrypt، `certresolver=letsencrypt`) — لا Cloudflare في هذه
  المعمارية الحالية (خلافًا لنسخة سابقة من هذا المستند التي افترضت Cloudflare أمام nginx منفصل —
  ذلك تصميم قديم غير مطابق للنشر الفعليّ الحاليّ).
- البحث يتدهور بأمان (نتائج فارغة) إن تعطّل Meilisearch — لا يُسقط باقي backend بعد الانقسام.

---

## 13. Launch risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| `REVALIDATE_SECRET` ≠ `FRONTEND_REVALIDATE_SECRET` عبر Applications منفصلة | إبطال الكاش يعود لانتظار TTL فقط | تحقّق صريح ضمن اختبار القبول §8-5 |
| Meilisearch الجديد بـvolume فارغ بالخطأ | فقدان الفهرس بالكامل | تأكيد اسم الـvolume الحقيقيّ على السيرفر قبل النشر (انظر تعليق `docker-compose.meilisearch.yml`) — لا افتراض |
| عناوين MySQL/Redis/Meilisearch غير قابلة للوصول من شبكة Application منفصل | backend/workers يفشلان عند الاتصال | يُثبَت فعليًّا (`docker exec` من الحاوية الجديدة) قبل أي cutover — لا افتراض، انظر تعليقات TODO في ملفات Compose |
| نشر frontend/admin/workers قبل تأكّد backend صحّي فعليًّا | نفس عطل 2026-08-07/08 يتكرّر بصورة مصغّرة | `.github/workflows/deploy.yml` (§7) — بوّابة صحّة صريحة، لا `/up` وحده |
| Traefik router تعارض أثناء الترحيل (domain مكرّر) | توجيه غير متوقّع للترافيك | §6 — الجديد يستخدم دومينات مؤقّتة دومًا حتى cutover |
