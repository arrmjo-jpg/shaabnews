<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Sport;

use App\Http\Requests\BaseFormRequest;

class ReorderSportMenuItemsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true; // الصلاحية مفروضة عبر middleware المسار (sport_menu.manage)
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct', 'exists:sport_menu_items,id'],
        ];
    }
}
