<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Article;
use App\Support\Frontend\FrontendCacheTags;

$article = Article::first();
echo "Base Tags:\n";
print_r(FrontendCacheTags::article($article));

$article->is_featured = true;
echo "\nFeatured Tags:\n";
print_r(FrontendCacheTags::article($article));

$article->is_header = true;
echo "\nHeader Tags:\n";
print_r(FrontendCacheTags::article($article));

