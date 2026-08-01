<?php

declare(strict_types=1);

namespace App\Support\WpMigration;

use App\Actions\Admin\Media\StoreMediaAssetAction;
use App\Enums\MigrationMediaStatus;
use App\Models\MediaAsset;
use App\Models\MigrationMedia;
use App\Models\MigrationRun;
use App\Models\User;
use App\Support\Security\SafeUrl;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * يستورد صور المتن/الصورة البارزة إلى مكتبة MediaAsset ويعيد كتابة عقد الصور.
 *
 * القواعد: ديدوب عالمي عبر StoreMediaAssetAction (SHA-256) #1؛ إعادة كتابة من
 * المصدر القانوني فقط #1؛ ديدوب لكل-منشور (memo) — استيراد مرّة، كتابة مراراً #2؛
 * حدّ تشعّب لكل منشور #3؛ حدّ حجم حتميّ #4؛ تحقّق MIME بالمحتوى (finfo) #5؛
 * جلب خارجي بأمان SSRF (SafeUrl) + مهلة/محاولات/تحديد إعادة توجيه #3/#4؛
 * عند الفشل: يُبقي المرجع الأصلي ويُسجّل تحذيراً مُصنَّفاً — لا يُفسد المتن #1.
 *
 * دفتر الوسائط (wp_migration_media، $run غير null): كل مرجع صورة — بهويّة ثابتة
 * عبر إعادة التشغيل (source_key = att:{wp_attachment_id} للصورة البارزة، أو
 * url:{sha1(src)} لصور المتن الداخلية بلا معرّف مرفق) — يُسجَّل بنتيجته (نجاح مع
 * media_asset_id/checksum، أو فشل مع last_error + عدّاد محاولات). عند إعادة
 * التشغيل: نجاح سابق (والأصل ما يزال موجوداً) ⇒ إعادة استخدام فورية بلا شبكة ولا
 * قرص؛ فشل سابق دون بلوغ الحدّ ⇒ محاولة جديدة؛ فشل بلغ الحدّ ⇒ توقّف فوري (dead-
 * letter) بلا إنهاك الشبكة بمحاولات لا تنتهي. $run=null (اختبارات مباشرة لا
 * تستدعي ImportWpPostAction) يُبقي السلوك القديم بلا دفتر إطلاقاً.
 */
final class WpMediaImporter
{
    public function __construct(
        private readonly WpMediaResolver $resolver,
        private readonly User $actor,
        private readonly ?MigrationRun $run = null,
    ) {}

    /**
     * يعيد كتابة عقد الصور في مستند TipTap (من المصدر القانوني).
     *
     * @param  array<string,mixed>  $doc
     */
    public function rewriteDoc(array $doc): MediaRewriteResult
    {
        /** @var array<string,array{ok:bool,url:?string,asset_id:?int}> $memo */
        $memo = [];
        $imported = 0;
        $reused = 0;
        $attempts = 0;
        $warnings = [];
        $perPostMax = (int) config('wp-migration.media.per_post_max', 40);

        $resolveSrc = function (string $src) use (&$memo, &$imported, &$reused, &$attempts, &$warnings, $perPostMax): ?string {
            if (array_key_exists($src, $memo)) {
                if ($memo[$src]['ok']) {
                    $reused++;

                    return $memo[$src]['url'];
                }

                return null; // فشل سابق — يُبقى الأصل
            }

            if ($attempts >= $perPostMax) {
                $warnings[] = ['src' => $src, 'reason' => 'media_capped'];
                $memo[$src] = ['ok' => false, 'url' => null, 'asset_id' => null];

                return null;
            }

            $attempts++;
            $result = $this->import($src);
            if ($result['asset'] instanceof MediaAsset) {
                $url = $result['asset']->url();
                $memo[$src] = ['ok' => $url !== null, 'url' => $url, 'asset_id' => $result['asset']->id];
                if ($url !== null) {
                    $imported++;

                    return $url;
                }
            }

            $memo[$src] = $memo[$src] ?? ['ok' => false, 'url' => null, 'asset_id' => null];
            $warnings[] = ['src' => $src, 'reason' => $result['reason'] ?? 'media_unresolved'];

            return null;
        };

        $rewritten = $this->walk($doc, $resolveSrc);

        $assetBySrc = [];
        foreach ($memo as $src => $m) {
            if ($m['ok'] && $m['asset_id'] !== null) {
                $assetBySrc[$src] = $m['asset_id'];
            }
        }

        return new MediaRewriteResult($rewritten, $imported, $reused, $warnings, $assetBySrc);
    }

