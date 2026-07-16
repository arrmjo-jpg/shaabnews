<?php

declare(strict_types=1);

namespace App\Health\Checks;

use App\Contracts\Broadcast\BroadcastPushDriver;
use Spatie\Health\Checks\Check;
use Spatie\Health\Checks\Result;

/**
 * يُظهر حالة دفع إشعارات البثّ صراحة — لا يمكن الخلط بين «مُعطَّل» و«مُقلَّد» و«حقيقيّ».
 * Task B (مراجعة الإنتاج): الناقل الوحيد المتاح اليوم (log) يُقلِّد فقط، فهذا الفحص
 * يبقى ok دائماً في الحالة الراهنة — قيمته تظهر لاحقاً إن اختير ناقل حقيقيّ (fcm)
 * بلا بيانات اعتماد صحيحة، أو إن عُطِّلت الإشعارات بالخطأ دون علم أحد.
 */
class BroadcastPushHealthCheck extends Check
{
    public function run(): Result
    {
        $enabled = (bool) config('broadcast.notifications.enabled', true);
        $driver = app(BroadcastPushDriver::class);

        $result = Result::make()->meta([
            'enabled' => $enabled,
            'driver' => $driver->name(),
            'configured' => $driver->configured(),
        ]);

        if (! $enabled) {
            return $result->shortSummary('Push disabled')->ok('Broadcast push notifications are disabled (broadcast.notifications.enabled=false).');
        }

        if (! $driver->configured()) {
            return $result->shortSummary('Push misconfigured')->failed(
                "Push is enabled but driver '{$driver->name()}' is not configured — notifications are not being delivered."
            );
        }

        if ($driver->name() === 'log') {
            return $result->shortSummary('Push stub (log only)')->ok(
                "Push driver is 'log' — notifications are logged, not delivered to any device. See docs/architecture/BROADCAST-PUSH.md to activate real delivery."
            );
        }

        return $result->shortSummary('Push active')->ok("Push driver '{$driver->name()}' is configured and active.");
    }
}
