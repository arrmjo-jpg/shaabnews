<?php

declare(strict_types=1);

namespace App\Support\Cache;

use Closure;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * قراءة مُخزَّنة بحماية single-flight ضدّ عاصفة الطوابير (cache stampede).
 *
 * المشكلة: Cache::tags()->remember() القياسي يسمح لعدّة طلبات متزامنة بإعادة بناء
 * نفس المفتاح فور انتهائه/إبطاله (أخبار عاجلة/مقال فيروسي) — ضربة متزامنة على DB.
 *
 * الحل: قفل لكل مفتاح (Cache::lock) يضمن أن **طلباً واحداً فقط** يعيد البناء؛
 * البقية تنتظر القفل (block) ثم تقرأ القيمة الجاهزة. عند انتهاء مهلة الانتظار
 * (المُنتِج بطيء) نرتدّ بأمان إلى حساب مباشر دون كاش — لا deadlock ولا فساد.
 *
 * تغليف القيمة في ['v' => …] يميّز «null مُخزَّن» (نتيجة فعلية) عن «غياب» (miss)،
 * فيُخزَّن الـ 404/إعادة التوجيه ولا يُعاد حسابه في كل طلب (يمنع عاصفة على الغياب).
 *
 * يتطلّب مخزناً يدعم الأقفال (redis/array) — متوفّر إنتاجاً واختباراً.
 */
final class CachedRead
{
    /** مهلة انتظار القفل بالثواني (المنتظِرون) قبل الارتداد للحساب المباشر. */
    private const BLOCK_SECONDS = 5;

    /** أقصى عمر للقفل بالثواني (حماية ضدّ منتِج عالق). */
    private const LOCK_TTL = 15;

    private const LOG_CHANNEL = 'perf';

    /**
     * @param  array<int,string>  $tags
     */
    public static function remember(array $tags, string $key, int $ttl, Closure $callback): mixed
    {
        $store = Cache::tags($tags);
        $context = [
            'key' => $key,
            'request_id' => request()->header('X-Request-ID') ?? 'n/a',
            'tags' => $tags,
        ];

        $hit = $store->get($key);
        if (is_array($hit) && array_key_exists('v', $hit)) {
            return $hit['v'];
        }

        $lock = Cache::lock('swr:'.$key, self::LOCK_TTL);
        $t_before_lock = microtime(true);

        try {
            return $lock->block(self::BLOCK_SECONDS, function () use ($store, $key, $ttl, $callback, $t_before_lock, $context): mixed {
                $t_lock_acquired = microtime(true);
                $wait_ms = ($t_lock_acquired - $t_before_lock) * 1000;

                $again = $store->get($key);
                if (is_array($again) && array_key_exists('v', $again)) {
                    Log::channel(self::LOG_CHANNEL)->info('CachedRead: lock acquired, hit found', array_merge($context, ['wait_ms' => $wait_ms]));

                    return $again['v'];
                }

                $t_cb = microtime(true);
                $value = $callback();
                $cb_ms = (microtime(true) - $t_cb) * 1000;

                Log::channel(self::LOG_CHANNEL)->info('CachedRead: lock acquired, callback executed', array_merge($context, ['wait_ms' => $wait_ms, 'callback_ms' => $cb_ms]));

                $store->put($key, ['v' => $value], $ttl);

                return $value;
            });
        } catch (LockTimeoutException) {
            $wait_ms = (microtime(true) - $t_before_lock) * 1000;

            $hit = $store->get($key);
            if (is_array($hit) && array_key_exists('v', $hit)) {
                Log::channel(self::LOG_CHANNEL)->warning('CachedRead: LockTimeoutException, resolved via late hit', array_merge($context, ['wait_ms' => $wait_ms]));

                return $hit['v'];
            }

            Log::channel(self::LOG_CHANNEL)->critical('CachedRead: LockTimeoutException, stampede detected, triggering fallback', array_merge($context, [
                'wait_ms' => $wait_ms,
                'timestamp' => now()->toIso8601String(),
                'memory_usage' => memory_get_usage(true),
            ]));

            $t_fb = microtime(true);
            $value = $callback();
            $fb_ms = round((microtime(true) - $t_fb) * 1000, 2);

            Log::channel(self::LOG_CHANNEL)->critical('CachedRead: STAMPEDE — fallback completed', array_merge($context, [
                'fallback_ms' => $fb_ms,
            ]));

            return $value;
        }
    }
}
