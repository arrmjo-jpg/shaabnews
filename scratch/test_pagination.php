<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Http\Request;
use App\Actions\Public\Content\ListPublicArticlesAction;

$action = app(ListPublicArticlesAction::class);

function testScenario($label, $queryParams) {
    global $action;
    echo "========================================================\n";
    echo "SCENARIO: $label\n";
    echo "Query: " . json_encode($queryParams, JSON_UNESCAPED_UNICODE) . "\n";
    
    $request = Request::create('/api/v1/ar/articles', 'GET', $queryParams);
    app()->instance('request', $request);
    
    try {
        $response = $action->handle('ar', $request);
        $data = $response->getData(true);
        if (isset($data['meta']['pagination'])) {
            echo "Status: OK | Type: Offset Pagination | Total: {$data['meta']['pagination']['total']} | Page: {$data['meta']['pagination']['current_page']}\n";
        } elseif (isset($data['meta']['cursor'])) {
            echo "Status: OK | Type: Cursor Pagination | Has More: " . ($data['meta']['cursor']['has_more'] ? 'Yes' : 'No') . "\n";
        } else {
            echo "Status: OK | Unknown format\n";
        }
    } catch (\Symfony\Component\HttpKernel\Exception\NotFoundHttpException $e) {
        echo "Status: 404 Not Found (Expected for page > max)\n";
        echo "Message: " . $e->getMessage() . "\n";
    } catch (\Throwable $e) {
        echo "Status: ERROR | " . get_class($e) . " | " . $e->getMessage() . "\n";
    }
    echo "\n";
}

\Illuminate\Support\Facades\Cache::flush();

testScenario("1. Regular category (page 1) - Should use UNION", ['filter' => ['category' => 'عربي-دولي'], 'page' => 1]);
testScenario("2. Regular category (page 50) - Should be fine", ['filter' => ['category' => 'عربي-دولي'], 'page' => 50]);
testScenario("3. Regular category (page 99) - Should be fine", ['filter' => ['category' => 'عربي-دولي'], 'page' => 99]);
testScenario("4. Regular category (page 100) - Should be fine", ['filter' => ['category' => 'عربي-دولي'], 'page' => 100]);
testScenario("5. Regular category (page 101) - Should throw 404", ['filter' => ['category' => 'عربي-دولي'], 'page' => 101]);
testScenario("6. Cursor Pagination on category - Should work infinitely", ['filter' => ['category' => 'عربي-دولي'], 'paginate' => 'cursor']);
testScenario("7. Category + Search (page 1) - Should NOT use UNION, but works", ['filter' => ['category' => 'عربي-دولي', 'q' => 'كورونا'], 'page' => 1]);
testScenario("8. Category + Tags (page 1) - Should NOT use UNION, but works", ['filter' => ['category' => 'عربي-دولي', 'tag' => 'تحديث'], 'page' => 1]);

