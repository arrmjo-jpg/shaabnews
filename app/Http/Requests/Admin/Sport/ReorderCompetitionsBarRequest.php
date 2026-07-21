<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Sport;

use App\Http\Requests\BaseFormRequest;

/** مشتركة بين Match Bar وSports Home Bar — نفس شكل الطلب لكليهما. */
class ReorderCompetitionsBarRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true; // الصلاحية مفروضة عبر middleware المسار (competitions.manage)
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct', 'exists:competitions,id'],
        ];
    }
}
