<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\Audit\AuditsChanges;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * بطولة/دوري من مزوّد خارجي (365Scores اليوم؛ provider/provider_id يبقيانه عامًّا بلا ربط
 * بمزوّد بعينه). جذر تجميع "التغطية" فقط — ليس جذرًا واحدًا لكامل نطاق الرياضة (الفرق/اللاعبون
 * مستقلّون بهويّتهم).
 *
 * طبقتان مستقلّتان مقصودتان على هذا الموديل، بلا تأثير إحداهما على الأخرى:
 *   - التغطية (نظاميّة): is_tracked + last_synced_at — الوحيدة التي تُحدِّد نطاق المزامنة.
 *   - عرض شريط المباريات (تحريريّة): is_featured_tournament/featured_until/show_in_match_bar/
 *     match_bar_sort_order — تصفية عرض فقط فوق بيانات مُزامَنة أصلًا؛ لا تؤثّر إطلاقًا فيما يُزامَن.
 */
class Competition extends Model
{
    use AuditsChanges;
    use HasFactory;

    protected string $auditLogName = 'competition';

    /** @var array<int,string> */
    protected $fillable = [
        'provider', 'provider_id', 'name', 'logo_url', 'is_active',
        'is_tracked', 'last_synced_at',
        'is_featured_tournament', 'featured_until', 'show_in_match_bar', 'match_bar_sort_order',
    ];

    /** @var array<int,string> */
    protected array $auditAttributes = [
        'name', 'is_active',
        'is_tracked',
        'is_featured_tournament', 'featured_until', 'show_in_match_bar', 'match_bar_sort_order',
    ];

    protected function casts(): array
    {
        return [
            'provider_id' => 'integer',
            'is_active' => 'boolean',
            'is_tracked' => 'boolean',
            'last_synced_at' => 'datetime',
            'is_featured_tournament' => 'boolean',
            'featured_until' => 'date',
            'show_in_match_bar' => 'boolean',
            'match_bar_sort_order' => 'integer',
        ];
    }

    public function fixtures(): HasMany
    {
        return $this->hasMany(Fixture::class);
    }

    /** تغطية نشطة — النطاق الوحيد الذي تقرأه مهمّة المزامنة. */
    public function scopeTracked(Builder $query): Builder
    {
        return $query->where('is_tracked', true);
    }

    /** بطولات مميَّزة وغير منتهية الصلاحية (featured_until فارغ أو لم يَحِن بعد). */
    public function scopeCurrentlyFeatured(Builder $query): Builder
    {
        return $query->where('is_featured_tournament', true)
            ->where(fn (Builder $q) => $q->whereNull('featured_until')->orWhereDate('featured_until', '>=', now()));
    }
}
