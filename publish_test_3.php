<?php
use App\Models\Article;
use App\Models\Category;

$category = Category::where('slug', 'local-news')->first() ?? Category::first();
$article = Article::find(990031); // The one created above

$query = Article::query()
    ->published()
    ->forLocale('ar')
    ->where(function ($q) use ($category) {
        $q->where('primary_category_id', $category->id)
          ->orWhereHas('categories', fn ($sub) => $sub->where('categories.id', $category->id));
    });

$results = $query->get();
$found = $results->contains('id', $article->id);

echo "\n--- QUERY RESULTS ---\n";
echo "Is the new article in the results? " . ($found ? "YES" : "NO") . "\n";

if (!$found) {
    echo "\n--- DIAGNOSING WHY IT WAS EXCLUDED ---\n";
    $isPublishedStatus = Article::where('id', $article->id)->where('status', 'published')->exists();
    $isNotNullPublishedAt = Article::where('id', $article->id)->whereNotNull('published_at')->exists();
    $isPastPublishedAt = Article::where('id', $article->id)->where('published_at', '<=', now())->exists();
    $isCorrectLocale = Article::where('id', $article->id)->where('locale', 'ar')->exists();
    
    echo "Fails Status Check ('published')? " . (!$isPublishedStatus ? "YES" : "NO") . "\n";
    echo "Fails Null Check (published_at NOT NULL)? " . (!$isNotNullPublishedAt ? "YES" : "NO") . "\n";
    echo "Fails Time Check (published_at <= now())? " . (!$isPastPublishedAt ? "YES" : "NO") . "\n";
    echo "Fails Locale Check ('ar')? " . (!$isCorrectLocale ? "YES" : "NO") . "\n";
} else {
    echo "The article IS present in the direct DB query immediately after publish.\n";
}
