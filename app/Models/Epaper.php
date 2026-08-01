<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\EpaperAccessLevel;
use App\Enums\EpaperOcrStatus;
use App\Enums\EpaperStatus;
use App\Enums\EpaperTextLayer;
use App\Support\Audit\AuditsChanges;
use App\Support\Content\SlugGenerator;
use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * Epaper Core — العدد الرقميّ للجريدة (الوثيقة PDF عبر media_asset_id).
 * slug عربيّ-المحافظة فريد لكل لغة؛ التدقيق عبر AuditsChanges؛ النسخ في
 * epaper_versions؛ تحويل المسارات في epaper_url_history. لا منطق وصول/بحث هنا
 * (المرحلتان 3/4) — هذه النواة فقط.
 *
 * @property-read iterable<int,EpaperVersion> $versions
 */
class Epaper extends Model
{
    use AuditsChanges;
    use Sluggable;
    use SoftDeletes;

    public const LOCALES = ['ar', 'en'];

    protected string $auditLogName = 'epaper';

    /** @var array<int,string> */
    protected array $auditAttributes = [
        'status', 'access_level', 'issue_number', 'title', 'subtitle', 'slug', 'locale',
        'publication_date', 'media_asset_id', 'current_version', 'published_at',
        'brief_points', 'highlights', 'inside_this_issue',
    ];

    /** قيم افتراضية على مستوى النموذج (تطابق افتراضيّ المخطّط قبل أوّل حفظ). */
    protected $attributes = [
        'status' => EpaperStatus::Draft->value,
        'access_level' => EpaperAccessLevel::Public->value,
        'current_version' => 1,
    ];

    protected $fillable = [
        'uuid',
        'source_post_id',
        'locale',
        'issue_number',
        'title',
        'subtitle',
        'summary',
        'brief_points',
        'highlights',
        'inside_this_issue',
        'slug',
        'publication_date',
        'status',
        'access_level',
        'media_asset_id',
        'page_count',
        'text_layer',
        'ocr_status',
        'current_version',
        'author_id',
        'published_by_id',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => EpaperStatus::class,
            'access_level' => EpaperAccessLevel::class,
            'issue_number' => 'integer',
            'page_count' => 'integer',
            'ocr_status' => EpaperOcrStatus::class,
            'text_layer' => EpaperTextLayer::class,
            'current_version' => 'integer',
            'publication_date' => 'date',
            'published_at' => 'datetime',
            'brief_points' => 'array',
            'highlights' => 'array',
            'inside_this_issue' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $epaper): void {
            if (empty($epaper->uuid)) {
                $epaper->uuid = (string) Str::uuid();
            }
        });
    }

    /** @return array<string,array<string,mixed>> */
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'title',
                'unique' => true,
                'includeTrashed' => true,
                'maxLength' => 180,
                'method' => [self::class, 'arabicSlug'],
            ],
        ];
    }

    public static function arabicSlug(string $string, string $separator): string
    {
        return SlugGenerator::makeWithFallback($string, $separator);
    }

    /** فرادة الـ slug ضمن نفس اللغة فقط (slug per-locale). */
    public function scopeWithUniqueSlugConstraints(
        Builder $query,
        Model $model,
        string $attribute,
        array $config,
        string $slug
    ): Builder {
        return $query->where('locale', $model->locale);
    }

    // ─── Relationships ──────────────────────────────────────────────

    /** @return BelongsTo<MediaAsset, Epaper> */
    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    /** @return BelongsTo<User, Epaper> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /** @return BelongsTo<User, Epaper> */
    public function publishedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by_id');
    }

    /** @return HasMany<EpaperVersion> */
    public function versions(): HasMany
    {
        return $this->hasMany(EpaperVersion::class)->orderByDesc('version');
    }

    /** @return HasMany<EpaperUrlHistory> */
    public function urlHistory(): HasMany
    {
        return $this->hasMany(EpaperUrlHistory::class);
    }

    /** @return HasMany<EpaperPage> */
    public function pages(): HasMany
    {
        return $this->hasMany(EpaperPage::class)->orderBy('page_number');
    }

    // ─── Scopes ─────────────────────────────────────────────────────

    public function scopePublished(Builder $query): Builder
    {
        return $query
            ->where('status', EpaperStatus::Published->value)
            ->where('published_at', '<=', now());
    }

    public function scopeForLocale(Builder $query, string $locale): Builder
    {
        return $query->where('locale', $locale);
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    public function canonicalPath(): string
    {
        return '/'.trim("{$this->locale}/epaper/{$this->id}-{$this->slug}", '/');
    }

    /**
     * رابط غلاف العدد (مشتقّ conversions['cover'] على أصل الـ PDF) أو null إن لم يُولَّد
     * بعد — لا ارتداد إلى الـ PDF (لا تلفيق صورة). يعتمد على mediaAsset محمّلاً.
     */
    public function coverUrl(): ?string
    {
        $asset = $this->mediaAsset;
        if ($asset === null) {
            return null;
        }
        $path = $asset->conversions['cover']['path'] ?? null;

        return $path !== null ? $asset->conversionUrl('cover') : null;
    }
}
