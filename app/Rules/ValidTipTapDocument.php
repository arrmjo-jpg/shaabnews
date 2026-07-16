<?php

declare(strict_types=1);

namespace App\Rules;

use App\Support\Content\TipTapSanitizer;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * يرفض أي مستند TipTap يحوي عقدة/علامة/سمة غير مسموحة (P4-D1).
 */
class ValidTipTapDocument implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // يُقبل المحتوى الصالح، أو القابل للتعقيم إلى صالح: مخرجات المحرّر قد تحوي عُقَدًا
        // فارغة/روابط ملوّثة يُصلحها/يُسقِطها clean (والـ Action يخزّن الناتج النظيف).
        // ما لا يُعقَّم (أنواع/علامات/سمات مجهولة أو خطرة) يبقى مرفوضاً (clean يُبقيها فيرفضها validate).
        if (! is_array($value) || ! TipTapSanitizer::validate(TipTapSanitizer::clean($value))) {
            $fail(__('article.invalid_content'));
        }
    }
}
