<?php

declare(strict_types=1);

namespace App\Actions\Admin\WpMigration;

use App\Enums\ArticleStatus;
use App\Enums\ConflictPolicy;
use App\Enums\MigrationFailureReason;
use App\Enums\MigrationItemStatus;
use App\Models\Article;
use App\Models\ArticleUrlHistory;
use App\Models\MigrationItem;
use App\Models\MigrationRun;
use App\Support\Cache\ArticleCacheTags;
use App\Support\Content\ArticleCategoryGuard;
use App\Support\Content\ArticleCdnPurge;
use App\Support\Content\HtmlToTipTap;
use App\Support\Content\TipTapRenderer;
use App\Support\Content\TipTapSanitizer;
use App\Support\WpMigration\MigrationAuthor;
use App\Support\WpMigration\MigrationCategoryResolver;
use App\Support\WpMigration\MigrationExcerpt;
use App\Support\WpMigration\MigrationSlug;
use App\Support\WpMigration\WpCategoryMap;
use App\Support\WpMigration\WpMediaImporter;
use App\Support\WpMigration\WpMediaResolver;
use App\Support\WpMigration\WpPostReader;
use App\Support\WpMigration\WpPostRecord;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/**
 * مُنسّق استيراد منشور واحد (الموجة التنفيذية). يربط القراءة + التحويل + حسم
 * التصنيفات + الوسائط + الإبقاء الحتميّ. هوية المصدر = wp_post_id حصراً (#2/#10).
 *
 * عزل العنصر السامّ (#11): كل عنصر يفشل منفرداً، لا يوقف الخطّ. حدود معاملة لكل
 * منشور (#10). content_json هو المصدر القانوني المُخزَّن + HTML مشتقّ (#7). الكاتب
 * «كتاب الموقع» يُحلّ مرّة بفحص صارم عند التهيئة (#8). الوسائط قبل المقال (أمان
 * اليتيم #8: فشل المقال يترك أصولاً قابلة لإعادة الاستخدام عند المحاولة التالية).
 */
class ImportWpPostAction
{
    /**
     * @param  array<int,array{type:string,target:int,weight:int,term_id:int}>  $mapByTtid
     */
    public function __construct(
        private readonly WpPostReader $reader,
        private readonly WpMediaImporter $media,
        private readonly int $authorId,
        private readonly ConflictPolicy $policy,
        private readonly array $mapByTtid,
        private readonly string $locale,
    ) {}

    public static function for(MigrationRun $run): self
    {
        $policy = $run->conflict_policy
            ?? throw new RuntimeException('wp_migration: conflict policy not set.');

        return new self(
            WpPostReader::for($run),
            new WpMediaImporter(new WpMediaResolver((string) $run->uploads_path), MigrationAuthor::resolve(), $run),
            MigrationAuthor::id(), // فحص صارم #8 (يرمي إن غاب الكاتب)
            $policy,
            WpCategoryMap::build($run),
            (string) (data_get($run->source_facts, 'site.language') ?: 'ar'),
        );
    }

