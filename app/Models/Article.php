<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ArticleStatus;
use App\Enums\ArticleType;
use App\Enums\LiveEventStatus;
use App\Support\Audit\AuditsChanges;
use App\Support\Content\SlugGenerator;
use App\Support\Engagement\HasEngagement;
use App\Support\Media\MediaUrl;
use App\Support\Search\ResilientSearchable;
use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Tags\HasTags;

/**
 * كيان المحتوى الموحّد (ADR D1 — لا News منفصل).
 *
 * الوسائط عبر article_media pivot → MediaAsset (P9.2 B.2a).
 * أصل واحد مُشترَك بين مقالات متعدّدة؛ مجموعات: cover/gallery/inline/video.
 */
class Article extends Model
{
    use AuditsChanges;
    use HasEngagement;
    use HasTags;
    use ResilientSearchable;
    use Sluggable;
    use SoftDeletes;

    /** الحد الأقصى للتصنيفات الثانوية (ADR A3.2). */
    public const MAX_SECONDARY_CATEGORIES = 3;

    /** اللغات المدعومة — مرجع موحّد (ADR D2). */
    public const LOCALES = Category::LOCALES;

    protected string $auditLogName = 'article';

    /**
     * يُدقَّق التحوّل (لا المحتوى الطويل — تاريخه في article_revisions).
     *
     * @var array<int,string>
     */
    protected array $auditAttributes = [
        'type', 'status', 'event_status', 'title', 'subtitle', 'slug', 'locale',
        'primary_category_id', 'is_featured', 'is_breaking', 'is_pinned', 'is_header', 'is_editor_pick', 'is_squares',
        'comments_enabled', 'published_at', 'seo_title', 'seo_description',
        'seo_keywords', 'canonical_url', 'robots', 'og_image_id',
    ];

    protected $fillable = [
        'author_id', 'published_by_id', 'primary_category_id',
        'type', 'status', 'event_status', 'locale', 'translation_group',
        'title', 'subtitle', 'slug', 'short_url', 'excerpt', 'content', 'content_json',
        'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'robots', 'og_image_id',
        'is_featured', 'is_breaking', 'is_pinned', 'is_header', 'is_editor_pick', 'is_squares', 'comments_enabled',
        'views_count', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => ArticleType::class,
            'status' => ArticleStatus::class,
            'event_status' => LiveEventStatus::class,
            'content_json' => 'array',
            'is_featured' => 'boolean',
            'is_breaking' => 'boolean',
            'is_pinned' => 'boolean',
            'is_header' => 'boolean',
            'is_editor_pick' => 'boolean',
            'is_squares' => 'boolean',
            'comments_enabled' => 'boolean',
            'published_at' => 'datetime',
            'views_count' => 'integer',
        ];
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

    /**
     * مولّد slug يحافظ على الحروف العربية (لا transliteration) — مُوحَّد عبر
     * SlugGenerator (يعالج الترقيم والفواصل المكرّرة ويضمن قيمة غير فارغة).
     */
    public static function arabicSlug(string $string, string $separator): string
    {
        return SlugGenerator::makeWithFallback($string, $separator);
    }

    /**
     * فرادة الـ slug ضمن نفس اللغة فقط (ADR slug per-locale).
     */
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

