<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Sport;

use App\Http\Requests\BaseFormRequest;

/**
 * تحديث بطولة — يجمع بين حقل التغطية (is_tracked) وأعلام أشرطة البطولات التحريريّة (Match Bar
 * وSports Home Bar) عمدًا في نموذج واحد للتبسيط الإداريّ (شاشة واحدة)، لكنّها تبقى **مستقلَّة
 * منطقيًّا تمامًا عن بعضها**: BuildCompetitionBarAction لا يقرأ is_tracked إطلاقًا، وSync
 * TrackedCompetitionFixturesAction لا يقرأ أعلام أيّ شريط إطلاقًا — الفصل بنيويّ في الإجراءات،
 * لا مجرّد اصطلاح هنا.
 */
class UpdateCompetitionRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true; // الصلاحية مفروضة عبر middleware المسار (competitions.manage)
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:150'],
            'logo_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'is_active' => ['sometimes', 'boolean'],

            'is_tracked' => ['sometimes', 'boolean'],

            'is_featured_tournament' => ['sometimes', 'boolean'],
            'featured_until' => ['sometimes', 'nullable', 'date'],
            'show_in_match_bar' => ['sometimes', 'boolean'],
            'match_bar_sort_order' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:65535'],
            'show_in_sports_home_bar' => ['sometimes', 'boolean'],
            'sports_home_bar_sort_order' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:65535'],
        ];
    }
}
