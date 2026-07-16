<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Article;
use App\Models\Category;
use App\Models\User;
use App\Support\Frontend\FrontendCacheTags;

$article = Article::with("categories", "tags")->first();
$oldAuthorId = 999;
$oldTags = ["old_tag_1", "old_tag_2"];
$oldCategorySlugs = ["old-category-slug"];

$article->is_editor_pick = true;
$article->save();
$article->is_editor_pick = false; 
$article->save();

$tags = FrontendCacheTags::article(
    $article, 
    "old-slug", 
    $oldCategorySlugs, 
    $oldTags, 
    $oldAuthorId
);

echo implode("\n", $tags);

