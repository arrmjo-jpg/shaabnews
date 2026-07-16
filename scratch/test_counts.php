<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use App\Models\Category;

$locale = 'ar';
$now = now()->toDateTimeString();

$categories = Category::where('locale', $locale)->limit(10)->get();

echo "Testing COUNT equality for 10 categories...\n";
$allMatch = true;

foreach ($categories as $cat) {
    // 1. Original OR EXISTS
    $row1 = DB::selectOne("
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
    ", [$now, $locale, $cat->id, $cat->id]);
    $origCount = $row1->cnt;

    // 2. UNION Rewrite
    $unionSql = "
        SELECT id FROM articles
        WHERE status = 'published' AND published_at IS NOT NULL
          AND published_at <= ? AND locale = ?
          AND primary_category_id = ? AND deleted_at IS NULL
        UNION
        SELECT a.id FROM articles AS a
        INNER JOIN article_category AS ac ON ac.article_id = a.id
        INNER JOIN categories AS c        ON c.id = ac.category_id
        WHERE a.status = 'published' AND a.published_at IS NOT NULL
          AND a.published_at <= ? AND a.locale = ?
          AND c.id = ? AND c.deleted_at IS NULL AND a.deleted_at IS NULL
    ";
    
    $unionCount = DB::table(DB::raw("({$unionSql}) as unioned"))
        ->setBindings([$now, $locale, $cat->id, $now, $locale, $cat->id])
        ->count();

    echo "Category: {$cat->slug} | Orig: $origCount | Union: $unionCount | Diff: " . ($origCount - $unionCount) . "\n";
    if ($origCount !== $unionCount) {
        $allMatch = false;
        echo "  -> MISMATCH DETECTED!\n";
    }
}

echo $allMatch ? "All counts match perfectly! ✅\n" : "There were mismatches ❌\n";

