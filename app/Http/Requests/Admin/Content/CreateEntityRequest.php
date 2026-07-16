<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Content;

use App\Enums\EntityType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** إنشاء كيان كنونيّ جديد — الصلاحية entities.create عبر middleware المسار. */
class CreateEntityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(EntityType::values())],
            'name' => ['required', 'string', 'max:190'],
            'description' => ['nullable', 'string'],
            'external_ref' => ['nullable', 'string', 'max:190'],
        ];
    }
}
