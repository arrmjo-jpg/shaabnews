<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Article;
use App\Models\User;
use App\Actions\Admin\Content\UpdateArticleAction;
use Illuminate\Support\Facades\Event;
use Illuminate\Queue\Events\JobQueued;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Queue\Events\JobProcessed;

$article = Article::first();
$user = User::first();
$action = new UpdateArticleAction();

$startTime = microtime(true);
$logs = [];

Event::listen(JobQueued::class, function ($event) use (&$logs, $startTime) {
    $time = microtime(true) - $startTime;
    $logs[] = sprintf("%.2fms: JobQueued - %s", $time * 1000, get_class($event->job));
});

$result = $action->handle($article, ["title" => $article->title . " - test"], $user);

$time = microtime(true) - $startTime;
$logs[] = sprintf("%.2fms: Action Complete", $time * 1000);

echo implode("\n", $logs) . "\n";

