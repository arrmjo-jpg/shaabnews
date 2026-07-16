<?php

declare(strict_types=1);

namespace App\Support\Content;

use DOMComment;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;

/**
 * محوّل HTML → مستند TipTap **عامّ عالي الوفاء** (مُشترَك محايد — يُعاد استخدامه في ترحيل
 * ووردبريس وترحيل Vertix). القرار: الحفظ > التجميل. يُبقي العناوين والاقتباسات والقوائم
 * والجداول والصور/التسميات والتضمينات المتوافقة (EmbedProvider)، ولا يجرّد بعدوانية.
 *
 * صور المتن تبقى بمصدرها الأصلي (للمستهلك أن يعيد كتابة src إن شاء؛ Vertix يُبقيها كما هي).
 * التضمين غير المتوافق يُحفَظ كرابط (لا يُسقَط صامتاً). تعليقات HTML/Gutenberg تُتجاهَل.
 * المخرجات تطابق عقد App\Support\Content\TipTapSanitizer (تجتاز validate بعد إصلاح الروابط).
 */
final class HtmlToTipTap
{
    /** عناصر مضمّنة تُجمَّع داخل فقرة. */
    private const INLINE_TAGS = [
        'a', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
        'code', 'span', 'br', 'img', 'sub', 'sup', 'mark', 'small', 'cite', 'abbr',
    ];

    /** عناصر تُسقَط بالكامل (نصّ/أمان زائف لا قيمة تحريرية له). */
    private const DROP_TAGS = ['script', 'style', 'noscript', 'svg', 'form', 'input', 'button', 'nav'];

    /**
     * @return array{doc: array<string,mixed>, warnings: array<int,string>, images: array<int,string>}
     */
    public static function transform(string $html): array
    {
        $warnings = [];
        $html = trim($html);
        if ($html === '') {
            return ['doc' => self::doc([]), 'warnings' => [], 'images' => []];
        }

        $root = self::parse($html);
        if ($root === null) {
            return [
                'doc' => self::doc([self::paragraph([self::text($html, [])])]),
                'warnings' => ['parse_failed'],
                'images' => [],
            ];
        }

        $blocks = [];
        $inline = [];
        self::walk($root, $blocks, $inline, $warnings);
        self::flush($inline, $blocks);

        $images = self::collectImages($blocks);

        return [
            'doc' => self::doc($blocks),
            'warnings' => array_values(array_unique($warnings)),
            'images' => $images,
        ];
    }

    // ─── DOM parsing (UTF-8 safe) ────────────────────────────────────────────

    private static function parse(string $html): ?DOMElement
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        libxml_use_internal_errors(true);
        $ok = $dom->loadHTML(
            '<?xml encoding="UTF-8" ?><div id="htmltiptap-root">'.$html.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOERROR | LIBXML_NOWARNING
        );
        libxml_clear_errors();

        if (! $ok) {
            return null;
        }

        $root = $dom->getElementById('htmltiptap-root');

