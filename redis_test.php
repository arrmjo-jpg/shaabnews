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

echo "\n==================== BEFORE FLUSH ====================\n";
$val = Cache::tags($tags)->get($key);
echo "Laravel Cache::get() -> " . ($val ? 'HIT ('.$val['status'].')' : 'MISS') . "\n";

$cachePrefix = config('cache.prefix');
$redisKeys = Redis::keys($cachePrefix . '*');
echo "\n--- Redis Raw Keys (Filtered) ---\n";
foreach($redisKeys as $rk) {
    if (strpos($rk, 'homepage') !== false || strpos($rk, 'tag') !== false) {
        $ttl = Redis::connection()->command('ttl', [$rk]);
        echo sprintf("KEY: %s | TTL: %s\n", $rk, $ttl);
    }
}

echo "\n==================== FLUSHING TAGS ====================\n";
Cache::tags([ArticleCacheTags::feed($locale)])->flush();
echo "Executed: Cache::tags(['articles:feed:ar'])->flush();\n";

echo "\n==================== AFTER FLUSH ====================\n";
$valAfter = Cache::tags($tags)->get($key);
echo "Laravel Cache::get() -> " . ($valAfter ? 'HIT ('.$valAfter['status'].')' : 'MISS') . "\n";

$redisKeysAfter = Redis::keys($cachePrefix . '*');
echo "\n--- Redis Raw Keys (Filtered) ---\n";
$orphanKeys = [];
foreach($redisKeysAfter as $rk) {
    if (strpos($rk, 'homepage') !== false || strpos($rk, 'tag') !== false) {
        $ttl = Redis::connection()->command('ttl', [$rk]);
        echo sprintf("KEY: %s | TTL: %s\n", $rk, $ttl);
        $orphanKeys[] = $rk;
    }
}

if (!empty($orphanKeys)) {
    echo "\n[WHY ARE KEYS STILL IN REDIS?]\n";
    echo "Laravel's Redis tag implementation does NOT delete keys on flush().\n";
    echo "Instead, it generates a unique UUID for each tag. When you flush a tag, it changes that tag's UUID.\n";
    echo "The cached item stores the tag UUIDs it was created with.\n";
    echo "When retrieving the item, Laravel compares the item's saved UUIDs against the current UUIDs in Redis.\n";
    echo "If they don't match, Laravel considers the item EXPIRED and returns MISS.\n";
    echo "The old raw keys are left in Redis to expire naturally via their original TTL (300s).\n";
}
