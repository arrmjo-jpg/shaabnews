<?php

declare(strict_types=1);

namespace App\Support\WpMigration;

/**
 * نتيجة حلّ مرجع صورة من متن ووردبريس:
 *  - local      : ملف موجود وآمن داخل جذر uploads (path مطلق مُتحقَّق).
 *  - external   : رابط http(s) خارجي (يجلبه المستورد بأمان SSRF + حدود).
 *  - unresolved : تعذّر الحلّ (reason = MigrationFailureReason) — يُوسَم، لا يُفسد المتن.
 */
final class MediaResolution
{
    /**
     * @param  array<int,string>  $fallbackUrls  مرشّحات بديلة تُجرَّب بالترتيب إن فشل
     *                                           $url (وضع التنزيل البعيد: الأصل ثم
     *                                           المشتقّ المُشار إليه). فارغة افتراضياً
     *                                           فلا يتغيّر سلوك أيّ مستدعٍ قائم.
     */
    private function __construct(
        public readonly string $kind,
        public readonly ?string $path,
        public readonly ?string $url,
        public readonly ?string $reason,
        public readonly array $fallbackUrls = [],
    ) {}

    public static function local(string $path): self
    {
        return new self('local', $path, null, null);
    }

    /** @param  array<int,string>  $fallbackUrls */
    public static function external(string $url, array $fallbackUrls = []): self
    {
        return new self('external', null, $url, null, array_values($fallbackUrls));
    }

    public static function unresolved(string $reason): self
    {
        return new self('unresolved', null, null, $reason);
    }

    /**
     * كل الروابط المرشّحة بالترتيب (الأساسي ثم البدائل)، بلا تكرار.
     *
     * @return array<int,string>
     */
    public function urlCandidates(): array
    {
        if ($this->url === null) {
            return [];
        }

        return array_values(array_unique(array_merge([$this->url], $this->fallbackUrls)));
    }

    public function isLocal(): bool
    {
        return $this->kind === 'local';
    }

    public function isExternal(): bool
    {
        return $this->kind === 'external';
    }

    public function isUnresolved(): bool
    {
        return $this->kind === 'unresolved';
    }
}
