<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\UserStatus;
use App\Notifications\QueuedResetPassword;
use App\Support\Audit\AuditsChanges;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements HasMedia
{
    /** @use HasFactory<UserFactory> */
    use AuditsChanges, HasApiTokens, HasFactory, HasRoles, InteractsWithMedia, Notifiable, SoftDeletes;

    protected string $auditLogName = 'user';

    /** @var array<int,string> سمات مُدقَّقة (بلا كلمة المرور/الأسرار). phone مستثنى كـ PII
     * (نفس نهج WhatsappContact)؛ whatsapp_subscribed مُدقَّق كسجلّ موافقة (لا PII). */
    protected array $auditAttributes = [
        'name', 'email', 'status', 'is_writer',
        'email_verified_at', 'bio', 'avatar',
        'whatsapp_subscribed',
    ];

    /** الأدوار الإدارية (وصول لوحة الإدارة). */
    public const ADMIN_ROLES = [
        'super_admin',
        'editor',
        'reviewer',
        'moderator',
        'social_media_manager',
        'journalist',
        'contributor',
    ];

    protected $fillable = [
        'name',
        'email',
        'password',
        'status',
        'last_login_at',
        'last_login_ip',
        'avatar',
        'bio',
        'social_links',
        'email_verified_at',
        'is_writer',
        'phone',
        'whatsapp_subscribed',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'status' => UserStatus::class,
            'social_links' => 'array',
            'is_writer' => 'boolean',
            'whatsapp_subscribed' => 'boolean',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::Active;
    }

    public function isAdmin(): bool
    {
        return $this->hasAnyRole(self::ADMIN_ROLES);
    }

    /**
     * إشعار إعادة التعيين مُصفَّف (لا يحجب الطلب على SMTP).
     */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new QueuedResetPassword($token));
    }

    public function isWriter(): bool
    {
        return (bool) $this->is_writer;
    }

    public function writerRequests()
    {
        return $this->hasMany(WriterRequest::class);
    }

    // تحديث بيانات آخر تسجيل دخول
    public function recordLogin(string $ip): void
    {
        $this->update([
            'last_login_at' => now(),
            'last_login_ip' => $ip,
        ]);
    }

    // ─── Media: author avatar (Spatie MediaLibrary — P3) ────────────

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('avatar')
            ->singleFile()
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('thumb')
            ->fit(Fit::Contain, 256, 256)
            ->format('webp')
            ->performOnCollections('avatar');
    }

    public function articles(): HasMany
    {
        return $this->hasMany(Article::class, 'author_id');
    }
}