    public function handle(MigrationItem $item): void
    {
        $item->forceFill([
            'status' => MigrationItemStatus::Processing->value,
            'attempts' => $item->attempts + 1,
            'last_step' => 'read',
        ])->save();

        try {
            $record = $this->reader->read($item->wp_post_id);
            if ($record === null) {
                $this->fail($item, MigrationFailureReason::SourceReadFailed);

                return;
            }

            // عنوان المصدر يُلتقط فور القراءة — يبقى لفحص الفشل حتى لو تعثّرت خطوة لاحقة (#4 Phase 7).
            $item->forceFill(['source_title' => mb_substr($record->title !== '' ? $record->title : '—', 0, 255)])->save();

            // ── حسم التصنيفات + النوع (سياسة التعارض) ──
            $resolved = MigrationCategoryResolver::resolve(
                $record->categoryTtids,
                $this->mapByTtid,
                $this->policy,
                $record->primaryCategoryTtid,
            );
            if ($resolved === null) {
                $included = array_filter($record->categoryTtids, fn (int $t): bool => isset($this->mapByTtid[$t]));
                $this->skip($item, $included === []
                    ? MigrationFailureReason::CategoryUnresolved
                    : MigrationFailureReason::CategoryTypeConflict);

                return;
            }

            // ── سلامة التصنيفات (#5): الأهداف موجودة + نطاق/لغة صحيحة ──
            if (ArticleCategoryGuard::check($resolved->type, $this->locale, $resolved->primary, $resolved->secondary) !== null) {
                $this->fail($item, MigrationFailureReason::CategoryUnresolved);

                return;
            }

            // ── التحويل من المصدر القانوني (#1) ──
            $tx = HtmlToTipTap::transform($record->content);

            // ── الوسائط قبل المقال (أمان اليتيم #8): إعادة كتابة المتن + الصورة البارزة ──
            $rewrite = $this->media->rewriteDoc($tx['doc']);
            $ogImageId = null;
            $featuredFailed = false;
            if ($record->featuredUrl !== null) {
                $featured = $this->media->import($record->featuredUrl, $record->featuredWpAttachmentId);
                if ($featured['asset'] !== null) {
                    $ogImageId = $featured['asset']->id;
                } else {
                    $featuredFailed = true;
                }
            }

            $cleanDoc = TipTapSanitizer::clean($rewrite->doc);
            $html = TipTapRenderer::toHtml($cleanDoc);
            // المعرّف المحفوظ (= wp_post_id) يُستثنى من فحص فرادة الـ slug كي لا يتغيّر
            // الـ slug عند إعادة التشغيل (يطابق المقال المُتبنّى بمعرّفه).
            $slug = MigrationSlug::make($record->sourceSlug, $record->title, $this->locale, $record->wpPostId, $item->article_id ?? $record->wpPostId);

            // ── إبقاء جوهري في معاملة لكل منشور (#10) ──
            $article = DB::transaction(function () use ($item, $record, $resolved, $cleanDoc, $html, $slug, $ogImageId, $rewrite): Article {
                $article = $item->article_id !== null ? Article::withTrashed()->find($item->article_id) : null;
                // تبنٍّ بالمعرّف المحفوظ (إعادة تشغيل/تشغيلة جديدة لنفس المصدر) — يمنع
                // تصادم الإدراج ويُبقي المنشور مالكاً لمعرّفه عبر التشغيلات (idempotent).
                $article ??= Article::withTrashed()->find($record->wpPostId);
                if ($article === null) {
                    $article = new Article;
                    $article->incrementing = false; // أبقِ معرّف ووردبريس الأصليّ كما هو (#1)
                    $article->id = $record->wpPostId;
                }
                if ($article->trashed()) {
                    $article->restore();
                }

                // أبقِ تواريخ ووردبريس الأصلية (#5) بدل أوقات الترحيل (طوابع تلقائية مُعطَّلة).
                $article->timestamps = false;

                $article->fill([
                    'author_id' => $this->authorId,
                    'published_by_id' => $this->authorId,
                    'primary_category_id' => $resolved->primary,
                    'type' => $resolved->type->value,
                    'status' => ArticleStatus::Published->value,
                    'event_status' => null,
                    'locale' => $this->locale,
                    'title' => $record->title !== '' ? $record->title : '—',
                    'subtitle' => $record->subtitle,
                    'excerpt' => MigrationExcerpt::make($record->excerpt, $record->content), // SEO summary (#4)
                    'content_json' => $cleanDoc,
                    'content' => $html,
                    'seo_title' => $record->seo['title'],
                    'seo_description' => $record->seo['description'],
                    'seo_keywords' => $record->seo['keywords'],
                    'canonical_url' => $record->seo['canonical'],
                    'robots' => $record->seo['robots'],
                    'og_image_id' => $ogImageId,
                    'comments_enabled' => false,
                    'published_at' => $record->publishedAt,
                ]);
                $article->slug = $slug; // صريح — Sluggable لا يولّد فوق slug غير فارغ (#6)
                // تواريخ المصدر (#5): الإنشاء = تاريخ النشر الأصليّ، التحديث = post_modified.
                $article->created_at = $record->publishedAt ?? $article->created_at ?? now();
                $article->updated_at = $record->updatedAt ?? $record->publishedAt ?? now();
                $article->save();

                $article->categories()->sync($resolved->secondary);
                $this->syncMedia($article, $ogImageId, $rewrite->assetBySrc);

                $item->forceFill(['article_id' => $article->id])->save();

                return $article;
            });

            // إبطال كاش تفاصيل/قوائم المقال العام — بلا هذا، صفحة تفاصيل المقال (المُخزَّنة
            // بمعرّفه عند أول زيارة) تبقى عالقة على اللقطة القديمة (بلا صورة مثلاً) حتى
            // تنتهي صلاحية TTL طبيعياً، رغم أنّ البيانات صارت صحيحة فوراً (نفس الثغرة التي
            // كانت تُبطِلها كل أفعال الإدارة العادية عبر ArticleCacheTags::writeTags — هذا
            // المسار وحده كان يفتقدها لأنه لا يمرّ عبر تلك الأفعال).
            Cache::tags(ArticleCacheTags::writeTags($article->fresh()))->flush();
            ArticleCdnPurge::purge($article);

            // ── تحويل المسار (ملحق): فشله ⇒ جزئي لا فشل كارثيّ (#4)، بلا تكرار (#9) ──
            $redirectOk = $this->redirect($article, $record);

            $mediaWarn = $rewrite->warnings !== [] || $featuredFailed;
            $partial = $mediaWarn || ! $redirectOk;

            $warnings = array_values(array_unique(array_merge(
                $tx['warnings'] ?? [],
                array_map(fn (array $w): string => $w['reason'], $rewrite->warnings),
                $featuredFailed ? ['featured_unresolved'] : [],
                $redirectOk ? [] : ['redirect_failed'],
            )));

            // عدّادات وسائط حتمية لكل عنصر (مصدر مجاميع اللوحة عبر SUM): البارزة المُسنَدة
            // تُحسَب استيراداً، وفشلها فشلاً — متماثلة. التشعّب inline من memo إعادة الكتابة.
            $mediaImported = $rewrite->imported + ($ogImageId !== null ? 1 : 0);
            $mediaReused = $rewrite->reused;
            $mediaFailed = count($rewrite->warnings) + ($featuredFailed ? 1 : 0);

            $item->forceFill([
                'status' => ($partial ? MigrationItemStatus::Partial : MigrationItemStatus::Done)->value,
                'target_type' => $resolved->type->value,
                'content_imported_at' => now(),
                'media_imported_at' => now(),
                'seo_imported_at' => now(),
                'redirects_created_at' => $redirectOk ? now() : null,
                'last_step' => 'done',
                'last_error' => null,
                'media_imported' => $mediaImported,
                'media_reused' => $mediaReused,
                'media_failed' => $mediaFailed,
                'flags' => [
                    'warnings' => $warnings,
                    'media' => ['imported' => $mediaImported, 'reused' => $mediaReused, 'failed' => $mediaFailed],
                ],
            ])->save();
        } catch (Throwable $e) {
            // عزل العنصر السامّ (#11) — فشل مُصنَّف، لا يوقف الخطّ.
            $this->fail($item, MigrationFailureReason::PersistFailed, $e->getMessage());
        }
    }