    /**
     * يستورد صورة واحدة (محلية/خارجية) → MediaAsset أو فشل مُصنَّف.
     *
     * $wpAttachmentId: مُمرَّر من الصورة البارزة فقط (معرّف مرفق ووردبريس معروف) —
     * صور المتن الداخلية تُترَك null فتُعرَّف بهاش الرابط بدلاً منه (#انظر تعليق الصنف).
     *
     * @return array{asset: ?MediaAsset, reason: ?string}
     */
    public function import(string $src, ?int $wpAttachmentId = null): array
    {
        if ($this->run === null) {
            return $this->resolveAndStore($src);
        }

        $sourceKey = $wpAttachmentId !== null ? "att:{$wpAttachmentId}" : 'url:'.sha1($src);

        $ledger = MigrationMedia::firstOrNew(['run_id' => $this->run->id, 'source_key' => $sourceKey]);

        if ($ledger->exists) {
            if ($ledger->status === MigrationMediaStatus::Done && $ledger->media_asset_id !== null) {
                $existing = MediaAsset::find($ledger->media_asset_id);
                if ($existing !== null) {
                    return ['asset' => $existing, 'reason' => null]; // إعادة استخدام فورية — بلا شبكة/قرص
                }
                // الأصل المسجَّل اختفى (حُذف يدويّاً) رغم تسجيله منجزاً — أعد المحاولة بدل التعليق الدائم.
            } elseif ($ledger->status === MigrationMediaStatus::Failed
                && $ledger->attempts >= $this->maxMediaAttempts()) {
                return ['asset' => null, 'reason' => $ledger->last_error ?? 'media_unresolved']; // dead-letter
            }
        }

        $ledger->forceFill([
            'wp_attachment_id' => $wpAttachmentId,
            'source_url' => $src,
            'status' => MigrationMediaStatus::Processing->value,
            'attempts' => ($ledger->attempts ?? 0) + 1,
        ])->save();

        $result = $this->resolveAndStore($src);

        if ($result['asset'] !== null) {
            $ledger->forceFill([
                'media_asset_id' => $result['asset']->id,
                'checksum' => $result['asset']->checksum,
                'status' => MigrationMediaStatus::Done->value,
                'imported_at' => now(),
                'last_error' => null,
            ])->save();
        } else {
            $ledger->forceFill([
                'status' => MigrationMediaStatus::Failed->value,
                'last_error' => mb_substr((string) $result['reason'], 0, 500),
            ])->save();
        }

        return $result;
    }

    /** @return array{asset: ?MediaAsset, reason: ?string} */
    private function resolveAndStore(string $src): array
    {
        $resolution = $this->resolver->resolve($src);

        if ($resolution->isUnresolved()) {
            return ['asset' => null, 'reason' => $resolution->reason ?? 'media_unresolved'];
        }

        if ($resolution->isLocal()) {
            return $this->importLocal((string) $resolution->path);
        }

        // مرشّحات بالترتيب (الأصل ثم المشتقّ المُشار إليه في وضع التنزيل البعيد).
        // أوّل نجاح يفوز؛ عند فشل الجميع نُبقي سبب آخر محاولة كتصنيف الفشل.
        $reason = 'media_unresolved';
        foreach ($resolution->urlCandidates() as $candidate) {
            $result = $this->importExternal($candidate);
            if ($result['asset'] !== null) {
                return $result;
            }
            $reason = $result['reason'] ?? $reason;
        }

        return ['asset' => null, 'reason' => $reason];
    }

    private function maxMediaAttempts(): int
    {
        return (int) config('wp-migration.media.max_attempts', 3);
    }

    /** @return array{asset: ?MediaAsset, reason: ?string} */
    private function importLocal(string $path): array
    {
        $size = @filesize($path);
        if ($size === false) {
            return ['asset' => null, 'reason' => 'media_unresolved'];
        }
        if ($size > $this->maxBytes()) {
            return ['asset' => null, 'reason' => 'media_too_large'];
        }

        $mime = self::sniffMime($path);
        if (! $this->allowedMime($mime)) {
            return ['asset' => null, 'reason' => 'media_unsupported_mime'];
        }

        try {
            $file = new UploadedFile($path, basename($path), $mime, null, true);

            return ['asset' => (new StoreMediaAssetAction)->handle($file, $this->actor), 'reason' => null];
        } catch (Throwable) {
            return ['asset' => null, 'reason' => 'persist_failed'];
        }
    }

