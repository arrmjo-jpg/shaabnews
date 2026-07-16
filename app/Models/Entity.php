<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\EntityType;
use App\Support\Audit\AuditsChanges;
use App\Support\Content\SlugGenerator;
use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * سجلّ كيانات كنونيّ (أشخاص/منظّمات/أماكن/مواضيع) — منفصل عمداً عن
 * Spatie\Tags (المُستخدَم عبر Article::HasTags للكلمات المفتاحيّة الحرّة).
 * الوسوم الحرّة وتمييز الهويّة الكنونيّة (disambiguation) مشكلتان مختلفتان؛
 * انظر docs/adr/E5-entity-registry-not-tags.md.
 *
 * Phase 1: توسيم يدويّ فقط. الحقول التالية محجوزة لمراحل لاحقة وغير
 * مُستهلَكة الآن: external_ref (Knowledge Graph خارجيّ، Phase 4)،
 * content_entity.status/confidence (اقتراحات AI، Phase 5).
 */
class Entity extends Model
{
    use AuditsChanges;
    use Sluggable;
    use SoftDeletes;

    protected string $auditLogName = 'entity';

    /** @var array<int,string> */
    protected array $auditAttributes = [
        'type', 'name', 'slug', 'description', 'external_ref',
    ];

    protected $fillable = [
        'type', 'name', 'slug', 'description', 'external_ref', 'created_by_id',
    ];

    protected function casts(): array
    {
        return [
            'type' => EntityType::class,
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
                'maxLength' => 190,
                'method' => [self::class, 'arabicSlug'],
            ],
        ];
    }

    public static function arabicSlug(string $string, string $separator): string
    {
        return SlugGenerator::makeWithFallback($string, $separator);
    }

    /** فرادة الـ slug ضمن نفس النوع فقط (شخص وموضوع قد يتشابه اسمهما). */
    public function scopeWithUniqueSlugConstraints(
        Builder $query,
        Model $model,
        string $attribute,
        array $config,
        string $slug
    ): Builder {
        return $query->where('type', $model->type);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }
}
