<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Content;

use App\Enums\ArticleType;
use App\Enums\LiveEventStatus;
use App\Http\Requests\BaseFormRequest;
use App\Models\Article;
use App\Rules\ValidTipTapDocument;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

/**
 * ملاحظة حدود Wave C2: لا `status` ولا `published_at` — انتقالات
 * دورة الحياة (نشر/جدولة/أرشفة) في موجة «سير عمل النشر» اللاحقة.
 */
class UpdateArticleRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'min:2', 'max:200'],
            'locale' => ['sometimes', 'string', Rule::in(Article::LOCALES)],
            'type' => ['sometimes', Rule::in(ArticleType::values())],
            'event_status' => ['sometimes', 'nullable', Rule::in(LiveEventStatus::values())],
            'primary_category_id' => ['sometimes', 'integer', 'exists:categories,id'],
            // اختيار متعدّد بلا حدّ أقصى (نموذج الأقسام الموحّد).
            'secondary_category_ids' => ['sometimes', 'array'],
            'secondary_category_ids.*' => ['integer', 'distinct', 'exists:categories,id'],

            'slug' => [
                'sometimes', 'nullable', 'string', 'max:190',
                'regex:/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u',
                Rule::unique('articles', 'slug')
                    ->where(fn ($q) => $q->where(
                        'locale',
                        $this->input('locale', $this->route('article')?->locale)
                    ))
                    ->ignore($this->route('article')?->getKey()),
            ],

            'subtitle' => ['sometimes', 'nullable', 'string', 'max:250'],
            'short_url' => ['sometimes', 'nullable', 'string', 'max:100'],
            // اختياريّ: يُملأ تلقائياً من أوّل سطرين من المتن في الواجهة، لا يُفرَض يدوياً.
            'excerpt' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'content_json' => ['sometimes', 'array', new ValidTipTapDocument],
            'tags' => ['sometimes', 'array', 'max:30'],
            'tags.*' => ['string', 'min:1', 'max:50'],

            'seo_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'seo_description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'seo_keywords' => ['sometimes', 'nullable', 'string', 'max:255'],
            'canonical_url' => ['sometimes', 'nullable', 'string', 'max:255'],
            'robots' => ['sometimes', 'nullable', 'string', 'max:50'],
            'og_image_id' => ['sometimes', 'nullable', 'integer', 'exists:media_assets,id'],

            'is_featured' => ['sometimes', 'boolean'],
            'is_breaking' => ['sometimes', 'boolean'],
            'is_pinned' => ['sometimes', 'boolean'],
            'is_header' => ['sometimes', 'boolean'],
            'is_editor_pick' => ['sometimes', 'boolean'],
            'is_squares' => ['sometimes', 'boolean'],
            'comments_enabled' => ['sometimes', 'boolean'],
            // عدّاد المشاهدات — قابل للتعديل تحريرياً (يُفرَض الدور في الـ Action).
            'views_count' => ['sometimes', 'integer', 'min:0'],

            // إسناد وسائط المكتبة المركزية (attach-on-save). وجود المفتاح
            // يعني مزامنة كاملة؛ غيابه يُبقي الإسناد الحالي دون مساس.
            'media' => ['sometimes', 'array'],
            'media.*.asset_id' => ['required', 'integer', 'distinct', 'exists:media_assets,id'],
            'media.*.collection' => ['required', Rule::in(['cover', 'gallery', 'inline', 'video'])],
            'media.*.position' => ['sometimes', 'integer', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($v): void {
            $media = $this->input('media');
            if (! is_array($media)) {
                return;
            }
            $covers = array_filter(
                $media,
                fn ($m): bool => is_array($m) && ($m['collection'] ?? null) === 'cover'
            );
            if (count($covers) > 1) {
                $v->errors()->add('media', __('article.media.single_cover'));
            }
        });
    }
}
