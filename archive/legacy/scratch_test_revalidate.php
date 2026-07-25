<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$response = Http::withHeaders(["x-revalidate-secret" => config("services.frontend_revalidate.secret")])
    ->post(config("services.frontend_revalidate.url"), ["tags" => ["homepage"]]);

echo "Status: " . $response->status() . "\n";
echo "Body: " . $response->body() . "\n";

