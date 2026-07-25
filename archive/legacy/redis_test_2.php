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

$val = Cache::tags($tags)->get($key);
echo "Laravel Cache::get() -> " . ($val ? 'HIT' : 'MISS') . "\n";

echo "\n--- All Redis Raw Keys ---\n";
// Using the underlying connection to avoid auto-prefixing issues in different Redis clients
$client = Redis::connection()->client();
// If it's PhpRedis, it has keys(). If predis, also keys().
$allKeys = $client->keys('*');
foreach($allKeys as $rk) {
    if (strpos($rk, 'homepage') !== false || strpos($rk, 'tag') !== false || strpos($rk, 'article') !== false) {
        $ttl = $client->ttl($rk);
        echo sprintf("KEY: %s | TTL: %s\n", $rk, $ttl);
    }
}

echo "\n--- FLUSHING TAGS ---\n";
Cache::tags([ArticleCacheTags::feed($locale)])->flush();

$valAfter = Cache::tags($tags)->get($key);
echo "Laravel Cache::get() -> " . ($valAfter ? 'HIT' : 'MISS') . "\n";

echo "\n--- All Redis Raw Keys After Flush ---\n";
$allKeysAfter = $client->keys('*');
$orphanKeys = [];
foreach($allKeysAfter as $rk) {
    if (strpos($rk, 'homepage') !== false || strpos($rk, 'tag') !== false || strpos($rk, 'article') !== false) {
        $ttl = $client->ttl($rk);
        echo sprintf("KEY: %s | TTL: %s\n", $rk, $ttl);
        $orphanKeys[] = $rk;
    }
}
