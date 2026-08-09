# syntax=docker/dockerfile:1
# ── AlphaCMS backend — Laravel (PHP 8.4-FPM) production image ───────────────────
# Used by four roles (same image, different `command:` in docker-compose.yml): php-fpm (API),
# two queue workers, and the scheduler. Includes ffmpeg (video transcode) + image optimizers
# (spatie/image-optimizer) + Redis ext, all needed by every role since they share job classes.
#
# Two-stage build:
#   1) `vendor`  — resolves composer dependencies using the official composer:2 image. Isolated
#      from the runtime image so git/composer (build-only tools, no legitimate use once the app
#      is deployed) never end up in the final image, and so a PHP-extension change in the runtime
#      stage can never invalidate this stage's cache (it only depends on composer.json/lock).
#   2) `runtime` — the actual php:8.4-fpm image the containers run. Application code is copied
#      with an explicit allow-list (not `COPY . .`) so nothing outside Laravel's real runtime
#      footprint can end up in the image, regardless of what the .dockerignore does or doesn't
#      catch in the future (defense in depth — see .dockerignore for the primary fix).

FROM composer:2 AS vendor
WORKDIR /app
ENV COMPOSER_CACHE_DIR=/tmp/composer-cache
COPY composer.json composer.lock ./
# --ignore-platform-reqs: this stage's php-cli doesn't have gd/redis/etc — it only resolves and
# downloads packages, it never executes app code, so the real runtime extensions are irrelevant
# here (they're installed for real in the `runtime` stage below and will fail loudly at boot if
# something is actually missing).
# BuildKit cache mount: a persistent composer download cache across builds, independent of
# Docker's layer cache. A plain layer-cache hit still requires composer.lock to be byte-identical
# to a previous build; this mount speeds up the common case where composer.lock DID change
# (a dependency was bumped) by skipping re-download of every unchanged package's dist archive.
RUN --mount=type=cache,target=/tmp/composer-cache,id=alphacms-composer \
    composer install --no-dev --no-interaction --no-progress --prefer-dist \
      --optimize-autoloader --no-scripts --ignore-platform-reqs

FROM php:8.4-fpm AS runtime

# يُخبَز كتسمية تتبّعية على الصورة (لا سجلّ صور/registry بعد — قرار مُتَّخَذ عمدًا في مرحلة الانقسام
# الحالية لتفادي تعقيد إضافي غير ضروريّ الآن). backend وworkers يُبنيان كلاهما من هذا الـDockerfile
# بشكل مستقل (Coolify Application مختلف لكلّ منهما)، وبلا سجلّ مشترك لا يوجد إثبات آليّ بأنّ صورتيهما
# جاءتا من نفس الالتزام سوى هذه التسمية — GitHub Actions يمرّر نفس github.sha لكليهما في نفس الخطوة
# (انظر .github/workflows/deploy.yml)، وهذه التسمية تجعل ذلك قابلاً للتحقق فعليًا عبر
# `docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'`
# بدل الاعتماد على وسم `latest` كدليل تطابق (لا يثبت شيئًا لو أُعيد بناء أحدهما بمعزل عن الآخر).
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA

# System libraries + media tooling (all needed at RUNTIME, unlike git/composer which stay in the
# `vendor` stage above). ffmpeg/ffprobe → video HLS/MP4 transcode; the optimizer binaries are
# auto-detected by spatie/laravel-image-optimizer. unzip is kept (tiny, ~200KB) as a safety net
# for any runtime archive handling; git is intentionally NOT installed here (build-only need).
#
# libmagickwand-dev + imagick: spatie/image auto-selects ImagickDriver over GdDriver when the
# Imagick class exists (Image.php: `class_exists(Imagick::class) ? new ImagickDriver : new GdDriver`).
# Only ImagickDriver supports shrink-on-load (decoding a large source directly at a reduced
# resolution) — GD must always fully decode the original into an uncompressed bitmap before it can
# resize, so a single extreme-dimension camera/scan upload (~89MP observed in production) can
# exhaust PHP's memory_limit and crash the whole queue worker process. Installed in this one shared
# image (all four roles) rather than a worker-media-only image to avoid image sprawl — only the
# media queue worker actually exercises Spatie Image today, so other roles are unaffected in
# practice despite the extension being present.
#
# poppler-utils: provides pdftoppm (Epaper cover generation, config/epaper.php `cover.pdftoppm`)
# and pdftotext (embedded-text OCR extraction, config/epaper.php `ocr.embedded.binary`). Was
# missing entirely — confirmed live (`which pdftoppm` → not found) — so every Epaper cover
# silently never rendered (EpaperCoverGenerator catches the failure and just logs, by design, so
# nothing surfaced as an error) and embedded-text OCR always fell through to `no_pages`/failed.
RUN apt-get update && apt-get install -y --no-install-recommends \
      unzip libicu-dev libzip-dev libpng-dev libjpeg62-turbo-dev libwebp-dev libfreetype6-dev \
      libmagickwand-dev \
      ffmpeg jpegoptim optipng pngquant gifsicle webp nginx supervisor procps poppler-utils \
    && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql gd intl zip bcmath exif pcntl opcache \
    && pecl install redis imagick && docker-php-ext-enable redis imagick \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY docker/php/php.ini /usr/local/etc/php/conf.d/zz-alphacms.ini
