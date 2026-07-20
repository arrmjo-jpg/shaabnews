<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\CategoryScope;
use App\Enums\CategoryStatus;
use App\Support\Audit\AuditsChanges;
use App\Support\Content\SlugGenerator;
use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * تصنيف محتوى هرمي (ADR محتوى — Wave C1).
 *
 * - عمق أقصى ثابت معماري (A5): MAX_DEPTH = 3 — ليس إعداداً قابلاً للتبديل.
 * - slug فريد لكل لغة، عربي-المحافظة، يشمل المحذوف منطقياً.
 * - منع الأب-الذاتي/الدائري/تجاوز العمق/عدم تطابق اللغة: في الـ Action.
 */
class Category extends Model
{
    use AuditsChanges;
    use Sluggable;
    use SoftDeletes;

    /** عمق التصنيف الأقصى — ثابت معماري (A5)، لا إعداد runtime. */
    public const MAX_DEPTH = 3;

    /** اللغات المدعومة (ADR D2 — جاهز للترجمة، المرحلة 1 عربي). */
    public const LOCALES = ['ar', 'en'];

    protected string $auditLogName = 'category';

    /** @var array<int,string> */
    protected array $auditAttributes = [
        'parent_id', 'locale', 'scope', 'name', 'slug', 'description',
        'icon', 'status', 'show_in_header', 'show_in_body',
        'show_in_footer', 'sort_order',
        'provider', 'external_id',
    ];

    protected $fillable = [
        'parent_id',
        'locale',
        'translation_group',
        'scope',
        'name',
        'slug',
        'description',
        'icon',
        'status',
        'show_in_header',
        'show_in_body',
        'show_in_footer',
        'sort_order',
        'provider',
        'external_id',
        'provider_metadata',
    ];

    protected function casts(): array
    {
        return [
            'status' => CategoryStatus::class,
            'scope' => CategoryScope::class,
            'show_in_header' => 'boolean',
            'show_in_body' => 'boolean',
            'show_in_footer' => 'boolean',
            'sort_order' => 'integer',
            'provider_metadata' => 'array',
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'name',
                'unique' => true,
                'includeTrashed' => true,
                'maxLength' => 160,
                'method' => [self::class, 'arabicSlug'],
            ],
        ];
    }

    /**
     * مولّد slug يحافظ على الحروف العربية — مُوحَّد عبر SlugGenerator.
     */
    public static function arabicSlug(string $string, string $separator): string
    {
        return SlugGenerator::makeWithFallback($string, $separator);
    }

    /**
     * تقييد فرادة الـ slug ضمن نفس اللغة فقط (ADR slug per-locale).
     */
    protected function scopeWithUniqueSlugConstraints(
        Builder $query,
        Model $model,
        string $attribute,
        array $config,
        string $slug
    ): Builder {
        return $query->where('locale', $model->locale);
    }

    // ─── Relationships ──────────────────────────────────────────────

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /** المقالات المربوطة كتصنيف ثانوي (pivot article_category). */
    public function articles(): BelongsToMany
    {
        return $this->belongsToMany(Article::class, 'article_category');
    }

    /** المقالات المربوطة كتصنيف رئيسي (primary_category_id). */
    public function primaryArticles(): HasMany
    {
        return $this->hasMany(Article::class, 'primary_category_id');
    }

    // ─── Scopes ─────────────────────────────────────────────────────

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', CategoryStatus::Active->value);
    }

    public function scopeForLocale(Builder $query, string $locale): Builder
    {
        return $query->where('locale', $locale);
    }

    // ─── Hierarchy helpers (used by validation Actions) ─────────────

    /**
     * عمق العقدة (1 = جذر). يصعد سلسلة الآباء بحدّ أمان MAX_DEPTH+1.
     */
    public function depth(): int
    {
        $depth = 1;
        $node = $this;

        while ($node->parent_id !== null && $depth <= self::MAX_DEPTH + 1) {
            $node = $node->parent()->first();
            if ($node === null) {
                break;
            }
            $depth++;
        }

        return $depth;
    }

    /**
     * أعمق امتداد للشجرة تحت هذه العقدة (1 = لا أبناء).
     */
    public function subtreeDepth(): int
    {
        $children = $this->children()->get();
        if ($children->isEmpty()) {
            return 1;
        }

        return 1 + $children->max(fn (self $c): int => $c->subtreeDepth());
    }

    /**
     * هل $candidateId يقع ضمن نسل هذه العقدة (لمنع الدورات).
     */
    public function isAncestorOf(int $candidateId): bool
    {
        foreach ($this->children()->get() as $child) {
            if ($child->id === $candidateId || $child->isAncestorOf($candidateId)) {
                return true;
            }
        }

        return false;
    }
}
