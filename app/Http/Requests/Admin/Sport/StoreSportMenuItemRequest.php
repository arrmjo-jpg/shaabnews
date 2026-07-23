<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Sport;

use App\Enums\SportMenuSectionKey;
use App\Http\Requests\BaseFormRequest;
use App\Models\Category;
use Illuminate\Validation\Rule;

class StoreSportMenuItemRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true; // الصلاحية مفروضة عبر middleware المسار (sport_menu.manage)
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'locale' => ['required', 'string', Rule::in(Category::LOCALES)],
            'title' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::in(['category', 'section'])],
            // XOR بحسب type: عنصر تصنيف يشير إلى category_id فقط، وعنصر قسم وظيفي يشير إلى section_key فقط.
            'category_id' => ['required_if:type,category', 'prohibited_if:type,section', 'nullable', 'integer', 'exists:categories,id'],
            // Governance فقط (Phase 3.2 Commit 2) — لا يُثبت وجود صفحة/Route فعليّ لأيّ قيمة،
            // فقط يقيّد ما يُسمح بإدخاله. راجع SportMenuSectionKey لتوضيح الفصل عن Availability.
            'section_key' => ['required_if:type,section', 'prohibited_if:type,category', 'nullable', 'string', Rule::in(SportMenuSectionKey::values())],
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:sport_menu_items,id'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:100'],
            'order' => ['sometimes', 'integer', 'min:0'],
            'enabled' => ['sometimes', 'boolean'],
        ];
    }
}
