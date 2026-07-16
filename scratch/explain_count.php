<?php
/**
 * EXPLAIN ANALYZE للاستعلامات البطيئة + مقارنة البدائل
 * تشغيل: php scratch/explain_count.php
 */

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

// category_id=43 (عربي-دولي) كما في الـ logs الإنتاجية
$categoryId = 43;
$locale     = 'ar';
$now        = now()->toDateTimeString();

function bench(string $label, callable $fn, int $runs = 3): void
{
    echo "\n". str_repeat('-', 70) ."\n";
    echo "  $label\n";
    echo str_repeat('-', 70) ."\n";

    $times = [];
    $result = null;
    for ($i = 0; $i < $runs; $i++) {
        $t = microtime(true);
        $result = $fn();
        $times[] = round((microtime(true) - $t) * 1000, 1);
    }
    $avg = round(array_sum($times) / count($times), 1);
    $min = min($times);

    echo "  Result : $result\n";
    echo "  Runs   : " . implode('ms, ', $times) . "ms\n";
    echo "  Avg    : {$avg}ms | Min: {$min}ms\n";
}

// ============================================================
// 1. EXPLAIN ANALYZE — الاستعلام الأصلي (OR EXISTS)
// ============================================================
echo "\n" . str_repeat('=', 70) . "\n";
echo "  EXPLAIN ANALYZE — ORIGINAL (OR EXISTS / orWhereHas)\n";
echo str_repeat('=', 70) . "\n";

$originalSQL = "
    SELECT count(*) AS `aggregate`
    FROM   `articles`
    WHERE  `status` = 'published'
      AND  `published_at` IS NOT NULL
      AND  `published_at` <= ?
      AND  `locale` = ?
      AND  (
               `primary_category_id` = ?
            OR EXISTS (
                   SELECT *
                   FROM   `categories`
                   INNER JOIN `article_category`
                           ON `categories`.`id` = `article_category`.`category_id`
                   WHERE  `articles`.`id` = `article_category`.`article_id`
                     AND  `categories`.`id` = ?
                     AND  `categories`.`deleted_at` IS NULL
               )
           )
      AND  `articles`.`deleted_at` IS NULL
";

