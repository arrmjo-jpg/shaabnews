<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Article;
use App\Models\User;
use App\Models\Category;
use App\Actions\Admin\Content\UpdateArticleAction;

$article = Article::with("categories", "tags")->first();
$user = User::first();
$action = new UpdateArticleAction();

echo "Initial Category ID: " . $article->primary_category_id . "\n";
echo "Initial Author ID: " . $article->author_id . "\n";
echo "Initial Tags: " . implode(", ", $article->tags->pluck("name")->all()) . "\n";
echo "Initial Editors Pick: " . ($article->is_editor_pick ? "Yes" : "No") . "\n";

// Change category
$newCategory = Category::where("id", "!=", $article->primary_category_id)->first();
$newAuthor = User::where("id", "!=", $article->author_id)->first();
$newTags = ["new_tag_1", "new_tag_2"];

echo "Updating Article...\n";
$action->handle($article, [
    "title" => $article->title . " - transition test", 
    "is_editor_pick" => !$article->is_editor_pick,
    "primary_category_id" => $newCategory->id,
    "tags" => $newTags,
    // Note: author_id is typically not updated directly via UpdateArticleAction in this simplified manner, but we will mock it just for the sake of checking the tag output if it were. Wait, UpdateArticleAction doesnt accept author_id in validated. Let me manually change it and save it.
], $user);

echo "Update Action Complete.\n";
echo "Please check the log files to ensure RevalidateFrontendCacheJob executed with all the transition tags.\n";

