<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\VideoStatus;
use App\Enums\VideoVisibility;
use App\Support\Audit\AuditsChanges;
use App\Support\Content\SlugGenerator;
use App\Support\Engagement\HasEngagement;
use App\Support\Search\ResilientSearchable;
use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Spatie\Tags\HasTags;

/**
 * فيديو مكتبة الفيديو — نوع محتوى مستقل من الدرجة الأولى (طويل/مفهرس).
 *
 * يعيد استخدام بنية AlphaCMS بالكامل دون بنى موازية: الفيديو (مرفوع أو خارجي)
 * أصلٌ واحد في media_assets؛ التفاعل عبر HasEngagement؛ البحث عبر Scout
 * (ResilientSearchable — فاشل-آمن)؛ الوسوم عبر Spatie Tags بنوع 'video'؛ أعمدة
 * SEO أصلية؛ تصنيف واحد مستقل (VideoCategory).
 */
class Video extends Model
{
    use AuditsChanges;
    use HasEngagement;
    use HasFactory;
    use HasTags;
    use ResilientSearchable;
    use Sluggable;
    use SoftDeletes;

    /** اللغات المدعومة — معرّفة محلياً (نطاق مستقل). */
    public const LOCALES = ['ar', 'en'];

    protected string $auditLogName = 'video';

    /** @var array<int,string> يُدقَّق التحوّل/الوصف فقط (لا أسرار). */
    protected array $auditAttributes = [
        'status', 'visibility', 'is_featured', 'source_type', 'title', 'slug', 'locale',
        'media_asset_id', 'video_category_id', 'duration_seconds', 'published_at',
        'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'robots', 'sort_order',
    ];

    protected $fillable = [
        'uuid', 'author_id', 'published_by_id', 'media_asset_id', 'video_category_id',
        'source_type', 'status', 'visibility', 'is_featured', 'locale', 'translation_group',
        'title', 'slug', 'description', 'excerpt', 'duration_seconds', 'views_count',
        'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'robots',
        'sort_order', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => VideoStatus::class,
            'visibility' => VideoVisibility::class,
            'is_featured' => 'boolean',
            'duration_seconds' => 'integer',
            'views_count' => 'integer',
            'sort_order' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $video): void {
            if (empty($video->uuid)) {
                $video->uuid = (string) Str::uuid();
            }
        });
    }

    /** @return array<string, array<string, mixed>> */
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

    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(VideoCategory::class, 'video_category_id');
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

    public function playlists(): BelongsToMany
    {
        return $this->belongsToMany(VideoPlaylist::class, 'playlist_video')
            ->withPivot('position')
            ->withTimestamps()
            ->orderBy('playlist_video.position');
    }

    public function urlHistory(): HasMany
    {
        return $this->hasMany(VideoUrlHistory::class);
    }

    // ─── Scopes ─────────────────────────────────────────────────────

    public function scopePublished(Builder $query): Builder
    {
        return $query
            ->where('status', VideoStatus::Published->value)
            ->where('published_at', '<=', now());
    }

    /** عام = منشور + رؤية عامة (مُدرَج في القوائم/الخرائط). */
    public function scopePublic(Builder $query): Builder
    {
        return $query->published()->where('visibility', VideoVisibility::Public->value);
    }

    /**
     * وسائط قابلة للتشغيل فعلاً — حارس الثابتة العامة «لا نكشف وسائط قيد المعالجة
     * ولا مصادر خارجية معطوبة». الخارجي صالح متى كان له embed_url؛ المرفوع صالح
     * متى صار أصله جاهزاً (processing_status = ready). يُطبَّق على كل قراءة عامة.
     */
    public function scopePlayable(Builder $query): Builder
    {
        return $query->whereHas('mediaAsset', function (Builder $asset): void {
            $asset->where(function (Builder $external): void {
                $external->where('kind', 'external')->whereNotNull('embed_url');
            })->orWhere(function (Builder $uploaded): void {
                $uploaded->where('kind', '!=', 'external')->where('processing_status', 'ready');
            });
        });
    }

    /**
     * قابل للعرض عبر رابط مباشر: منشور + قابل للتشغيل + رؤية عامة أو غير مُدرَجة
     * (unlisted يُفتح بالرابط فقط، لا يظهر في القوائم). يستبعد المسودة/المؤرشف/الخاص.
     * مخصّص لنقطة التفاصيل بالـ slug فقط — القوائم تستخدم public()->playable().
     */
    public function scopeViewable(Builder $query): Builder
    {
        return $query->published()->playable()->whereIn('visibility', [
            VideoVisibility::Public->value,
            VideoVisibility::Unlisted->value,
        ]);
    }

    public function scopeForLocale(Builder $query, string $locale): Builder
    {
        return $query->where('locale', $locale);
    }

    // ─── Media / publish guard (مرآة Reel::hasPublishableMedia) ──────

    /**
     * هل للفيديو وسائط قابلة للنشر؟ الخارجي جاهز فور ربطه؛ المرفوع يتطلّب
     * أصلاً مُعالَجاً (processing_status = ready). شرط صارم للنشر/الجدولة.
     */
    public function hasPublishableMedia(): bool
    {
        if ($this->media_asset_id === null) {
            return false;
        }

        $asset = $this->relationLoaded('mediaAsset') ? $this->mediaAsset : $this->mediaAsset()->first();
        if ($asset === null) {
            return false;
        }

        return $asset->isExternal() || $asset->processing_status === 'ready';
    }

    // ─── SEO / sharing (نفس نمط المقال/الريل) ───────────────────────

    /** المسار القانوني المستقرّ: /{locale}/videos/{id}-{slug}. */
    public function canonicalPath(): string
    {
        return '/'.trim("{$this->locale}/videos/{$this->id}-{$this->slug}", '/');
    }

    /** صورة المشاركة (OG): poster فيديو المكتبة المركزية. */
    public function shareImageUrl(): ?string
    {
        return $this->mediaAsset?->posterUrl();
    }

    // ─── Scout (فهرسة فاشلة-آمنة عبر ResilientSearchable) ────────────

    /** فهرس مستقلّ (إعداداته في config/scout.php → meilisearch.index-settings). */
    public function searchableAs(): string
    {
        return 'videos_index';
    }

    /**
     * يُفهرَس الفيديو القابل للإدراج العام فقط (منشور + عام + غير مجدوَل) — نظافة
     * الفهرس + دفاع بالعمق (لا فهرسة مسودّة/خاص/غير مُدرَج). القابلية للتشغيل تبقى
     * حارساً على القراءة (whereIn + playable) كي لا يظهر أصلٌ قيد المعالجة في النتائج.
     */
    public function shouldBeSearchable(): bool
    {
        return $this->deleted_at === null
            && $this->status === VideoStatus::Published
            && $this->visibility === VideoVisibility::Public
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
            'excerpt' => (string) $this->excerpt,
            'locale' => $this->locale,
            'status' => $this->status->value,
            'visibility' => $this->visibility->value,
            'video_category_id' => $this->video_category_id,
            'source_type' => $this->source_type,
            'is_featured' => $this->is_featured,
            'published_at' => $this->published_at?->getTimestamp(),
        ];
    }
}
