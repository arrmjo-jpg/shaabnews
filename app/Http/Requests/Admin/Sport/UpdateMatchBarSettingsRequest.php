<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Sport;

use App\Enums\MatchBarSource;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class UpdateMatchBarSettingsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true; // الصلاحية مفروضة عبر middleware المسار (settings.edit)
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'source' => ['required', 'string', Rule::in(MatchBarSource::values())],
        ];
    }
}
