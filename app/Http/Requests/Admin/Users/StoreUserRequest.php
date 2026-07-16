<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Users;

use App\Enums\UserStatus;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::defaults(), 'confirmed'],
            'status' => ['sometimes', Rule::enum(UserStatus::class)],
            'email_verified' => ['sometimes', 'boolean'],
            'is_writer' => ['sometimes', 'boolean'],
            'roles' => ['sometimes', 'array'],
            'roles.*' => ['string', 'exists:roles,name'],
            'avatar' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'social_links' => ['sometimes', 'nullable', 'array'],
            'social_links.*' => ['nullable', 'url', 'max:255'],
        ];
    }
}
