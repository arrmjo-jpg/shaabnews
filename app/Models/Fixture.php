<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * موعد مباراة من مزوّد خارجي، مُزامَن دوريًّا لبطولات التغطية (Competition::is_tracked).
 * **عمدًا بلا AuditsChanges**: مرآة بيانات خارجيّة تُزامَن آليًّا كل دقيقة إلى دقيقتين، لا موديل
 * نطاق ذا تاريخ تغيير دلاليّ — نفس استثناء SportFixture الموثَّق (راجع model-audit). الكتابة عبر
 * updateOrCreate (المزامنة) فقط.
 */
class Fixture extends Model
{
    use HasFactory;

    /** @var array<int,string> */
    protected $fillable = [
        'provider', 'provider_id', 'competition_id',
        'home_name', 'home_logo', 'home_score',
        'away_name', 'away_logo', 'away_score',
        'status', 'status_text', 'kickoff_at',
    ];

    protected function casts(): array
    {
        return [
            'provider_id' => 'integer',
            'competition_id' => 'integer',
            'home_score' => 'integer',
            'away_score' => 'integer',
            'kickoff_at' => 'datetime',
        ];
    }

    public function competition(): BelongsTo
    {
        return $this->belongsTo(Competition::class);
    }
}
