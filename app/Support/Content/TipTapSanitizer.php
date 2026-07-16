<?php

declare(strict_types=1);

namespace App\Support\Content;

use App\Enums\EmbedProvider;

/**
 * مُعقِّم/مُحقِّق مستند TipTap (قرار P4-D1 المقفول).
 *
 * - allow-list صارمة للعقد/العلامات/السمات.
 * - عقدة/علامة/سمة غير معروفة أو خطرة ⇒ رفض (validate=false).
 * - clean() يطبّع: يحذف السمات غير المسموحة، **ويصلح الروابط الملوّثة** (اقتباسات/مسافات
 *   مُحيطة من محتوى قديم مثل src="\"https://...\"")، **ويُسقِط** الصور/التضمينات/الروابط
 *   غير القابلة للإصلاح — فيضمن أنّ ناتج clean() يجتاز validate() دائماً (clean ⊆ validate).
 * - التضمينات عقد منمّطة فقط (provider مسموح + رابط آمن) — لا iframe/html.
 */
final class TipTapSanitizer
{
    private const NODES = [
        'doc', 'paragraph', 'text', 'heading', 'blockquote',
        'bulletList', 'orderedList', 'listItem', 'codeBlock',
        'horizontalRule', 'hardBreak', 'image', 'embed', 'poll',
        'table', 'tableRow', 'tableHeader', 'tableCell',
    ];

    private const MARKS = ['bold', 'italic', 'underline', 'strike', 'code', 'link'];

    /** محاذاة النص المسموحة على الفقرة/العنوان. */
    private const ALIGNMENTS = ['left', 'center', 'right', 'justify'];

    public static function validate(mixed $doc): bool
    {
        return is_array($doc)
            && ($doc['type'] ?? null) === 'doc'
            && self::validNode($doc);
    }

    /** يُعيد مستنداً مطبّعاً بسمات/روابط مسموحة فقط — ناتجه يجتاز validate() دائماً. */
    public static function clean(array $doc): array
    {
        return self::cleanNode($doc) ?? ['type' => 'doc'];
    }

    // ─── Validation ─────────────────────────────────────────────────

    private static function validNode(array $node): bool
    {
        $type = $node['type'] ?? null;
        if (! is_string($type) || ! in_array($type, self::NODES, true)) {
            return false;
        }

        if ($type === 'text') {
            if (! isset($node['text']) || ! is_string($node['text'])) {
                return false;
            }
            if (! self::validMarks($node['marks'] ?? [])) {
                return false;
            }
        }

        if (! self::validAttrs($type, $node['attrs'] ?? [])) {
            return false;
        }

        foreach (($node['content'] ?? []) as $child) {
            if (! is_array($child) || ! self::validNode($child)) {
                return false;
            }
        }

        return true;
    }

    private static function validMarks(mixed $marks): bool
    {
        if (! is_array($marks)) {
            return false;
        }

        foreach ($marks as $mark) {
            $t = $mark['type'] ?? null;
            if (! is_string($t) || ! in_array($t, self::MARKS, true)) {
                return false;
            }
            if ($t === 'link' && ! self::safeUrl($mark['attrs']['href'] ?? null, true)) {
                return false;
            }
        }

        return true;
    }

    private static function validAttrs(string $type, mixed $attrs): bool
    {
        if (! is_array($attrs)) {
            return false;
        }

        return match ($type) {
            'heading' => is_int($attrs['level'] ?? 1) && ($attrs['level'] ?? 1) >= 1 && ($attrs['level'] ?? 1) <= 6
                && self::validAlign($attrs),
            'paragraph' => self::validAlign($attrs),
            'image' => self::safeUrl($attrs['src'] ?? null),
            'embed' => in_array($attrs['provider'] ?? null, EmbedProvider::values(), true)
                && self::safeUrl($attrs['embed_url'] ?? null),
            'poll' => self::validUuid($attrs['uuid'] ?? null),
            default => true,
        };
    }

    /** textAlign اختياري: غائب/null أو ضمن المجموعة المسموحة. */
    private static function validAlign(array $attrs): bool
    {
        $align = $attrs['textAlign'] ?? null;

        return $align === null || (is_string($align) && in_array($align, self::ALIGNMENTS, true));
    }

    /**
     * يطبّع الرابط قبل فحصه: يقصّ المسافات وعلامات الاقتباس المُحيطة (تلوّث بيانات قديم
     * شائع: قيمة src/href تأتي محاطة بعلامة اقتباس حرفيّة "\"https://...\""). ثمّ يتحقّق
     * أنّ المخطّط http/https (و mailto عند السماح) عبر بادئة صريحة — أمتن من parse_url
     * الذي يفشل على روابط تحوي محارف خاصّة فيرفض روابط https سليمة.
     */
    private static function safeUrl(mixed $url, bool $allowMailto = false): bool
    {
        if (! is_string($url)) {
            return false;
        }
        $url = self::normalizeUrl($url);
        if ($url === '') {
            return false;
        }

        return preg_match('#^https?://#i', $url) === 1
            || ($allowMailto && preg_match('#^mailto:#i', $url) === 1);
    }

