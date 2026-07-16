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
 * دفعة عرض الإعلانات (GET /ads?page=&locale=&device=). تُعيد **كلّ مساحات الصفحة في استجابة واحدة**
 * (chrome + مساحات الصفحة من config/advertising.pages) بدل طلب لكل مساحة. الاختيار والتتبّع والرموز
 * تتمّ بنفس المحرّك تماماً (AdServer::serve + AdResponseBuilder) ضمن دلوٍ واحد — لا تغيير في الاستهداف
 * أو التدوير أو النافذة الزمنية. مُكاش على الحافة بنافذة الدلو (نفس ترويسة نقطة العرض المفردة).
 *
 * الواجهة تمرّر page فقط (فصل تامّ عن أسماء المساحات). zones= الصريح يُغلِّبها لصفحات نادرة بمساحة/اثنتين.
 */
final class ServeAdBatchAction
{
    public function handle(Request $request): JsonResponse
    {
        $locale = $this->resolveLocale($request);
        $device = AdDeviceClass::fromString($this->queryString($request, 'device'))->value;
        $bucket = AdBucket::current();

        $ads = [];
        foreach ($this->resolveZones($request) as $zoneKey) {
            $candidate = AdServer::serve($zoneKey, $locale, $device, $bucket);
            $ads[$zoneKey] = $candidate !== null
                ? AdResponseBuilder::build((int) $candidate['placement_id'], $bucket)
                : null;
        }

        $window = AdBucket::window();

        // نفس عقد نقطة العرض المفردة: max-age = نافذة الدلو (لا stale) ليبقى رمز كلّ إعلان ضمن نافذة قبوله.
        return ApiResponse::success(
            data: ['bucket' => $bucket, 'zones' => $ads],
            meta: ['expires_in' => $window],
        )->header('Cache-Control', sprintf('public, max-age=%d, s-maxage=%d', $window, $window));
    }

    /**
     * مساحات الطلب: zones= الصريح (يُغلِّب) وإلا خريطة الصفحة (chrome + page). مُزال التكرار، مُصفّى
     * المفاتيح، ومحدود بسقف صارم (حارس حجم).
     *
     * @return array<int,string>
     */
    private function resolveZones(Request $request): array
    {
        $explicit = $this->queryString($request, 'zones');
        if ($explicit !== null && $explicit !== '') {
            $keys = array_map('trim', explode(',', $explicit));
        } else {
            $page = (string) ($this->queryString($request, 'page') ?? '');
            $pages = (array) config('advertising.pages', []);
            $keys = array_merge(
                (array) ($pages['chrome'] ?? []),
                (array) ($pages[$page] ?? []),
            );
        }

        $keys = array_values(array_unique(array_filter(
            $keys,
            static fn ($k): bool => is_string($k) && preg_match('/^[a-z0-9_]+$/', $k) === 1,
        )));

        $max = max(1, (int) config('advertising.serve.max_zones_per_batch', 40));

        return array_slice($keys, 0, $max);
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
