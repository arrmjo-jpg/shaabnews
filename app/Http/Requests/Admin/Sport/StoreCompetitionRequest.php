<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Sport;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

/**
 * إنشاء بطولة (المعرّف provider_id يُدخَل يدويًّا اليوم — لا متصفّح كتالوج مزوّد بعد،
 * تعمّدنا عدم بنائه قبل حاجة فعليّة. لا تفعيل تغطية هنا: is_tracked يُدار عبر update منفصل).
 */
class StoreCompetitionRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true; // الصلاحية مفروضة عبر middleware المسار (competitions.manage)
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'provider' => ['required', 'string', 'max:50'],
            'provider_id' => [
                'required', 'integer', 'min:1',
                Rule::unique('competitions', 'provider_id')->where(fn ($q) => $q->where('provider', $this->input('provider'))),
            ],
            'name' => ['required', 'string', 'max:150'],
            'logo_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
        ];
    }
}
