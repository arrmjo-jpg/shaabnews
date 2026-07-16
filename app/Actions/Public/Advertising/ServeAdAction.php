<?php

declare(strict_types=1);

namespace App\Actions\Public\Advertising;

use App\Enums\AdDeviceClass;
use App\Models\AdZone;
use App\Support\Advertising\AdBucket;
use App\Support\Advertising\AdResponseBuilder;
use App\Support\Advertising\AdServer;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * نقطة العرض العامة (GET /ads/serve/{zoneKey}). الاختيار في الخادم حتميّ ضمن الدلو
 * الزمني الحالي (مُكاش على الحافة بنافذة الدلو). لا تحتسب انطباعاً — الانطباع يؤكَّد
 * بمنارة العميل (served != rendered). تُعيد: الإبداع المختار + بيانات العرض + رمز
 * منارة الانطباع + رابط نقرة موقّع (إن كان للإبداع وجهة آمنة).
 *
 * التجزئة (zone, locale, device) عبر معاملات الاستعلام ⇒ مفتاح كاش الحافة يميّزها تلقائياً.
 */
final class ServeAdAction
{
    public function handle(string $zoneKey, Request $request): JsonResponse
    {
        $locale = $this->resolveLocale($request);
        $device = AdDeviceClass::fromString($this->queryString($request, 'device'))->value;
        $bucket = AdBucket::current();

        $candidate = AdServer::serve($zoneKey, $locale, $device, $bucket);
        $ad = $candidate !== null ? AdResponseBuilder::build((int) $candidate['placement_id'], $bucket) : null;

        $window = AdBucket::window();

        // لا stale-while-revalidate (V4): تقديم نسخة قديمة بعد max-age قد يُرجِع استجابةً
        // رمزُها خرج من نافذة الدلو (±1) فيُرفَض انطباعها ⇒ احتساب ناقص. نحصر عمر النسخة
        // المُقدَّمة بـ max-age (= نافذة الدلو) ليبقى الرمز ضمن نافذة قبوله.
        return ApiResponse::success(
            data: ['zone' => $zoneKey, 'bucket' => $bucket, 'ad' => $ad],
            meta: ['expires_in' => $window],
        )->header('Cache-Control', sprintf(
            'public, max-age=%d, s-maxage=%d',
            $window,
            $window,
        ));
    }

    private function resolveLocale(Request $request): string
    {
        $locale = $this->queryString($request, 'locale');

        return $locale !== null && in_array($locale, AdZone::LOCALES, true) ? $locale : 'ar';
    }

    /** معامل استعلام نصّيّ آمن (يتجاهل المصفوفات/القيم غير النصّية). */
    private function queryString(Request $request, string $key): ?string
    {
        $value = $request->query($key);

        return is_string($value) ? $value : null;
    }
}
