<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Audit\AuditsChanges;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * عنصر قائمة "أقسام الرياضة" في الهيدر الأول (Sports Engine — Approved Architecture Baseline
 * v1.0, §8) — مفهوم مستقلّ تمامًا عن شجرة تصنيفات نوع الرياضة (Football/Basketball/... في
 * Category). كل عنصر إمّا:
 * - تحريريّ (type=category): category_id يشير إلى تصنيف حقيقي (أخبار/انتقالات/فيديو/مقالات).
 * - وظيفيّ (type=section): section_key نصّ ثابت يشير إلى صفحة/عرض في محرّك الرياضة
 *   (مباريات/نتائج/بطولات/فرق/لاعبون/توقعات) — لا تصنيف حقيقي وراءه.
 * التحقّق من أنّ أحدهما فقط مضبوط بحسب type يقع في FormRequest (طبقة الإدارة)، لا هنا.
 */
class SportMenuItem extends Model
{
    use AuditsChanges;
    use HasFactory;

    protected string $auditLogName = 'sport_menu_item';

    /** @var array<int,string> */
    protected array $auditAttributes = [
        'parent_id', 'locale', 'title', 'type', 'category_id',
        'section_key', 'icon', 'order', 'enabled',
    ];

    protected $fillable = [
        'parent_id',
        'locale',
        'title',
        'type',
        'category_id',
        'section_key',
        'icon',
        'order',
        'enabled',
    ];

    protected function casts(): array
    {
        return [
            'order' => 'integer',
            'enabled' => 'boolean',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
