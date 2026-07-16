<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ReelStatus;
use App\Support\Audit\AuditsChanges;
use App\Support\Content\SlugGenerator;
use App\Support\Engagement\HasEngagement;
use App\Support\Search\ResilientSearchable;
use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * ريل — نوع محتوى مستقل بذاته (فيديو عمودي قصير).
 *
 * نطاق قائم بذاته: لا يرتبط بتصنيفات الأخبار (Category) ولا بأي تصنيف بديل.
 * يعيد استخدام بنية AlphaCMS القائمة: media_assets للفيديو، التفاعل الموحّد،
 * وأعمدة SEO الأصلية — دون بنى موازية.
 */
class Reel extends Model
{
    use AuditsChanges;
    use HasEngagement;
    use ResilientSearchable;
    use Sluggable;
    use SoftDeletes;

    /** اللغات المدعومة — معرّفة محلياً (لا اعتماد على Category). */
    public const LOCALES = ['ar', 'en'];

    protected string $auditLogName = 'reel';

    /** @var array<int,string> يُدقَّق التحوّل فقط (تاريخ المحتوى في reel_revisions). */
    protected array $auditAttributes = [
        'status', 'is_featured', 'title', 'slug', 'locale', 'media_asset_id',
        'duration_seconds', 'published_at', 'seo_title', 'seo_description',
        'seo_keywords', 'canonical_url', 'robots', 'sort_order',
    ];

    protected $fillable = [
        'uuid', 'author_id', 'published_by_id', 'media_asset_id',
        'status', 'is_featured', 'locale', 'translation_group', 'title', 'slug', 'description',
        'duration_seconds', 'seo_title', 'seo_description', 'seo_keywords',
        'canonical_url', 'robots', 'sort_order', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ReelStatus::class,
            'is_featured' => 'boolean',
            'duration_seconds' => 'integer',
            'sort_order' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $reel): void {
            if (empty($reel->uuid)) {
                $reel->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'title',
                'unique' => true,
                'includeTrashed' => true,
                'maxLength' => 190,
                'method' => [self::class, 'arabicSlug'],
            ],
        ];
    }

    /** مولّد slug يحافظ على الحروف العربية — مُوحَّد عبر SlugGenerator. */
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

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function publishedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by_id');
    }

    /** فيديو الريل من المكتبة المركزية (تُربط في المرحلة 3). */
    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    /**
     * الكيانات الكنونيّة الموسومة (أشخاص/منظّمات/أماكن/مواضيع) — Task 12،
     * توسيم يدويّ فقط. مرآة Article::entities().
     */
    public function entities(): MorphToMany
    {
        return $this->morphToMany(Entity::class, 'taggable', 'content_entity')
            ->withPivot(['assigned_by_type', 'assigned_by_id', 'status', 'confidence'])
            ->withTimestamps();
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(ReelRevision::class)->latest('created_at');
    }

    // ─── Scopes ─────────────────────────────────────────────────────

    public function scopePublished(Builder $query): Builder
    {
        return $query
            ->where('status', ReelStatus::Published->value)
            ->where('published_at', '<=', now());
    }

    public function scopeForLocale(Builder $query, string $locale): Builder
    {
        return $query->where('locale', $locale);
    }

    /**
     * هل للريل وسائط قابلة للنشر؟ (أصل مرتبط ومعالجته جاهزة). شرط صارم للنشر
     * والجدولة — لا نشر لريل بلا فيديو جاهز.
     */
    public function hasPublishableMedia(): bool
    {
        if ($this->media_asset_id === null) {
            return false;
        }

        $asset = $this->relationLoaded('mediaAsset') ? $this->mediaAsset : $this->mediaAsset()->first();

        return $asset !== null && $asset->processing_status === 'ready';
    }

    // ─── Sharing / SEO (نفس نمط المقال — لا بنية مشاركة موازية) ──────

    /**
     * المسار القانوني المستقرّ للمشاركة: /{locale}/reels/{id}-{slug}.
     * يُفتَّت بالـ id (لا يتغيّر) والـ slug تجميلي — مطابق لنمط المقال.
     */
    public function canonicalPath(): string
    {
        return '/'.trim("{$this->locale}/reels/{$this->id}-{$this->slug}", '/');
    }

    /**
     * صورة المشاركة (OG): الصورة المصغّرة (poster JPG) لفيديو الريل من المكتبة
     * المركزية — يُعاد استخدام أصل الوسائط، بلا og_image مخصّص ولا تخزين منفصل.
     */
    public function shareImageUrl(): ?string
    {
        return $this->mediaAsset?->posterUrl();
    }

    // ─── Scout (فهرسة فاشلة-آمنة عبر ResilientSearchable — Task 10) ──

    /** فهرس مستقلّ (إعداداته في config/scout.php → meilisearch.index-settings). */
    public function searchableAs(): string
    {
        return 'reels_index';
    }

    /** يُفهرَس الريل المنشور فقط — نفس معيار scopePublished. */
    public function shouldBeSearchable(): bool
    {
        return $this->deleted_at === null
            && $this->status === ReelStatus::Published
            && $this->published_at !== null
            && ! $this->published_at->isFuture();
    }

    /** @return array<string,mixed> */
    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => (string) $this->description,
            'locale' => $this->locale,
            'status' => $this->status->value,
            'is_featured' => $this->is_featured,
            'author_id' => $this->author_id,
            'published_at' => $this->published_at?->getTimestamp(),
        ];
    }
}
