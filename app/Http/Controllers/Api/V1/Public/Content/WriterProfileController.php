<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public\Content;

use App\Actions\Public\Content\ShowPublicWriterAction;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use App\Actions\Public\Content\ListPublicWritersAction;
use Illuminate\Http\Request;

/**
 * بروفيل كاتب عامّ — `GET /{locale}/writers/{id}`. البوّابة (is_writer نشِط) في الـ Action.
 * locale معامل مسار فقط (بيانات الكاتب مستقلّة عن اللغة).
 */
class WriterProfileController extends Controller
{
    public function index(Request $request, string $locale): JsonResponse
    {
        return (new ListPublicWritersAction)->handle(
            filters: $request->all(),
            page: (int) $request->input('page', 1),
            perPage: (int) $request->input('per_page', 24),
            sort: $request->input('sort', '-last_activity_at')
        );
    }

    public function show(string $locale, int $id): JsonResponse
    {
        return (new ShowPublicWriterAction)->handle($id);
    }
}