    /** @param  array<string,int>  $assetBySrc */
    private function syncMedia(Article $article, ?int $ogImageId, array $assetBySrc): void
    {
        $pivot = [];
        if ($ogImageId !== null) {
            $pivot[$ogImageId] = ['collection' => 'cover', 'position' => 0];
        }
        $pos = 0;
        foreach (array_values(array_unique($assetBySrc)) as $assetId) {
            if (! isset($pivot[$assetId])) {
                $pivot[$assetId] = ['collection' => 'inline', 'position' => $pos++];
            }
        }

        $article->mediaAssets()->sync($pivot);
    }

    private function redirect(Article $article, WpPostRecord $record): bool
    {
        try {
            $old = $record->permalink !== null ? parse_url($record->permalink, PHP_URL_PATH) : null;
            if (($old === null || $old === '') && $record->sourceSlug !== '') {
                $old = '/'.$record->sourceSlug;
            }
            if (! is_string($old) || $old === '') {
                return true; // لا مسار مصدري متاح — لا شيء لحفظه
            }
            $old = '/'.ltrim($old, '/');
            if ($old === $article->canonicalPath()) {
                return true; // لا تحويل ذاتيّ
            }

            ArticleUrlHistory::firstOrCreate(
                ['locale' => $this->locale, 'old_path' => $old],
                ['article_id' => $article->id, 'reason' => 'wp_migration'],
            );

            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function fail(MigrationItem $item, MigrationFailureReason $reason, ?string $detail = null): void
    {
        $item->forceFill([
            'status' => MigrationItemStatus::Failed->value,
            'last_step' => 'import',
            'last_error' => $reason->value.($detail !== null ? ': '.mb_substr($detail, 0, 500) : ''),
            'flags' => ['reason' => $reason->value],
        ])->save();
    }

    private function skip(MigrationItem $item, MigrationFailureReason $reason): void
    {
        $item->forceFill([
            'status' => MigrationItemStatus::Skipped->value,
            'last_step' => 'resolve',
            'flags' => ['reason' => $reason->value],
        ])->save();
    }
}