try {
    $explain = DB::select("EXPLAIN ANALYZE " . $originalSQL, [$now, $locale, $categoryId, $categoryId]);
    foreach ($explain as $row) {
        $val = reset((array)$row);
        echo $val . "\n";
    }
} catch (\Throwable $e) {
    // Fallback to regular EXPLAIN if ANALYZE not supported
    echo "  EXPLAIN ANALYZE not supported, falling back to EXPLAIN FORMAT=TREE\n";
    try {
        $explain = DB::select("EXPLAIN FORMAT=TREE " . $originalSQL, [$now, $locale, $categoryId, $categoryId]);
        foreach ($explain as $row) {
            $val = reset((array)$row);
            echo $val . "\n";
        }
    } catch (\Throwable $e2) {
        $explain = DB::select("EXPLAIN " . $originalSQL, [$now, $locale, $categoryId, $categoryId]);
        foreach ($explain as $row) {
            echo json_encode((array)$row, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
        }
    }
}

// ============================================================
// 2. EXPLAIN — UNION ALL rewrite
// ============================================================
echo "\n" . str_repeat('=', 70) . "\n";
echo "  EXPLAIN — UNION ALL rewrite\n";
echo str_repeat('=', 70) . "\n";

$unionSQL = "
    SELECT count(*) AS `aggregate` FROM (
        SELECT a.id
        FROM   articles a
        WHERE  a.status = 'published'
          AND  a.published_at IS NOT NULL
          AND  a.published_at <= ?
          AND  a.locale = ?
          AND  a.primary_category_id = ?
          AND  a.deleted_at IS NULL

        UNION

        SELECT a.id
        FROM   articles a
        INNER JOIN article_category ac ON ac.article_id = a.id
        INNER JOIN categories c        ON c.id = ac.category_id
        WHERE  a.status = 'published'
          AND  a.published_at IS NOT NULL
          AND  a.published_at <= ?
          AND  a.locale = ?
          AND  c.id = ?
          AND  c.deleted_at IS NULL
          AND  a.deleted_at IS NULL
    ) AS unioned
";

try {
    $explain = DB::select("EXPLAIN FORMAT=TREE " . $unionSQL,
        [$now, $locale, $categoryId, $now, $locale, $categoryId]);
    foreach ($explain as $row) {
        $val = reset((array)$row);
        echo $val . "\n";
    }
} catch (\Throwable $e) {
    $explain = DB::select("EXPLAIN " . $unionSQL,
        [$now, $locale, $categoryId, $now, $locale, $categoryId]);
    foreach ($explain as $row) {
        echo json_encode((array)$row, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    }
}

// ============================================================
// 3. Timing benchmarks (3 runs each)
// ============================================================
echo "\n" . str_repeat('=', 70) . "\n";
echo "  TIMING BENCHMARKS (3 warm runs each)\n";
echo str_repeat('=', 70) . "\n";

// ── A. Original OR EXISTS
bench("A) Original COUNT — OR EXISTS (orWhereHas)", function () use ($now, $locale, $categoryId) {
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

// ── B. UNION (deduplication via UNION, not UNION ALL)
bench("B) UNION rewrite (dedup via UNION)", function () use ($now, $locale, $categoryId) {
    $row = DB::selectOne("
        SELECT count(*) AS cnt FROM (
            SELECT id FROM articles
            WHERE  status = 'published' AND published_at IS NOT NULL
              AND  published_at <= ? AND locale = ?
              AND  primary_category_id = ? AND deleted_at IS NULL
            UNION
            SELECT a.id FROM articles a
            INNER JOIN article_category ac ON ac.article_id = a.id
            INNER JOIN categories c        ON c.id = ac.category_id
            WHERE  a.status = 'published' AND a.published_at IS NOT NULL
              AND  a.published_at <= ? AND a.locale = ?
              AND  c.id = ? AND c.deleted_at IS NULL AND a.deleted_at IS NULL
        ) AS u
    ", [$now, $locale, $categoryId, $now, $locale, $categoryId]);
    return $row->cnt;
});

// ── C. JOIN with DISTINCT
bench("C) JOIN + DISTINCT rewrite", function () use ($now, $locale, $categoryId) {
    $row = DB::selectOne("
        SELECT count(DISTINCT a.id) AS cnt
        FROM   articles a
        LEFT JOIN article_category ac ON ac.article_id = a.id
        LEFT JOIN categories c        ON c.id = ac.category_id AND c.deleted_at IS NULL
        WHERE  a.status = 'published'
          AND  a.published_at IS NOT NULL
          AND  a.published_at <= ?
          AND  a.locale = ?
          AND  (a.primary_category_id = ? OR c.id = ?)
          AND  a.deleted_at IS NULL
    ", [$now, $locale, $categoryId, $categoryId]);
    return $row->cnt;
});

// ── D. No COUNT at all (simplePaginate simulation — only check has_next_page)
bench("D) No COUNT — exists() check only (does next page exist?)", function () use ($now, $locale, $categoryId) {
    // Simulate simplePaginate: just check if total > page*perPage
    $perPage = 18;
    $page    = 1;
    $offset  = ($page - 1) * $perPage;

    $hasMore = DB::table('articles')
        ->where('status', 'published')
        ->whereNotNull('published_at')
        ->where('published_at', '<=', $now)
        ->where('locale', $locale)
        ->where(function ($q) use ($categoryId) {
            $q->where('primary_category_id', $categoryId)
              ->orWhereExists(function ($sub) use ($categoryId) {
                  $sub->from('article_category as ac')
                      ->join('categories as c', 'c.id', '=', 'ac.category_id')
                      ->whereColumn('ac.article_id', 'articles.id')
                      ->where('c.id', $categoryId)
                      ->whereNull('c.deleted_at');
              });
        })
        ->whereNull('deleted_at')
        ->offset($offset + $perPage)
        ->limit(1)
        ->exists();

    return $hasMore ? 'has_more_pages' : 'last_page';
});

// ── E. EXISTS check on article_category index only (no categories join)
bench("E) Optimized: EXISTS on article_category only (skip categories join)", function () use ($now, $locale, $categoryId) {
    $row = DB::selectOne("
        SELECT count(*) AS cnt FROM (
            SELECT id FROM articles
            WHERE  status = 'published' AND published_at IS NOT NULL
              AND  published_at <= ? AND locale = ?
              AND  primary_category_id = ? AND deleted_at IS NULL
            UNION
            SELECT a.id FROM articles a
            INNER JOIN article_category ac ON ac.article_id = a.id
            WHERE  a.status = 'published' AND a.published_at IS NOT NULL
              AND  a.published_at <= ? AND a.locale = ?
              AND  ac.category_id = ? AND a.deleted_at IS NULL
        ) AS u
    ", [$now, $locale, $categoryId, $now, $locale, $categoryId]);
    return $row->cnt;
});

// ============================================================
// 4. Check existing indexes on articles and article_category
// ============================================================
echo "\n" . str_repeat('=', 70) . "\n";
echo "  INDEXES ON articles\n";
echo str_repeat('=', 70) . "\n";
$indexes = DB::select("SHOW INDEX FROM articles");
foreach ($indexes as $idx) {
    printf("  %-50s key_name=%-45s seq=%d\n",
        $idx->Column_name, $idx->Key_name, $idx->Seq_in_index);
}

echo "\n" . str_repeat('=', 70) . "\n";
echo "  INDEXES ON article_category\n";
echo str_repeat('=', 70) . "\n";
$indexes2 = DB::select("SHOW INDEX FROM article_category");
foreach ($indexes2 as $idx) {
    printf("  %-30s key_name=%-40s seq=%d\n",
        $idx->Column_name, $idx->Key_name, $idx->Seq_in_index);
}

echo "\n\nDone.\n";
