<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Content;

use App\Enums\CategoryScope;
use App\Enums\CategoryStatus;
use App\Enums\SectionLayoutType;
use App\Http\Requests\BaseFormRequest;
use App\Models\Category;
use Illuminate\Validation\Rule;

class UpdateCategoryRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'min:2', 'max:150'],
            'locale' => ['sometimes', 'string', Rule::in(Category::LOCALES)],
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            // slug يدوي: نفس سياسة الإنشاء — الفرادة لكل لغة مع تجاهل
            // التصنيف الحالي. اللغة الفعّالة = طلب أو لغة التصنيف المربوط.
            'slug' => [
                'sometimes', 'nullable', 'string', 'max:160',
                'regex:/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u',
                Rule::unique('categories', 'slug')
                    ->where(fn ($q) => $q->where(
                        'locale',
                        $this->input('locale', $this->route('category')?->locale)
                    ))
                    ->ignore($this->route('category')?->getKey()),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:100'],
            'scope' => ['sometimes', Rule::in(CategoryScope::values())],
            'status' => ['sometimes', Rule::in(CategoryStatus::values())],
            'show_in_header' => ['sometimes', 'boolean'],
            'show_in_body' => ['sometimes', 'boolean'],
            'show_in_footer' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
            // Section Design System — بانر/عنوان/تخطيط/تصميم القسم على الواجهة العامة.
            'banner_media_id' => ['sometimes', 'nullable', 'integer', 'exists:media_assets,id'],
            'show_title' => ['sometimes', 'boolean'],
            'layout_type' => ['sometimes', Rule::in(SectionLayoutType::values())],
            'appearance' => ['sometimes', 'nullable', 'array'],
            // ربط تصنيف نوع رياضة بمزوّد بيانات (Approved Architecture Baseline v1.0 §0) —
            // provider_metadata عمداً بلا حقل نموذج هنا (بلا شكل مُعرَّف بعد، إداريّ تقنيّ فقط).
            'provider' => ['sometimes', 'nullable', 'string', 'max:50'],
            'external_id' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }
}
