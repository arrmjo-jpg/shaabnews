<?php

declare(strict_types=1);

namespace App\Support\Advertising;

use App\Enums\AdCreativeType;
use App\Models\AdCreative;
use App\Models\AdPlacement;

/**
 * يبني حمولة الإعلان المُقدَّمة (الإبداع المختار + بيانات العرض + رمز منارة الانطباع + رابط نقرة
 * موقّع) لإسنادٍ محدَّد ضمن دلوٍ زمنيّ. **مصدر واحد** لشكل الاستجابة يستعمله كلٌّ من نقطة العرض
 * المفردة (ServeAdAction) والدفعة (ServeAdBatchAction) — فالمنطق والتتبّع والرموز متطابقة تماماً.
 *
 * إعادة التحقّق وقت العرض (V3): تُقيَّم أهليّة الحملة على الساعة الحاليّة لا على لحظة بناء البِركة
 * المُكاشة — فلا تُعرَض حملة انتهت/لم تبدأ نافذتها (أو صارت غير نشطة) خلال عمر البِركة.
 */
final class AdResponseBuilder
{
    /** @return array<string,mixed>|null */
    public static function build(int $placementId, int $bucket): ?array
    {
        // البِركة مُكاشة (حتى pool_ttl)؛ نُعيد التحقّق من الحياة وقت العرض ونحلّ بيانات العرض.
        $placement = AdPlacement::query()
            ->whereKey($placementId)
            ->where('is_active', true)
            ->with([
                'creative' => fn ($q) => $q->where('is_active', true),
                'creative.campaign',
                'creative.mediaAsset',
                'zone:id,width,height',
            ])
            ->first(['id', 'ad_creative_id', 'ad_zone_id']);

        $creative = $placement?->creative;
        if ($placement === null || $creative === null) {
            return null; // عُطِّل/حُذِف بعد بناء البِركة — تدهور رشيق (لا إعلان).
        }

        if ($creative->campaign === null || ! $creative->campaign->isServable()) {
            return null;
        }

        $render = self::render($creative);
        if ($render === null) {
            return null; // وسيط مفقود لإبداع صورة — لا نعرض إعلاناً مكسوراً.
        }

        $token = AdBeaconToken::issue((int) $placement->id, (int) $placement->ad_zone_id, $bucket);

        $ad = [
            'placement_id' => (int) $placement->id,
            'creative_id' => (int) $creative->id,
            'type' => $creative->type->value,
            'width' => $placement->zone?->width,
            'height' => $placement->zone?->height,
            'render' => $render,
            'impression' => [
                'token' => $token,
                'url' => url('/api/v1/ads/track/impression'),
            ],
        ];

        // النقرة موقّعة وتُحلّ وجهتها في الخادم (لا open redirect) — تُتاح فقط حين وجود وجهة آمنة.
        if (AdUrlSafety::isSafe($creative->landing_url)) {
            $ad['click'] = [
                'token' => $token,
                'url' => url('/api/v1/ads/click/'.$token),
            ];
        }

        return $ad;
    }

    /** @return array<string,mixed>|null */
    private static function render(AdCreative $creative): ?array
    {
        return match ($creative->type) {
            AdCreativeType::Image => self::imageRender($creative),
            AdCreativeType::Html => ['html' => (string) $creative->html_code],
            default => null, // video غير مُفعّل في هذه المرحلة
        };
    }

    /** @return array<string,mixed>|null */
    private static function imageRender(AdCreative $creative): ?array
    {
        $url = $creative->mediaAsset?->url();
        if ($url === null || $url === '') {
            return null;
        }

        return [
            'image_url' => $url,
            'alt' => (string) $creative->alt_text,
        ];
    }
}
