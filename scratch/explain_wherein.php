<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;

$categoryId = 43;
$locale     = 'ar';
$now        = now()->toDateTimeString();

function bench($label, $fn) {
    echo "$label\n";
    $times = [];
    $res = null;
    for ($i = 0; $i < 3; $i++) {
        $t = microtime(true);
        $res = $fn();
        $times[] = round((microtime(true) - $t) * 1000, 1);
    }
    echo "  Result: $res\n";
    echo "  Times: " . implode('ms, ', $times) . "ms\n\n";
}

bench("WHERE IN ( UNION )", function () use ($now, $locale, $categoryId) {
    $row = DB::selectOne("
        SELECT count(*) AS cnt
        FROM   articles
        WHERE  status = 'published'
          AND  published_at IS NOT NULL
          AND  published_at <= ?
          AND  locale = ?
          AND  articles.id IN (
              SELECT id FROM articles WHERE primary_category_id = ?
              UNION
              SELECT article_id FROM article_category WHERE category_id = ?
          )
          AND  deleted_at IS NULL
    ", [$now, $locale, $categoryId, $categoryId]);
    return $row->cnt;
});

bench("WHERE IN ( UNION ) with explicit articles join", function () use ($now, $locale, $categoryId) {
    $row = DB::selectOne("
        SELECT count(*) AS cnt
        FROM   articles
        WHERE  status = 'published'
          AND  published_at IS NOT NULL
          AND  published_at <= ?
          AND  locale = ?
          AND  articles.id IN (
              SELECT a.id FROM articles a WHERE a.primary_category_id = ?
              UNION
              SELECT ac.article_id FROM article_category ac 
              INNER JOIN categories c ON c.id = ac.category_id
              WHERE ac.category_id = ? AND c.deleted_at IS NULL
          )
          AND  deleted_at IS NULL
    ", [$now, $locale, $categoryId, $categoryId]);
    return $row->cnt;
});

bench("Original OR EXISTS", function () use ($now, $locale, $categoryId) {
    $row = DB::selectOne("
        SELECT count(*) AS cnt
        FROM   articles
        WHERE  status = 'published'
          AND  published_at IS NOT NULL
          AND  published_at <= ?
          AND  locale = ?
          AND  (
                   primary_category_id = ?
                OR EXISTS (
                       SELECT 1
                       FROM   article_category ac
                       INNER JOIN categories c ON c.id = ac.category_id
                       WHERE  ac.article_id = articles.id
                         AND  c.id = ?
                         AND  c.deleted_at IS NULL
                   )
               )
          AND  deleted_at IS NULL
    ", [$now, $locale, $categoryId, $categoryId]);
    return $row->cnt;
});
