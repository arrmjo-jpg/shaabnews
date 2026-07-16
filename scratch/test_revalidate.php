<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\Article;
use App\Models\User;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Frontend\FrontendCacheTags;
use Illuminate\Support\Facades\Http;

echo "1. Checking URL configured in .env\n";
$url = config('services.frontend_revalidate.url');
echo "FRONTEND_REVALIDATE_URL = " . $url . "\n";
echo "SECRET = " . config('services.frontend_revalidate.secret') . "\n";

echo "\n2. Attempting to hit the frontend revalidate endpoint directly via HTTP...\n";
$response = Http::withHeaders(['x-revalidate-secret' => config('services.frontend_revalidate.secret')])
    ->post($url, ['tags' => ['feed:latest']]);

echo "Status: " . $response->status() . "\n";
echo "Body: " . $response->body() . "\n";
