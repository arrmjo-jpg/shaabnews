<?php
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use App\Support\Cache\ArticleCacheTags;
use App\Support\Cache\CacheKeys;

$locale = 'ar';
$tags = [ArticleCacheTags::ALL, ArticleCacheTags::feed($locale)];
$key = CacheKeys::publicHomepage($locale);

// Make sure we have a clean slate for the test
Cache::tags($tags)->flush();
Cache::tags($tags)->put($key, ['status' => 'fresh_test_data'], 300);

echo "\n--- All Redis Raw Keys (BEFORE FLUSH) ---\n";
// CACHE uses database 1, not 0
$client = Redis::connection('cache')->client();
$allKeys = $client->keys('*');
foreach($allKeys as $rk) {
    if (strpos($rk, 'homepage') !== false || strpos($rk, 'tag') !== false) {
        $ttl = $client->ttl($rk);
        echo sprintf("KEY: %s | TTL: %s\n", $rk, $ttl);
    }
}

echo "\n--- EXECUTING: Cache::tags(['articles:feed:ar'])->flush() ---\n";
Cache::tags([ArticleCacheTags::feed($locale)])->flush();

echo "\n--- All Redis Raw Keys (AFTER FLUSH) ---\n";
$allKeysAfter = $client->keys('*');
$orphanKeys = [];
foreach($allKeysAfter as $rk) {
    if (strpos($rk, 'homepage') !== false || strpos($rk, 'tag') !== false) {
        $ttl = $client->ttl($rk);
        echo sprintf("KEY: %s | TTL: %s\n", $rk, $ttl);
        $orphanKeys[] = $rk;
    }
}

if (!empty($orphanKeys)) {
    echo "\n[WHY ARE KEYS STILL IN REDIS?]\n";
    echo "Laravel's Redis tag implementation does NOT delete keys on flush().\n";
    echo "Instead, it generates a unique UUID for each tag. When you flush a tag, it changes that tag's UUID in Redis.\n";
    echo "The cached item stores the tag UUIDs it was created with.\n";
    echo "When retrieving the item, Laravel compares the item's saved UUIDs against the current UUIDs in Redis.\n";
    echo "If they don't match, Laravel considers the item EXPIRED and returns MISS.\n";
    echo "The old raw keys are left in Redis to expire naturally via their original TTL (300s).\n";
    echo "This is why you still see the keys counting down from 300s, even though Laravel correctly considers them FLUSHED.\n";
}
