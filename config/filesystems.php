<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            // أصل روابط الوسائط العامّة (شعارات/أيقونات/فافيكون/صور الكُتّاب…): يُخدَم /storage من **الأصل
            // العامّ** (دومين الواجهة) — الواجهة تُمرّر /storage إلى الـAPI (next.config rewrites)، تمامًا كما
            // تُخدَم مكتبة الوسائط عبر /uploads. الأولويّة: MEDIA_PUBLIC_URL (دومين CDN عامّ مخصّص إن وُجد) ←
            // FRONTEND_URL (الأصل العامّ) ← APP_URL (تطوير محلّيّ). **لا يُشتقّ من دومين الـAPI (api.*)**.
            'url' => rtrim(env('MEDIA_PUBLIC_URL') ?: env('FRONTEND_URL') ?: env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        // قرص الوسائط المحلّي canonical — يُخدَم مباشرةً من جذر الويب public/uploads.
        // رابطه محلّي دائماً (APP_URL/uploads) ولا يستخدم MEDIA_URL إطلاقاً: في
        // التخزين الهجين MEDIA_URL (دومين R2 العام) تخصّ المرآة البعيدة فقط، وخلطها
        // هنا يجعل الخدمة المحلّية تشير لـ R2 فينكسر التسليم عند تعطيل/فشل المرآة.
        'uploads' => [
            'driver' => 'local',
            'root' => public_path('uploads'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/uploads',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION', 'auto'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('MEDIA_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', true),
            'throw' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
