<?php

declare(strict_types=1);

namespace App\Settings;

use Spatie\LaravelSettings\Settings;

/**
 * قاعدة مشتركة لإعدادات "أشرطة البطولات" (Match Bar، Sports Home Bar، وأي شريط مماثل لاحقًا) —
 * مفتاح تفعيل/تعطيل واحد فقط لكلّ ميزة. أيّ بطولة تظهر أو تُخفى تُقرَّر عبر عمود مستقلّ بجدول
 * Competition (راجع BuildCompetitionBarAction)، لا عبر إعداد هنا. كلّ ميزة abstract class خاصّ
 * بها فقط لتحديد group() — الحقول والسلوك مشتركان بالكامل.
 */
abstract class BarSettings extends Settings
{
    public bool $enabled;
}
