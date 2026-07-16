<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MigrationMediaStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * سجلّ ترحيل وسيط مصدر واحد → MediaAsset. يضمن استئنافاً دقيقاً وعدم تكرار
 * التنزيل/الاستيراد عبر المفتاح الفريد (run_id, source_key) و checksum الديدوب.
 */
class MigrationMedia extends Model
{
    protected $table = 'wp_migration_media';

    protected $fillable = [
        'run_id',
        'source_key',
        'wp_attachment_id',
        'source_url',
        'media_asset_id',
        'checksum',
        'status',
        'attempts',
        'imported_at',
        'last_error',
    ];

    protected function casts(): array
    {
        return [
            'status' => MigrationMediaStatus::class,
            'wp_attachment_id' => 'integer',
            'media_asset_id' => 'integer',
            'imported_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<MigrationRun, MigrationMedia> */
    public function run(): BelongsTo
    {
        return $this->belongsTo(MigrationRun::class, 'run_id');
    }

    /** @return BelongsTo<MediaAsset, MigrationMedia> */
    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }
}
