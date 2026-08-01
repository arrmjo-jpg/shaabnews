<?php

declare(strict_types=1);

namespace App\Support\WpMigration;

use App\Models\MigrationRun;
use Illuminate\Database\Connection;

/**
 * قارئ منشور مصدري (قراءة فقط) — يستخرج الحقائق التحريرية + Yoast لمنشور واحد
 * بهويته wpPostId. نطاق منشور فقط (قاعدة #6). منشور غائب/محذوف ⇒ null
 * (يصنّفه المُنسّق source_read_failed، قاعدة #1). permalink من Yoast للوفاء بالتحويل (#5).
 */
final class WpPostReader
{
    public function __construct(
        private readonly Connection $db,
        private readonly ?string $siteUrl,
    ) {}

    public static function for(MigrationRun $run): self
    {
        return new self(
            WpSourceConnection::connection($run),
            data_get($run->source_facts, 'site.url'),
        );
    }

    public function read(int $wpPostId): ?WpPostRecord
    {
        $post = $this->db->table('posts')->where('ID', $wpPostId)->where('post_type', 'post')->first();
        if ($post === null) {
            return null; // محذوف/غائب
        }
        if (($post->post_status ?? '') !== 'publish') {
            return null; // نطاق منشور فقط (#6)
        }

        $ttids = $this->db->table('term_relationships as tr')
            ->join('term_taxonomy as tt', 'tt.term_taxonomy_id', '=', 'tr.term_taxonomy_id')
            ->where('tr.object_id', $wpPostId)
            ->where('tt.taxonomy', 'category')
            ->pluck('tr.term_taxonomy_id')
            ->map(fn ($x): int => (int) $x)
            ->all();

        $thumbId = $this->meta($wpPostId, '_thumbnail_id');
        $primaryTermId = $this->meta($wpPostId, '_yoast_wpseo_primary_category');
        $yoast = $this->yoast($wpPostId);

        return new WpPostRecord(
            wpPostId: (int) $post->ID,
            status: (string) $post->post_status,
            title: (string) ($post->post_title ?? ''),
            subtitle: $this->meta($wpPostId, 'post_subtitle'),
            sourceSlug: rawurldecode((string) ($post->post_name ?? '')),
            excerpt: self::nz($post->post_excerpt ?? null),
            content: (string) ($post->post_content ?? ''),
            publishedAt: self::nz($post->post_date_gmt ?? null) ?? self::nz($post->post_date ?? null),
            updatedAt: self::nz($post->post_modified_gmt ?? null) ?? self::nz($post->post_modified ?? null),
            categoryTtids: $ttids,
            primaryCategoryTtid: $primaryTermId !== null ? $this->ttidForTerm((int) $primaryTermId) : null,
            featuredUrl: $thumbId !== null ? $this->attachmentUrl((int) $thumbId) : null,
            featuredWpAttachmentId: $thumbId !== null ? (int) $thumbId : null,
            seo: $yoast['seo'],
            permalink: $yoast['permalink'],
        );
    }

    private function meta(int $postId, string $key): ?string
    {
        $v = $this->db->table('postmeta')
            ->where('post_id', $postId)->where('meta_key', $key)
            ->value('meta_value');

        return ($v === null || $v === '') ? null : (string) $v;
    }

    private function ttidForTerm(int $termId): ?int
    {
        $ttid = $this->db->table('term_taxonomy')
            ->where('term_id', $termId)->where('taxonomy', 'category')
            ->value('term_taxonomy_id');

        return $ttid !== null ? (int) $ttid : null;
    }

    private function attachmentUrl(int $attachmentId): ?string
    {
        // المسار النسبيّ للأصل كما يسجّله ووردبريس («2024/05/image.jpg»).
        $file = $this->meta($attachmentId, '_wp_attached_file');
        if ($file !== null) {
            // الأصل المُهيّأ (WP_BASE_URL) له الأولوية: تغيير النطاق بإعداد واحد،
            // بلا اعتماد على site.url المُلتقَط وقت المعاينة.
            return WpMediaSource::uploadsUrl($file)
                ?? rtrim((string) $this->siteUrl, '/').'/wp-content/uploads/'.ltrim($file, '/');
        }

        $guid = $this->db->table('posts')->where('ID', $attachmentId)->value('guid');

        return is_string($guid) && $guid !== '' ? $guid : null;
    }

    /** @return array{seo:array{title:?string,description:?string,keywords:?string,canonical:?string,robots:?string},permalink:?string} */
    private function yoast(int $postId): array
    {
        $empty = [
            'seo' => ['title' => null, 'description' => null, 'keywords' => null, 'canonical' => null, 'robots' => null],
            'permalink' => null,
        ];

        if (! $this->db->getSchemaBuilder()->hasTable('yoast_indexable')) {
            return $empty;
        }

        $row = (array) ($this->db->table('yoast_indexable')
            ->where('object_id', $postId)->where('object_type', 'post')->first() ?? []);
        if ($row === []) {
            return $empty;
        }

        $noindex = (int) ($row['is_robots_noindex'] ?? 0) === 1;

        return [
            'seo' => [
                'title' => self::nz($row['title'] ?? null),
                'description' => self::nz($row['description'] ?? null),
                'keywords' => self::nz($row['primary_focus_keyword'] ?? null),
                'canonical' => self::nz($row['canonical'] ?? null),
                'robots' => $noindex ? 'noindex,follow' : null,
            ],
            'permalink' => self::nz($row['permalink'] ?? null),
        ];
    }

    private static function nz(mixed $v): ?string
    {
        $v = is_string($v) ? trim($v) : $v;

        return ($v === null || $v === '') ? null : (string) $v;
    }
}
