<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

use Illuminate\Http\Request;
$request = Request::create('/api/v1/ar/articles', 'GET', [
    'per_page' => 9,
    'sort' => '-published_at',
    'paginate' => 'cursor',
    'filter' => ['category' => 'local-news']
]);
$app->instance('request', $request);

$start = microtime(true);
$action = new App\Actions\Public\Content\ListPublicArticlesAction();
$res = $action->handle('ar', $request);
$time1 = microtime(true) - $start;

$start = microtime(true);
$res = $action->handle('ar', $request);
$time2 = microtime(true) - $start;

echo "Time 1: " . round($time1 * 1000, 2) . "ms, Time 2: " . round($time2 * 1000, 2) . "ms\n";
