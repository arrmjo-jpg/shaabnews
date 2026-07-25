<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$response = Http::withHeaders(["x-revalidate-secret" => "alphacms_revalidate_dev_2026"])
    ->post("https://alpha-cms.shop/api/revalidate", ["tags" => ["homepage"]]);

echo "Status: " . $response->status() . "\n";
echo "Body: " . $response->body() . "\n";

