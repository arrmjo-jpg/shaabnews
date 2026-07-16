<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MediaVisibility;
use App\Support\Audit\AuditsChanges;
use App\Support\Media\MediaDeliveryResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class MediaAsset extends Model
{
    use AuditsChanges;

    protected string $auditLogName = 'media';

    /** @var array<int,string> — لا أسرار؛ بيانات وصفية تحريرية فقط. */
    protected array $auditAttributes = [
        'original_name', 'visibility', 'path', 'uploaded_by',
        'alt', 'caption', 'credit', 'source',
        'kind', 'provider', 'source_url',
        'license_type', 'rights_expiry_at', 'usage_terms',
    ];

    protected $fillable = [
        'uuid',
        'kind',
        'processing_status',
        'processing_profile',
        'duration_seconds',
        'disk',
        'path',
        'filename',
        'original_name',
        'mime_type',
        'extension',
        'size',
        'checksum',
        'width',
        'height',
        'metadata',
        'alt',
        'caption',
        'credit',
        'source',
        'license_type',
        'rights_expiry_at',
        'usage_terms',
        'conversions',
        'visibility',
        'uploaded_by',
        'provider',
        'provider_id',
        'embed_url',
        'source_url',
        'poster_url',
        // تخزين هجين — حالة المزامنة (تشغيلية، غير مُدقَّقة عمداً).
        'stored_local',
        'stored_remote',
        'remote_path',
        'remote_sync_status',
        'remote_sync_error',
        'last_remote_sync_at',
        'preferred_delivery',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'conversions' => 'array',
            'size' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'duration_seconds' => 'integer',
            'visibility' => MediaVisibility::class,
            'rights_expiry_at' => 'datetime',
            'stored_local' => 'boolean',
            'stored_remote' => 'boolean',
            'last_remote_sync_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** المقالات التي تُستخدَم فيها هذا الأصل (P9.2 B.2a). */
    public function articles(): BelongsToMany
    {
        return $this->belongsToMany(Article::class, 'article_media')
            ->withPivot(['collection', 'position'])
            ->withTimestamps();
    }

    /** تحديثات التغطية الحيّة التي تُستخدَم فيها (نفس جدول الإسناد المشترك). */
    public function liveUpdates(): BelongsToMany
    {
        return $this->belongsToMany(ArticleLiveUpdate::class, 'article_media', 'media_asset_id', 'live_update_id')
            ->withPivot(['collection', 'position'])
            ->withTimestamps();
    }

    /** الريلز التي تستخدم هذا الأصل كفيديو (مرجع عمودي media_asset_id). */
    public function reels(): HasMany
    {
        return $this->hasMany(Reel::class, 'media_asset_id');
    }

    /** صورة المشاركة (og:image) للمقالات/الأحداث — مرجع عمودي articles.og_image_id. */
    public function articleOgImages(): HasMany
    {
        return $this->hasMany(Article::class, 'og_image_id');
    }

    /** فيديوهات مكتبة الفيديو التي تستخدم هذا الأصل — videos.media_asset_id. */
    public function videos(): HasMany
    {
        return $this->hasMany(Video::class, 'media_asset_id');
    }

    /** أغلفة تصنيفات الفيديو — video_categories.cover_media_id. */
    public function videoCategories(): HasMany
    {
        return $this->hasMany(VideoCategory::class, 'cover_media_id');
    }

    /** أغلفة قوائم تشغيل الفيديو — video_playlists.cover_media_id. */
    public function videoPlaylists(): HasMany
    {
        return $this->hasMany(VideoPlaylist::class, 'cover_media_id');
    }

    /** أغلفة البثّ — broadcasts.cover_media_id. */
    public function broadcasts(): HasMany
    {
        return $this->hasMany(Broadcast::class, 'cover_media_id');
    }

    /** أغلفة تصنيفات البثّ — broadcast_categories.cover_media_id. */
    public function broadcastCategories(): HasMany
    {
        return $this->hasMany(BroadcastCategory::class, 'cover_media_id');
    }

    /** أعداد الجريدة الرقمية (الوثيقة الحاليّة) — epapers.media_asset_id. */
    public function epapers(): HasMany
    {
        return $this->hasMany(Epaper::class, 'media_asset_id');
    }

    /** نُسخ الأعداد (سِجلّ النسخ) — epaper_versions.media_asset_id. */
    public function epaperVersions(): HasMany
    {
        return $this->hasMany(EpaperVersion::class, 'media_asset_id');
    }

    /**
     * نطاق أصول المكتبة القابلة للإسناد/الإدارة: ملفات assets/ + الفيديو الخارجي.
     * يستثني أصول الإعدادات (branding/...).
     */
    public function scopeLibrary(Builder $query): Builder
    {
        return $query->where(function (Builder $q): void {
            $q->where('path', 'like', 'assets/%')->orWhere('kind', 'external');
        });
    }

    /** فيديو خارجي مرتبط بمزوّد (لا ملف على القرص). */
    public function isExternal(): bool
    {
        return $this->kind === 'external';
    }

    /** فيديو مرفوع (ملف video/* على القرص — يمرّ بخط HLS). */
    public function isUploadedVideo(): bool
    {
        return ! $this->isExternal() && str_starts_with((string) $this->mime_type, 'video/');
    }

    /** رابط الـ poster (مشتقّ للفيديو المرفوع، أو poster_url للخارجي). */
    public function posterUrl(): ?string
    {
        if ($this->isExternal()) {
            return $this->poster_url;
        }
        $path = $this->conversions['poster']['path'] ?? null;

        return MediaDeliveryResolver::url($this, $path);
    }

    /** رابط HLS master للفيديو المرفوع الجاهز. */
    public function hlsUrl(): ?string
    {
        $path = $this->conversions['hls']['master'] ?? null;

        return MediaDeliveryResolver::url($this, $path);
    }

    /**
     * روابط نسخ MP4 التدريجية (ملف معالجة reel): master + الدقّات.
     *
     * @return array<string,string>
     */
    public function renditionUrls(): array
    {
        $renditions = $this->conversions['renditions'] ?? null;
        if (! is_array($renditions)) {
            return [];
        }

        // قرص موحّد لكل ملفات الأصل (سلامة الأصل الواحد).
        $disk = Storage::disk(MediaDeliveryResolver::diskNameFor($this));
        $out = [];
        if (! empty($renditions['master'])) {
            $out['master'] = $disk->url($renditions['master']);
        }
        foreach (($renditions['variants'] ?? []) as $name => $path) {
            $out[$name] = $disk->url($path);
        }

        return $out;
    }

    /**
     * روابط الصورة المصغّرة (JPG دائماً، WebP إن توفّر) — أو null إن غابت.
     *
     * @return array{jpg:?string,webp:?string}|null
     */
    public function thumbnailUrls(): ?array
    {
        $thumb = $this->conversions['thumbnail'] ?? null;
        if (! is_array($thumb)) {
            return null;
        }

        $disk = Storage::disk(MediaDeliveryResolver::diskNameFor($this));

        return [
            'jpg' => ! empty($thumb['jpg']) ? $disk->url($thumb['jpg']) : $this->posterUrl(),
            'webp' => ! empty($thumb['webp']) ? $disk->url($thumb['webp']) : null,
        ];
    }

    /** صورة قابلة للتحويل (نولّد لها مشتقّات WebP). */
    public function isConvertibleImage(): bool
    {
        return in_array($this->mime_type, ['image/jpeg', 'image/png', 'image/webp'], true);
    }

    // الرابط العام: الفيديو الخارجي يُعيد رابط التضمين؛ الملفات تُعيد رابط القرص.
    public function url(): ?string
    {
        if ($this->isExternal()) {
            return $this->embed_url ?? $this->source_url;
        }

        if ($this->visibility !== MediaVisibility::Public) {
            return null;
        }

        return MediaDeliveryResolver::url($this, $this->path);
    }

    /** رابط مشتقّ محدّد (thumb/medium)؛ يسقط للأصل عند غياب المشتقّ. */
    public function conversionUrl(string $name): ?string
    {
        $path = $this->conversions[$name]['path'] ?? null;
        if ($path === null) {
            return $this->url();
        }
        if ($this->visibility !== MediaVisibility::Public) {
            return null;
        }

        return MediaDeliveryResolver::url($this, $path);
    }
}
