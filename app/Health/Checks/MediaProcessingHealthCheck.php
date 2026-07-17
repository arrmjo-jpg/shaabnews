<?php

declare(strict_types=1);

namespace App\Health\Checks;

use App\Enums\MediaVisibility;
use App\Models\MediaAsset;
use App\Support\Media\WatermarkSettings;
use Spatie\Health\Checks\Check;
use Spatie\Health\Checks\Result;

/**
 * مراقبة صحّة خط معالجة الوسائط (Phase 5 — تشخيص؛ وسّعت لاحقًا لـ Media Pipeline
 * Hardening بفحصَي العلامة المائية أدناه).
 *
 * - عالقة في processing/normalizing أطول من العتبة ⇒ فشل صحّي (عامل الطابور معطّل
 *   أو مهمة معلّقة) — أخطر إشارة، تُنبِّه المشغّل فوراً.
 * - فشل ترميز كثير خلال 24 ساعة ⇒ تحذير صحّي (مشكلة متكرّرة تستحق النظر).
 * - watermark_enabled مفعّل لكن ملف الشعار غير قابل للحلّ ⇒ فشل صحّي (كان هذا
 *   يفشل بصمت تام قبل هذا الإصلاح — لا أثر له في أي سجلّ سوى هذا الفحص).
 * - أصول عامة (visibility=Public) جاهزة خلال 24 ساعة بلا مشتقّ watermarked رغم
 *   إلزاميّته ⇒ تحذير صحّي (فجوة إعداد سُجِّلت بتحذير في MediaConversions لكنها
 *   لم تُسقِط المعالجة — يستحق نظر المشغّل).
 *
 * يُعرَض عبر نقطة /system/health المحمية ويُشغَّل ضمن health:check المجدوَل،
 * فتنطلق إشعارات الفشل (mail/slack) المضبوطة في config/health.php.
 */
class MediaProcessingHealthCheck extends Check
{
    public function run(): Result
    {
        $stuckMinutes = (int) config('performance.media.stuck_processing_minutes', 60);
        $failThreshold = (int) config('performance.media.failed_alert_threshold', 10);

        $stuck = MediaAsset::query()
            ->whereIn('processing_status', ['processing', 'normalizing'])
            ->where('updated_at', '<', now()->subMinutes($stuckMinutes))
            ->count();

        $failed = MediaAsset::query()
            ->where('processing_status', 'failed')
            ->where('updated_at', '>=', now()->subDay())
            ->count();

        $watermarkMisconfigured = WatermarkSettings::current() !== null
            && WatermarkSettings::resolveLogoPath() === null;

        $missingMandatoryWatermark = MediaAsset::query()
            ->where('processing_status', 'ready')
            ->where('visibility', MediaVisibility::Public)
            ->where('updated_at', '>=', now()->subDay())
            ->whereIn('mime_type', ['image/jpeg', 'image/png', 'image/webp'])
            ->whereJsonDoesntContain('conversions', null) // ensures conversions is non-null JSON
            ->whereRaw("JSON_CONTAINS_PATH(conversions, 'one', '$.watermarked') = 0")
            ->count();

        $result = Result::make()
            ->meta([
                'stuck_processing' => $stuck,
                'failed_24h' => $failed,
                'watermark_misconfigured' => $watermarkMisconfigured,
                'missing_mandatory_watermark_24h' => $missingMandatoryWatermark,
            ])
            ->shortSummary("{$failed} failed / {$stuck} stuck");

        if ($stuck > 0) {
            return $result->failed(
                "{$stuck} media asset(s) stuck in processing/normalizing for >{$stuckMinutes}m — the media queue worker may be down."
            );
        }

        if ($watermarkMisconfigured) {
            return $result->failed(
                'watermark_enabled is true but the configured watermark image cannot be resolved on disk — all public content is silently missing its mandatory watermark.'
            );
        }

        if ($missingMandatoryWatermark > 0) {
            return $result->warning(
                "{$missingMandatoryWatermark} public media asset(s) went ready in the last 24h without their mandatory watermark."
            );
        }

        if ($failed >= $failThreshold) {
            return $result->warning("{$failed} media transcode(s) failed in the last 24h.");
        }

        return $result->ok('Media processing healthy.');
    }
}
