<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Settings;

use App\Http\Requests\BaseFormRequest;

class UploadBrandingRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'logo_light' => ['sometimes', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'mimetypes:image/png,image/jpeg,image/webp', 'max:2048'],
            'logo_dark' => ['sometimes', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'mimetypes:image/png,image/jpeg,image/webp', 'max:2048'],
            'logo_light_en' => ['sometimes', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'mimetypes:image/png,image/jpeg,image/webp', 'max:2048'],
            'logo_dark_en' => ['sometimes', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'mimetypes:image/png,image/jpeg,image/webp', 'max:2048'],
            'favicon' => ['sometimes', 'file', 'mimes:png,ico', 'mimetypes:image/png,image/vnd.microsoft.icon,image/x-icon', 'max:512'],
            'watermark_image' => ['sometimes', 'file', 'image', 'mimes:png,webp', 'mimetypes:image/png,image/webp', 'max:2048'],
        ];
    }
}
