<?php
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use App\Support\Cache\ArticleCacheTags;
use App\Support\Cache\CacheKeys;

$locale = 'ar';
$tags = [ArticleCacheTags::ALL, ArticleCacheTags::feed($locale)];
$key = CacheKeys::publicHomepage($locale);

Cache::tags($tags)->flush();
Cache::tags($tags)->put($key, ['status' => 'fresh'], 300);

echo "\n--- All Redis Raw Keys (BEFORE FLUSH) ---\n";
$client = Redis::connection()->client();
$allKeys = $client->keys('*');
foreach($allKeys as $rk) {
    $ttl = $client->ttl($rk);
    echo sprintf("KEY: %s | TTL: %s\n", $rk, $ttl);
}

echo "\n--- EXECUTING: Cache::tags(['articles:feed:ar'])->flush() ---\n";
Cache::tags([ArticleCacheTags::feed($locale)])->flush();

echo "\n--- All Redis Raw Keys (AFTER FLUSH) ---\n";
$allKeysAfter = $client->keys('*');
foreach($allKeysAfter as $rk) {
    $ttl = $client->ttl($rk);
    echo sprintf("KEY: %s | TTL: %s\n", $rk, $ttl);
}