    /** قصّ المسافات وعلامات الاقتباس (مزدوجة/مفردة) المُحيطة بالرابط. */
    private static function normalizeUrl(mixed $url): string
    {
        if (! is_string($url)) {
            return '';
        }

        return trim($url, " \t\n\r\0\x0B\"'");
    }

    /** uuid صالح بنيوياً (لا يتحقّق من الوجود — التدهور الرشيق يكون وقت العرض). */
    private static function validUuid(mixed $uuid): bool
    {
        return is_string($uuid)
            && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid) === 1;
    }

    // ─── Normalization (strip non-whitelisted attrs + repair/drop) ──────

    /** @return array<string,mixed>|null  null ⇒ تُسقَط العقدة (غير قابلة للإصلاح). */
    private static function cleanNode(array $node): ?array
    {
        $type = $node['type'] ?? null;
        if (! is_string($type)) {
            return null;
        }

        // أسقِط عقدة نصّ بلا نصّ صالح (مخرجات محرّر شاذّة: {"type":"text","text":null}) —
        // لا تحمل محتوى، ويرفضها validate. إسقاطها يجعل المستند صالحاً بلا فقدان.
        if ($type === 'text' && ! is_string($node['text'] ?? null)) {
            return null;
        }

        // أسقِط الصور/التضمينات غير القابلة للإصلاح (src/embed_url غير آمن) ⇒ clean ⊆ validate.
        if ($type === 'image' && ! self::safeUrl($node['attrs']['src'] ?? null)) {
            return null;
        }
        if ($type === 'embed' && ! self::validAttrs('embed', $node['attrs'] ?? [])) {
            return null;
        }

        $out = ['type' => $type];

        if ($type === 'text') {
            $out['text'] = $node['text'] ?? '';
            $marks = [];
            foreach (($node['marks'] ?? []) as $m) {
                $mt = $m['type'] ?? null;
                // أسقِط رابطاً غير آمن (يبقى النصّ بلا علامة).
                if ($mt === 'link' && ! self::safeUrl($m['attrs']['href'] ?? null, true)) {
                    continue;
                }
                $cm = ['type' => $mt];
                if ($mt === 'link') {
                    $cm['attrs'] = [
                        'href' => self::normalizeUrl($m['attrs']['href'] ?? ''),
                        'target' => '_blank',
                        'rel' => 'noopener noreferrer nofollow',
                    ];
                }
                $marks[] = $cm;
            }
            if ($marks !== []) {
                $out['marks'] = $marks;
            }
        }

        $attrs = self::cleanAttrs($type, $node['attrs'] ?? []);
        if ($attrs !== []) {
            $out['attrs'] = $attrs;
        }

        $content = [];
        foreach (($node['content'] ?? []) as $child) {
            $clean = is_array($child) ? self::cleanNode($child) : null;
            if ($clean !== null) {
                $content[] = $clean;
            }
        }
        if ($content !== []) {
            $out['content'] = $content;
        }

        return $out;
    }

    private static function cleanAttrs(string $type, array $attrs): array
    {
        return match ($type) {
            'heading' => array_filter([
                'level' => (int) ($attrs['level'] ?? 1),
                'textAlign' => self::cleanAlign($attrs),
            ], fn ($v) => $v !== null),
            'paragraph' => array_filter([
                'textAlign' => self::cleanAlign($attrs),
            ], fn ($v) => $v !== null),
            'image' => array_filter([
                'src' => self::normalizeUrl($attrs['src'] ?? ''),
                'alt' => isset($attrs['alt']) ? (string) $attrs['alt'] : null,
                'title' => isset($attrs['title']) ? (string) $attrs['title'] : null,
            ], fn ($v) => $v !== null),
            'codeBlock' => isset($attrs['language'])
                ? ['language' => (string) $attrs['language']] : [],
            'embed' => array_filter([
                'provider' => $attrs['provider'],
                'embed_url' => self::normalizeUrl($attrs['embed_url'] ?? ''),
                'id' => isset($attrs['id']) ? (string) $attrs['id'] : null,
            ], fn ($v) => $v !== null),
            'poll' => ['uuid' => (string) $attrs['uuid']],
            default => [],
        };
    }

    /** يُعيد محاذاة صريحة غير افتراضية فقط (يحذف null/left للإبقاء على JSON نظيف). */
    private static function cleanAlign(array $attrs): ?string
    {
        $align = $attrs['textAlign'] ?? null;

        return is_string($align) && in_array($align, ['center', 'right', 'justify'], true)
            ? $align
            : null;
    }
}