    public function primaryCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'primary_category_id');
    }

    /** صورة المشاركة المخصّصة (og:image) من المكتبة المركزية. */
    public function ogImage(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'og_image_id');
    }

    /** التصنيفات الثانوية (≤3) — الرئيسي ليس ضمن هذا الـ pivot. */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'article_category')
            ->withTimestamps();
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(ArticleRevision::class)->latest('created_at');
    }

    /**
     * الكيانات الكنونيّة الموسومة (أشخاص/منظّمات/أماكن/مواضيع) — Phase 1،
     * توسيم يدويّ فقط. منفصلة عن tags() (Spatie\Tags، كلمات مفتاحيّة حرّة)؛
     * انظر docs/adr/E5-entity-registry-not-tags.md.
     */
    public function entities(): MorphToMany
    {
        return $this->morphToMany(Entity::class, 'taggable', 'content_entity')
            ->withPivot(['assigned_by_type', 'assigned_by_id', 'status', 'confidence'])
            ->withTimestamps();
    }

    /** تحديثات التغطية الحيّة (P8) — تُستهلَك فقط لمقالات type=live. */
    public function liveUpdates(): HasMany
    {
        return $this->hasMany(ArticleLiveUpdate::class);
    }

    public function urlHistory(): HasMany
    {
        return $this->hasMany(ArticleUrlHistory::class);
    }

    /**
     * أصول المكتبة المركزية المرتبطة بالمقال (P9.2 B.2a).
     * مُرتَّبة حسب position ضمن كل مجموعة.
     */
    public function mediaAssets(): BelongsToMany
    {
        return $this->belongsToMany(MediaAsset::class, 'article_media')
            ->withPivot(['collection', 'position'])
            ->withTimestamps()
            ->orderByPivot('position');
    }

    // ─── Scopes ─────────────────────────────────────────────────────

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', ArticleStatus::Published->value)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    public function scopeForLocale(Builder $query, string $locale): Builder
    {
        return $query->where('locale', $locale);
    }

    // ─── Scout / Meilisearch (بحث المقالات) ─────────────────────────

    public function searchableAs(): string
    {
        return 'articles_index';
    }

    /**
     * تمكين البحث في جميع المقالات إدارياً (بما في ذلك المسودات والمؤرشفة).
     * يتم ضمان سرية الموقع العام عبر فلاتر Meilisearch و MySQL Scopes الصارمة.
     */
    public function shouldBeSearchable(): bool
    {
        return true;
    }

    /**
     * منع مشكلة N+1 Queries أثناء استيراد كتل الفهرسة الكبيرة (scout:import)
     * بتحميل العلاقات دفعة واحدة.
     */
    public function makeAllSearchableUsing($query)
    {
        return $query->with([
            'primaryCategory:id,name',
            'categories:id,name,slug',
            'tags:id,name',
        ]);
    }

    /**
     * المستند المُفهرَس — يشمل النصّ الكامل والتصنيفات والوسوم؛ وحقول التصفية والفرز.
     *
     * @return array<string,mixed>
     */
    public function toSearchableArray(): array
    {
        $this->loadMissing(['primaryCategory:id,name', 'categories:id', 'tags']);

        $categoryIds = collect([$this->primary_category_id])
            ->concat($this->categories->pluck('id'))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return [
            'id' => (string) $this->id,
            'title' => (string) $this->title,
            'subtitle' => (string) $this->subtitle,
            'excerpt' => (string) $this->excerpt,
            'body' => trim((string) preg_replace('/\s+/u', ' ', strip_tags((string) $this->content))),
            'category' => (string) ($this->primaryCategory?->name ?? ''),
            'tags' => $this->tags->pluck('name')->implode(' '),
            // حقول التصفية والفرز الخاصة بـ Meilisearch (filterable/sortable)
            'locale' => $this->locale,
            'type' => $this->type?->value,
            'status' => $this->status?->value,
            'author_id' => $this->author_id ? (int) $this->author_id : null,
            'category_ids' => $categoryIds,
            'tag_names' => $this->tags->pluck('name')->all(),
            'published_at' => $this->published_at?->getTimestamp(),
            'created_at' => $this->created_at?->getTimestamp(),
        ];
    }

    // ─── Canonical URL foundation (ADR A3.6) ────────────────────────

    /**
     * المسار القانوني: /{locale}/articles/{id} — بالـ id فقط، بلا slug.
     *
     * المعرّف لا يتغيّر أبداً (خلاف الـ slug)، فيتفادى هشاشة المسارات عند تغيّر
     * القسم أو إعادة تسمية الـ slug. الجزء الأول بالجمع (articles) مطابقةً
     * لمسار صفحة المقال الفعليّة في الواجهة الأمامية الحاليّة
     * (frontend/src/app/(site)/articles/[idslug]/page.tsx، تقبل id مجرّداً أو
     * id-slug). أيّ مسار سابق مختلف يُحلّ عبر ArticleRedirectResolver
     * (article_url_history)، لا عبر تطابق نصّي هنا.
     */
    public function canonicalPath(): string
    {
        return '/'.trim("{$this->locale}/articles/{$this->id}", '/');
    }

    /**
     * رابط صورة الكاتب (إن وُجدت) — يُستخدَم كبديل للغلاف في محتوى الرأي/المقال.
     * يتطلّب تحميل علاقة author مع عمود avatar.
     */
    public function authorAvatarUrl(): ?string
    {
        return MediaUrl::forPublic($this->author?->avatar);
    }
}