    /** @return array{asset: ?MediaAsset, reason: ?string} */
    private function importExternal(string $url): array
    {
        if (! SafeUrl::isPublicHttps($url)) {
            return ['asset' => null, 'reason' => 'media_ssrf_blocked'];
        }

        $tmp = tempnam(sys_get_temp_dir(), 'wpmig');
        if ($tmp === false) {
            return ['asset' => null, 'reason' => 'media_network_error'];
        }

        try {
            // مهلة اتصال منفصلة عن مهلة التنزيل: خادم لا يستجيب يُقصَّر عليه سريعاً،
            // بينما تبقى للصور الكبيرة مهلة نقل أطول.
            $response = Http::connectTimeout($this->connectTimeout())
                ->timeout($this->timeout())
                ->retry($this->retries(), 200, throw: false)
                ->withOptions(['allow_redirects' => [
                    'max' => $this->maxRedirects(),
                    'strict' => true,
                    'protocols' => ['https'],
                ]])
                ->get($url);

            // 1) حالة HTTP.
            if (! $response->successful()) {
                return ['asset' => null, 'reason' => 'media_network_error'];
            }

            // 2) ترويسة Content-Type (فحص مبكّر رخيص). صفحة خطأ HTML بحالة 200 —
            //    وهو سلوك شائع في ووردبريس — تُرفَض هنا قبل كتابة أيّ بايت للقرص.
            $declared = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0]));
            if ($declared !== '' && ! $this->allowedMime($declared)) {
                return ['asset' => null, 'reason' => 'media_unsupported_mime'];
            }

            // 3) الحجم.
            $body = (string) $response->body();
            if (strlen($body) > $this->maxBytes()) {
                return ['asset' => null, 'reason' => 'media_too_large'];
            }
            if ($body === '') {
                return ['asset' => null, 'reason' => 'media_network_error'];
            }

            // 4) الصيغة الحقيقية بالمحتوى (finfo) — هي الحاكمة، لا الترويسة.
            file_put_contents($tmp, $body);
            $mime = self::sniffMime($tmp);
            if (! $this->allowedMime($mime)) {
                return ['asset' => null, 'reason' => 'media_unsupported_mime'];
            }

            $file = new UploadedFile($tmp, self::remoteFilename($url, $mime), $mime, null, true);

            $asset = (new StoreMediaAssetAction)->handle($file, $this->actor);
            // احتفظ بالرابط الأصلي كبيانات وصفية (source_url موجود أصلاً على media_assets
            // منذ 2026_05_20_130000) — لا يُكتب فوق قيمة موجودة (مثلاً عند إعادة استخدام
            // أصل مُديدَب من مصدر آخر سبق أن سجّل رابطه الخاص).
            if ($asset->source_url === null) {
                $asset->forceFill(['source_url' => $url])->save();
            }

            return ['asset' => $asset, 'reason' => null];
        } catch (Throwable) {
            return ['asset' => null, 'reason' => 'media_network_error'];
        } finally {
            @unlink($tmp);
        }
    }

    /**
     * @param  array<string,mixed>  $node
     * @return array<string,mixed>
     */
    private function walk(array $node, callable $resolveSrc): array
    {
        if (($node['type'] ?? '') === 'image' && isset($node['attrs']['src'])) {
            $url = $resolveSrc((string) $node['attrs']['src']);
            if ($url !== null) {
                $node['attrs']['src'] = $url; // نجاح → إعادة كتابة
            }
            // فشل → يُبقى المرجع الأصلي كما هو (لا إفساد للمتن)
        }

        if (isset($node['content']) && is_array($node['content'])) {
            $node['content'] = array_map(
                fn ($child) => is_array($child) ? $this->walk($child, $resolveSrc) : $child,
                $node['content'],
            );
        }

        return $node;
    }

    private static function sniffMime(string $path): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo === false) {
            return '';
        }
        $mime = (string) finfo_file($finfo, $path);
        finfo_close($finfo);

        return $mime;
    }

    private function allowedMime(string $mime): bool
    {
        return in_array($mime, (array) config('wp-migration.media.allowed_mimes', []), true);
    }

    /**
     * اسم ملفّ مُشتقّ من رابط ووردبريس (يُحفظ في original_name فيبقى الأثر واضحاً
     * في مكتبة الوسائط بدل «remote-x7f2a»). الامتداد يأتي من الصيغة المُتحقَّق منها
     * بالمحتوى لا من الرابط، فلا يُصدَّق امتداد كاذب. اسم متعذّر ⇒ بديل عشوائي.
     */
    private static function remoteFilename(string $url, string $mime): string
    {
        $path = (string) parse_url($url, PHP_URL_PATH);
        $base = $path !== '' ? rawurldecode(basename($path)) : '';

        // جرّد الامتداد الأصلي ونظّف الفواصل الخطرة (مسار/بايت صفري)، مع إبقاء
        // المحارف العربية كما هي (المكتبة تخزّن الاسم كبيانات وصفية فقط).
        $name = (string) preg_replace('/\.[A-Za-z0-9]{1,5}$/', '', $base);
        $name = str_replace(['/', '\\', "\0"], '', $name);
        $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');

        if ($name === '' || $name === '.' || $name === '..') {
            $name = 'remote-'.Str::random(8);
        }

        return mb_substr($name, 0, 120).self::extFor($mime);
    }

    private static function extFor(string $mime): string
    {
        return match ($mime) {
            'image/jpeg' => '.jpg',
            'image/png' => '.png',
            'image/webp' => '.webp',
            'image/gif' => '.gif',
            'image/avif' => '.avif',
            default => '',
        };
    }

    private function maxBytes(): int
    {
        return (int) config('wp-migration.media.max_bytes', 26214400);
    }

    private function timeout(): int
    {
        return (int) config('wp-migration.media.fetch_timeout', 10);
    }

    private function connectTimeout(): int
    {
        return (int) config('wp-migration.media.fetch_connect_timeout', 5);
    }

    private function retries(): int
    {
        return (int) config('wp-migration.media.fetch_retries', 2);
    }

    private function maxRedirects(): int
    {
        return (int) config('wp-migration.media.fetch_max_redirects', 2);
    }
}
