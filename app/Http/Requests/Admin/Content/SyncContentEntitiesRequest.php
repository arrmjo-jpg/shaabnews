<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Content;

use Illuminate\Foundation\Http\FormRequest;

/**
 * مزامنة قائمة الكيانات الموسومة على قطعة محتوى — الصلاحية عبر middleware
 * المسار (نفس صلاحيّة تعديل ذلك النوع، لا صلاحيّة جديدة: التوسيم جزء من
 * تحرير المحتوى نفسه).
 */
class SyncContentEntitiesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'entity_ids' => ['present', 'array'],
            'entity_ids.*' => ['integer', 'distinct', 'exists:entities,id'],
        ];
    }
}
