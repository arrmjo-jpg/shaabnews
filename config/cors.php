<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing (CORS)
|--------------------------------------------------------------------------
| واجهة إدارية خاصة — لا يُسمح بأصل عام (*) إطلاقاً.
| الأصول المسموحة تُقرأ من CORS_ALLOWED_ORIGINS (قائمة بفواصل)،
| وإلا تُشتق من روابط الواجهات في config/frontend.php.
| المصادقة عبر Bearer token (لا كوكيز) ⇒ supports_credentials=false.
*/

$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))
)));

if ($origins === []) {
    $origins = array_values(array_filter([
        env('ADMIN_FRONTEND_URL', 'http://localhost:3001'),
        env('FRONTEND_URL', 'http://localhost:3000'),
        // منافذ التطوير المحلية (Vite / artisan serve) — بيئة محلية فقط
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
        // admin عبر Docker Compose المحلي (docker-compose.override.yml: "8081:80") — منفذ مختلف
        // عن Vite dev server (5173) أعلاه. localhost و127.0.0.1 أصلان مختلفان للمتصفح، فكلاهما لازم.
        'http://localhost:8081',
        'http://127.0.0.1:8081',
    ]));
}

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Requested-With', 'X-Client-Source'],

    'exposed_headers' => [],

    'max_age' => 600,

    // مصادقة Bearer — لا حاجة لاعتماد الكوكيز عبر الأصول
    'supports_credentials' => false,
];
