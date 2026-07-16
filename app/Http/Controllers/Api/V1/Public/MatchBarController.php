<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Actions\Public\Sport\BuildMatchBarAction;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class MatchBarController extends Controller
{
    public function show(BuildMatchBarAction $action): JsonResponse
    {
        return $action->handle();
    }
}
