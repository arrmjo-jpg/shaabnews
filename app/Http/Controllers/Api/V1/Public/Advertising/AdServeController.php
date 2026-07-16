<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public\Advertising;

use App\Actions\Public\Advertising\RedirectAdClickAction;
use App\Actions\Public\Advertising\ServeAdAction;
use App\Actions\Public\Advertising\ServeAdBatchAction;
use App\Actions\Public\Advertising\TrackAdClickAction;
use App\Actions\Public\Advertising\TrackAdImpressionAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\Advertising\TrackAdClickRequest;
use App\Http\Requests\Public\Advertising\TrackAdImpressionRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * سطح الخدمة العام للإعلانات (Batch 5) — تحكّم رفيع (يستدعي الـ Actions فقط).
 *   • serve: اختيار في الخادم مُكاش على الحافة بنافذة الدلو.
 *   • impression: تأكيد العرض الفعليّ بمنارة العميل (served != rendered).
 *   • click: تحويل موقّع لوجهة مُخزَّنة آمنة (لا open redirect).
 * حدّ المعدّل على المسارات؛ تصفية البوتات وفحص الرمز في طبقة الخدمة.
 */
class AdServeController extends Controller
{
    public function serve(Request $request, string $zoneKey): JsonResponse
    {
        return (new ServeAdAction)->handle($zoneKey, $request);
    }

    /** دفعة: كلّ مساحات الصفحة في استجابة واحدة (GET /ads?page=&locale=&device=). */
    public function batch(Request $request): JsonResponse
    {
        return (new ServeAdBatchAction)->handle($request);
    }

    public function impression(TrackAdImpressionRequest $request): JsonResponse
    {
        return (new TrackAdImpressionAction)->handle((string) $request->validated('token'), $request);
    }

    public function trackClick(TrackAdClickRequest $request): JsonResponse
    {
        return (new TrackAdClickAction)->handle((string) $request->validated('token'), $request);
    }

    public function click(Request $request, string $token): Response
    {
        return (new RedirectAdClickAction)->handle($token, $request);
    }
}