        return $root instanceof DOMElement ? $root : null;
    }

    // ─── Block-level walk ────────────────────────────────────────────────────

    /**
     * @param  array<int,array<string,mixed>>  $blocks
     * @param  array<int,array<string,mixed>>  $inline
     * @param  array<int,string>  $w
     */
    private static function walk(DOMNode $parent, array &$blocks, array &$inline, array &$w): void
    {
        foreach ($parent->childNodes as $child) {
            if ($child instanceof DOMComment) {
                continue; // تعليقات Gutenberg/HTML تُتجاهَل
            }
            if ($child instanceof DOMText) {
                self::appendInline($child, [], $inline, $blocks, $w);

                continue;
            }
            if (! $child instanceof DOMElement) {
                continue;
            }

            $tag = strtolower($child->nodeName);
            if (in_array($tag, self::INLINE_TAGS, true)) {
                self::appendInline($child, [], $inline, $blocks, $w);

                continue;
            }

            self::flush($inline, $blocks);
            self::block($tag, $child, $blocks, $w);
        }
    }

    /** @return array<int,array<string,mixed>> */
    private static function childBlocks(DOMNode $parent, array &$w): array
    {
        $blocks = [];
        $inline = [];
        self::walk($parent, $blocks, $inline, $w);
        self::flush($inline, $blocks);

        return $blocks;
    }

    private static function flush(array &$inline, array &$blocks): void
    {
        $inline = self::trimInline($inline);
        if ($inline !== []) {
            $blocks[] = self::paragraph($inline);
        }
        $inline = [];
    }

    private static function block(string $tag, DOMElement $el, array &$blocks, array &$w): void
    {
        if ($tag === 'p') {
            $buf = [];
            $inner = [];
            foreach ($el->childNodes as $c) {
                self::appendInline($c, [], $buf, $inner, $w);
            }
            foreach ($inner as $b) {
                $blocks[] = $b;
            }
            $buf = self::trimInline($buf);
            if ($buf !== []) {
                $blocks[] = self::paragraph($buf);
            }

            return;
        }

        if (preg_match('/^h([1-6])$/', $tag, $m) === 1) {
            $buf = [];
            $inner = [];
            foreach ($el->childNodes as $c) {
                self::appendInline($c, [], $buf, $inner, $w);
            }
            $buf = self::trimInline($buf);
            if ($buf !== []) {
                $blocks[] = ['type' => 'heading', 'attrs' => ['level' => (int) $m[1]], 'content' => $buf];
            }

            return;
        }

        switch ($tag) {
            case 'ul':
            case 'ol':
                $list = self::list($tag, $el, $w);
                if ($list !== null) {
                    $blocks[] = $list;
                }

                return;

            case 'blockquote':
                $inner = self::childBlocks($el, $w);
                if ($inner !== []) {
                    $blocks[] = ['type' => 'blockquote', 'content' => $inner];
                }

                return;

            case 'pre':
                $text = $el->textContent;
                $blocks[] = ['type' => 'codeBlock', 'content' => $text !== '' ? [self::text($text, [])] : []];

                return;

            case 'hr':
                $blocks[] = ['type' => 'horizontalRule'];

                return;

            case 'table':
                $table = self::table($el, $w);
                if ($table !== null) {
                    $blocks[] = $table;
                }

                return;

            case 'figure':
                self::figure($el, $blocks, $w);

                return;

            case 'img':
                $node = self::imageNode($el);
                if ($node !== null) {
                    $blocks[] = $node;
                }

                return;

            case 'iframe':
                self::iframe($el, $blocks, $w);

                return;

            default:
                if (in_array($tag, self::DROP_TAGS, true)) {
                    return; // محتوى غير تحريري — يُسقَط
                }
                // حاوية غير معروفة (div/section/article…) → فكّ التغليف، حفظ المحتوى.
                foreach (self::childBlocks($el, $w) as $b) {
                    $blocks[] = $b;
                }
        }
    }

    private static function list(string $tag, DOMElement $el, array &$w): ?array
    {
        $items = [];
        foreach ($el->childNodes as $c) {
            if (! $c instanceof DOMElement || strtolower($c->nodeName) !== 'li') {
                continue;
            }
            $content = self::childBlocks($c, $w);
            if ($content === []) {
                $content = [self::paragraph([])];
            }
            $items[] = ['type' => 'listItem', 'content' => $content];
        }

        if ($items === []) {
            return null;
        }

        return ['type' => $tag === 'ol' ? 'orderedList' : 'bulletList', 'content' => $items];
    }

    private static function table(DOMElement $el, array &$w): ?array
    {
        $rows = [];
        foreach ($el->getElementsByTagName('tr') as $tr) {
            $cells = [];
            foreach ($tr->childNodes as $c) {
                if (! $c instanceof DOMElement) {
                    continue;
                }
                $cn = strtolower($c->nodeName);
                if ($cn !== 'td' && $cn !== 'th') {
                    continue;
                }
                $content = self::childBlocks($c, $w);
                if ($content === []) {
                    $content = [self::paragraph([])];
                }
                $cells[] = ['type' => $cn === 'th' ? 'tableHeader' : 'tableCell', 'content' => $content];
            }
            if ($cells !== []) {
                $rows[] = ['type' => 'tableRow', 'content' => $cells];
            }
        }

        return $rows === [] ? null : ['type' => 'table', 'content' => $rows];
    }

    private static function figure(DOMElement $el, array &$blocks, array &$w): void
    {
        $emitted = false;
        foreach ($el->getElementsByTagName('img') as $img) {
            $node = self::imageNode($img);
            if ($node !== null) {
                $blocks[] = $node;
                $emitted = true;
            }
        }
        if (! $emitted) {
            foreach ($el->getElementsByTagName('iframe') as $if) {
                self::iframe($if, $blocks, $w);
            }
        }

        // التسمية (figcaption) → فقرة تالية (TipTap بلا عقدة caption مخصّصة).
        foreach ($el->childNodes as $c) {
            if ($c instanceof DOMElement && strtolower($c->nodeName) === 'figcaption') {
                $buf = [];
                $inner = [];
                foreach ($c->childNodes as $cc) {
                    self::appendInline($cc, [], $buf, $inner, $w);
                }
                $buf = self::trimInline($buf);
                if ($buf !== []) {
                    $blocks[] = self::paragraph($buf);
                }
                break;
            }
        }
    }

    private static function iframe(DOMElement $el, array &$blocks, array &$w): void
    {
        $src = self::attrUrl($el, 'src');
        if (! self::safeHref($src)) {
            $w[] = 'embed_dropped';

            return;
        }

        $provider = self::embedProvider($src);
        if ($provider !== null) {
            $blocks[] = ['type' => 'embed', 'attrs' => ['provider' => $provider, 'embed_url' => $src]];

            return;
        }

        // تضمين غير متوافق → يُحفَظ كرابط (لا إسقاط صامت — قاعدة #6).
        $blocks[] = self::paragraph([self::text($src, [['type' => 'link', 'attrs' => ['href' => $src]]])]);
        $w[] = 'embed_as_link';
    }

    // ─── Inline walk ─────────────────────────────────────────────────────────

    /**
     * @param  array<int,array<string,mixed>>  $marks
     * @param  array<int,array<string,mixed>>  $inline  مخزن المضمّن الحالي (يُحدَّث)
     * @param  array<int,array<string,mixed>>  $blocks  كتل (صور تقطع التدفّق المضمّن)
     * @param  array<int,string>  $w
     */
    private static function appendInline(DOMNode $node, array $marks, array &$inline, array &$blocks, array &$w): void
    {
        if ($node instanceof DOMText) {
            $text = preg_replace('/\s+/u', ' ', $node->textContent) ?? '';
            if ($text !== '') {
                $inline[] = self::text($text, $marks);
            }

            return;
        }
        if (! $node instanceof DOMElement) {
            return;
        }

        $tag = strtolower($node->nodeName);

        if ($tag === 'br') {
            $inline[] = ['type' => 'hardBreak'];

            return;
        }
        if (in_array($tag, self::DROP_TAGS, true)) {
            return;
        }
        if ($tag === 'img') {
            // صورة وسط التدفّق → أفرغ الفقرة الحالية ثم اعرضها ككتلة.
            $inline = self::trimInline($inline);
            if ($inline !== []) {
                $blocks[] = self::paragraph($inline);
                $inline = [];
            }
            $img = self::imageNode($node);
            if ($img !== null) {
                $blocks[] = $img;
            }

            return;
        }
        if ($tag === 'a') {
            $href = self::attrUrl($node, 'href');
            $next = self::safeHref($href)
                ? array_merge($marks, [['type' => 'link', 'attrs' => ['href' => $href]]])
                : $marks;
            foreach ($node->childNodes as $c) {
                self::appendInline($c, $next, $inline, $blocks, $w);
            }

            return;
        }

        $mark = match ($tag) {
            'strong', 'b' => 'bold',
            'em', 'i', 'cite' => 'italic',
            'u' => 'underline',
            's', 'strike', 'del' => 'strike',
            'code' => 'code',
            default => null,
        };
        $next = $mark !== null ? array_merge($marks, [['type' => $mark]]) : $marks;

        foreach ($node->childNodes as $c) {
            self::appendInline($c, $next, $inline, $blocks, $w);
        }
    }

    // ─── Node builders + helpers ──────────────────────────────────────────────

    /** قيمة سمة رابط: قصّ المسافات وعلامات الاقتباس المُحيطة (تلوّث قديم: src="\"https://...\""). */
    private static function attrUrl(DOMElement $el, string $name): string
    {
        return trim($el->getAttribute($name), " \t\n\r\0\x0B\"'");
    }

    private static function imageNode(DOMElement $img): ?array
    {
        $src = self::attrUrl($img, 'src');
        if ($src === '') {
            return null;
        }
        $attrs = ['src' => $src];
        $alt = trim($img->getAttribute('alt'));
        if ($alt !== '') {
            $attrs['alt'] = $alt;
        }
        $title = trim($img->getAttribute('title'));
        if ($title !== '') {
            $attrs['title'] = $title;
        }

        return ['type' => 'image', 'attrs' => $attrs];
    }

    private static function embedProvider(string $url): ?string
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if ($host === '') {
            return null;
        }

        return match (true) {
            str_contains($host, 'youtube.com') || str_contains($host, 'youtu.be') => 'youtube',
            str_contains($host, 'vimeo.com') => 'vimeo',
            str_contains($host, 'twitter.com') || str_contains($host, 'x.com') => 'twitter',
            str_contains($host, 'facebook.com') => 'facebook',
            str_contains($host, 'instagram.com') => 'instagram',
            default => null,
        };
    }

    private static function safeHref(string $url): bool
    {
        if ($url === '') {
            return false;
        }
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        return in_array($scheme, ['http', 'https', 'mailto'], true);
    }

    /** @param array<int,array<string,mixed>> $marks */
    private static function text(string $text, array $marks): array
    {
        $node = ['type' => 'text', 'text' => $text];
        if ($marks !== []) {
            $node['marks'] = $marks;
        }

        return $node;
    }

    /** @param array<int,array<string,mixed>> $content */
    private static function paragraph(array $content): array
    {
        return ['type' => 'paragraph', 'content' => $content];
    }

    /** @param array<int,array<string,mixed>> $content */
    private static function doc(array $content): array
    {
        return ['type' => 'doc', 'content' => $content];
    }

    /**
     * يُسقط الفقرة إن كانت كلها فراغات؛ يُبقي المسافات الداخلية بين العناصر.
     *
     * @param  array<int,array<string,mixed>>  $inline
     * @return array<int,array<string,mixed>>
     */
    private static function trimInline(array $inline): array
    {
        foreach ($inline as $n) {
            if (($n['type'] ?? '') !== 'text' || trim((string) ($n['text'] ?? '')) !== '') {
                return $inline;
            }
        }

        return [];
    }

    /**
     * @param  array<int,array<string,mixed>>  $nodes
     * @return array<int,string>
     */
    private static function collectImages(array $nodes): array
    {
        $out = [];
        foreach ($nodes as $n) {
            if (($n['type'] ?? '') === 'image' && isset($n['attrs']['src'])) {
                $out[] = (string) $n['attrs']['src'];
            }
            if (isset($n['content']) && is_array($n['content'])) {
                $out = array_merge($out, self::collectImages($n['content']));
            }
        }

        return array_values(array_unique($out));
    }
}
