<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Sport;

use App\Http\Requests\BaseFormRequest;
use App\Models\Category;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

class UpdateSportMenuItemRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true; // الصلاحية مفروضة عبر middleware المسار (sport_menu.manage)
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'locale' => ['sometimes', 'string', Rule::in(Category::LOCALES)],
            'title' => ['sometimes', 'string', 'max:150'],
            'type' => ['sometimes', Rule::in(['category', 'section'])],
            'category_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            'section_key' => ['sometimes', 'nullable', 'string', 'max:50'],
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:sport_menu_items,id'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:100'],
            'order' => ['sometimes', 'integer', 'min:0'],
            'enabled' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * تحديث جزئيّ (sometimes) يمنع required_if/prohibited_if من رؤية القيمة الحالية في القاعدة —
     * فنتحقّق من الـ XOR يدويًّا على الحالة المدموجة (مُدخَل الطلب أو قيمة العنصر الحالية).
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($v): void {
            $item = $this->route('sportMenuItem');

            $type = $this->input('type', $item?->type);
            $categoryId = $this->has('category_id') ? $this->input('category_id') : $item?->category_id;
            $sectionKey = $this->has('section_key') ? $this->input('section_key') : $item?->section_key;

            if ($type === 'category') {
                if ($categoryId === null) {
                    $v->errors()->add('category_id', __('validation.required_if', ['other' => 'type', 'value' => 'category']));
                }
                if ($sectionKey !== null) {
                    $v->errors()->add('section_key', __('validation.prohibited_if', ['other' => 'type', 'value' => 'category']));
                }
            } elseif ($type === 'section') {
                if ($sectionKey === null) {
                    $v->errors()->add('section_key', __('validation.required_if', ['other' => 'type', 'value' => 'section']));
                }
                if ($categoryId !== null) {
                    $v->errors()->add('category_id', __('validation.prohibited_if', ['other' => 'type', 'value' => 'section']));
                }
            }
        });
    }
}
