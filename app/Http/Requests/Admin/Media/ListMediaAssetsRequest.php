<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Media;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListMediaAssetsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['sometimes', 'nullable', Rule::in(['image', 'video', 'external'])],
            // تشخيص المشغّل (Phase 5): تصفية حسب حالة المعالجة (متعثّرة/جارية).
            'processing_status' => ['sometimes', 'nullable', Rule::in(['queued', 'normalizing', 'processing', 'ready', 'failed'])],
            'provider' => ['sometimes', 'nullable', 'string', 'max:20'],
            'search' => ['sometimes', 'nullable', 'string', 'max:200'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
