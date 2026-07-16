<?php
use App\Models\Article;
use App\Models\Category;
use App\Models\User;
use App\Actions\Admin\Content\TransitionArticleStatusAction;
use App\Actions\Public\Content\ListPublicArticlesAction;
use Illuminate\Http\Request;

echo "--- STARTING LARAVEL PUBLISH LIFECYCLE TEST ---\n";

// 1. Setup Data
$user = User::first();
$category = Category::where('slug', 'local-news')->first() ?? Category::first();
$uniqueTitle = "Test Publish " . time();

// 2. Create Draft Article directly to bypass complex action validation
$article = new Article([
    'title' => $uniqueTitle,
    'slug' => \Illuminate\Support\Str::slug($uniqueTitle),
    'content' => 'Test content',
    'content_json' => ['type' => 'doc', 'content' => []],
    'excerpt' => 'Test',
    'locale' => 'ar',
    'type' => 'news',
    'status' => 'draft',
    'primary_category_id' => $category->id,
    'author_id' => $user->id,
]);
$article->save();
$article->categories()->sync([$category->id]);

echo "Draft Article created with ID: {$article->id}\n";
echo "Status before publish: {$article->status->value}\n";
echo "Published At before publish: " . ($article->published_at ? $article->published_at->toDateTimeString() : 'NULL') . "\n";

// 3. Publish Article using the real Action
$transitionAction = new TransitionArticleStatusAction();
$transitionAction->handle($article, ['status' => 'published'], clone $user);

// Refresh from DB
$article = $article->fresh();

echo "\n--- AFTER PUBLISH ---\n";
echo "1. Status: {$article->status->value}\n";
echo "2. Published At: " . ($article->published_at ? $article->published_at->toDateTimeString() . " (Micro: " . $article->published_at->format('u') . ")" : 'NULL') . "\n";
echo "   Current DB Time: " . \Illuminate\Support\Facades\DB::select('SELECT NOW() as n')[0]->n . "\n";
echo "   Current PHP Time: " . now()->toDateTimeString() . " (Micro: " . now()->format('u') . ")\n";

// 4. Test Queries (Bypassing Redis Cache entirely by running the eloquent query directly)
$query = Article::query()
    ->published()
    ->forLocale('ar')
    ->where(function ($q) use ($category) {
        $q->where('primary_category_id', $category->id)
          ->orWhereHas('categories', fn ($sub) => $sub->where('categories.id', $category->id));
    });

$sql = $query->toSql();
$bindings = $query->getBindings();

$results = $query->get();
$found = $results->contains('id', $article->id);

echo "\n--- QUERY RESULTS ---\n";
echo "Is the new article in the results? " . ($found ? "YES" : "NO") . "\n";

if (!$found) {
    echo "\n--- DIAGNOSING WHY IT WAS EXCLUDED ---\n";
    // Check which scope failed
    $isPublishedStatus = Article::where('id', $article->id)->where('status', 'published')->exists();
    $isNotNullPublishedAt = Article::where('id', $article->id)->whereNotNull('published_at')->exists();
    $isPastPublishedAt = Article::where('id', $article->id)->where('published_at', '<=', now())->exists();
    $isCorrectLocale = Article::where('id', $article->id)->where('locale', 'ar')->exists();
    
    echo "Fails Status Check ('published')? " . (!$isPublishedStatus ? "YES" : "NO") . "\n";
    echo "Fails Null Check (published_at NOT NULL)? " . (!$isNotNullPublishedAt ? "YES" : "NO") . "\n";
    echo "Fails Time Check (published_at <= now())? " . (!$isPastPublishedAt ? "YES" : "NO") . "\n";
    echo "Fails Locale Check ('ar')? " . (!$isCorrectLocale ? "YES" : "NO") . "\n";
    
    // Explicitly test the time condition right now
    $db_val = \Illuminate\Support\Facades\DB::select("SELECT published_at FROM articles WHERE id = ?", [$article->id])[0]->published_at;
    echo "Raw DB published_at: {$db_val}\n";
    
} else {
    echo "The article IS present in the direct DB query immediately after publish.\n";
}

// Cleanup
$article->forceDelete();
