<?php

declare(strict_types=1);

namespace App\Http\Resources\Public;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * مورد بروفيل الكاتب العام — **حقول آمنة للنشر فقط** (لا بريد/حالة/أدوار/تسجيل دخول/أسرار).
 * يُعاد فقط لمستخدم is_writer نشِط (البوّابة في ShowPublicWriterAction). الصورة من Spatie media.
 *
 * @mixin User
 */
class PublicWriterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $slug = \Illuminate\Support\Str::slug($this->name);
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $slug,
            'url' => "/writer/{$this->id}",
            'avatar' => $this->getFirstMediaUrl('avatar', 'thumb') ?: null,
            'bio' => $this->bio,
            'social_links' => (object) ($this->social_links ?? []),
            'articles_count' => $this->whenCounted('articles'),
            'last_activity_at' => $this->whenHas('last_activity_at', fn() => $this->last_activity_at),
            'verified' => (bool) ($this->is_verified ?? false),
        ];
    }
}
