<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Content;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class UploadArticleMediaRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $collection = (string) $this->input('collection');
        $isVideo = $collection === 'video';
        $videoMaxKb = (int) config('performance.media.video_max_kb', 256000);
        $imageMaxDim = (int) config('performance.media.image_max_dimension', 8000);

        return [
            'collection' => ['required', Rule::in(['cover', 'gallery', 'inline', 'video'])],
            'file' => array_merge(
                ['required', 'file'],
                $isVideo
                    ? ['mimetypes:video/mp4,video/webm', 'max:'.$videoMaxKb]
                    : [
                        'image', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120',
                        // نفس حارس الأبعاد العملاقة الموجود في StoreMediaAssetRequest.
                        Rule::dimensions()->maxWidth($imageMaxDim)->maxHeight($imageMaxDim),
                    ],
            ),
        ];
    }
}