COPY docker/php/zz-fpm.conf /usr/local/etc/php-fpm.d/zz-fpm.conf
COPY docker/php/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php/nginx-backend.conf /etc/nginx/sites-available/default
RUN rm -f /etc/nginx/sites-enabled/default && ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# إعدادات Supervisor الخاصّة بأدوار worker/worker-media/scheduler (shaabnews-workers Application،
# انظر docker-compose.workers.yml) — تعيش في مجلّد منفصل عن /etc/supervisor/conf.d/ عمدًا: ذاك
# الأخير يُحمَّل تلقائيًا بالكامل عند أيّ استدعاء `supervisord` بلا `-c` صريح (كما يحدث لدور
# backend عبر CMD الافتراضي أدناه)، فعزلها هنا يمنع تحميل worker.conf بالخطأ داخل حاوية backend
# أو العكس. تُستدعى صراحةً بـ`supervisord -c /etc/supervisor/conf.d-roles/<role>.conf` من
# docker-compose.workers.yml's command:.
RUN mkdir -p /etc/supervisor/conf.d-roles
COPY docker/php/supervisord-worker.conf /etc/supervisor/conf.d-roles/worker.conf
COPY docker/php/supervisord-worker-media.conf /etc/supervisor/conf.d-roles/worker-media.conf
COPY docker/php/supervisord-scheduler.conf /etc/supervisor/conf.d-roles/scheduler.conf
COPY docker/php/supervisor-fatal-exit.py /usr/local/bin/supervisor-fatal-exit.py
RUN chmod +x /usr/local/bin/supervisor-fatal-exit.py

WORKDIR /var/www/html

# Vendor from the dedicated stage — cached independently of every app-code change below; only
# invalidates when composer.json/composer.lock change.
COPY --from=vendor /app/vendor ./vendor

# Selective application copy. With .dockerignore fixed this is no longer strictly required for
# correctness, but an explicit allow-list is the stronger, future-proof guarantee: it copies
# exactly what Laravel needs to boot (app, bootstrap, config, database, lang, public, resources,
# routes, artisan, composer.json/lock) and nothing else, so any stray file that lands at the repo
# root in the future (the audit found six of them: liked.html, saved.html, redis_test*.php,
# publish_test*.php, scratch_test_*.php, an unidentified `alphacms` binary) can never silently
# re-enter the image even if someone forgets to update .dockerignore.
COPY app ./app
COPY bootstrap ./bootstrap
COPY config ./config
COPY database ./database
COPY lang ./lang
# --exclude enforces this at the COPY instruction itself (Dockerfile syntax 1.7+), independent of
# .dockerignore: real-world proof this actually matters — a stray public/uploads.zip (14.1GB
# backup, sibling to public/uploads/) slipped past the .dockerignore excludes on 2026-07-25 and
# got baked into this image (140s COPY, 15GB build context) because no .dockerignore pattern
# happened to name it. uploads/storage are belt-and-suspenders (docker-compose.yml bind-mounts
# them at runtime); the archive globs are the actual fix for a repeat of that incident.
COPY --exclude=uploads --exclude=storage --exclude=*.zip --exclude=*.tar --exclude=*.tar.gz public ./public
COPY resources ./resources
COPY routes ./routes
COPY artisan ./artisan
COPY composer.json composer.lock ./

# Writable runtime skeleton. .dockerignore strips the *contents* of storage/logs,
# storage/framework/{cache,sessions,views,testing} and storage/app/public (they're runtime state,
# either regenerated on demand or supplied by the volumes in docker-compose.yml) — but Laravel
# still requires the directories themselves to exist and be writable before it can boot, so they
# are recreated here explicitly rather than relying on empty directories surviving COPY.
RUN mkdir -p storage/app/public storage/framework/cache storage/framework/sessions \
      storage/framework/views storage/framework/testing storage/logs bootstrap/cache \
    && composer dump-autoload --optimize --no-dev \
    && php artisan package:discover --ansi || true \
    && chown -R www-data:www-data storage bootstrap/cache public

COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80
ENTRYPOINT ["entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
