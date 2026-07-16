<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Support\Audit\AuditsChanges;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * نوع حدث إشعار — مرآة DB لـEventCatalog (المصدر الكوديّ). الأدمن يبدّل enabled فقط؛ بقيّة
 * الحقول تُزامَن من الكتالوج. يُربط بمصفوفة القنوات (notification_event_channels).
 */
class NotificationEventType extends Model
{
    use AuditsChanges;

    protected $table = 'notification_events';

    protected string $auditLogName = 'notification_event';

    /** @var array<int,string> */
    protected array $auditAttributes = ['key', 'enabled', 'is_user_visible', 'supports_manual_dispatch'];

    protected $fillable = [
        'key', 'source', 'category', 'default_priority',
        'enabled', 'archived', 'is_user_visible', 'supports_manual_dispatch', 'description',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'archived' => 'boolean',
            'is_user_visible' => 'boolean',
            'supports_manual_dispatch' => 'boolean',
        ];
    }

    public function channels(): HasMany
    {
        return $this->hasMany(NotificationEventChannel::class, 'event_id');
    }
}
