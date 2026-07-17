<?php

declare(strict_types=1);

namespace App\Support\Media;

use App\Enums\MediaVisibility;
use App\Models\MediaAsset;

/**
 * سياسة إلزامية العلامة المائية — منفصلة عمداً عن WatermarkSettings (التي تصف *كيف*
 * تُبنى العلامة عند تفعيلها). هذه الفئة تُجيب: *هل* هذا الأصل يجب أن يحمل علامة.
 *
 * اليوم كل أصل يمرّ عبر GenerateMediaAssetConversionsJob هو visibility=Public (مقالات/
 * معرض/مكتبة الوسائط العامة — StoreMediaAssetAction يضبطها ثابتة). الأفاتار (Spatie
 * MediaLibrary) والبراندنج (processing_status=NULL، لا Job يُشغَّل له) منفصلان بنيويًا
 * ولا يصلان هذا المسار إطلاقًا — فلا حاجة لاستثنائهما هنا صراحة. الحجز لـ Private
 * مستقبلي فقط (لا مسار حيّ ينشئه اليوم).
 */
final class WatermarkPolicy
{
    public static function isRequired(MediaAsset $asset): bool
    {
        return $asset->visibility === MediaVisibility::Public;
    }
}
