<?php

declare(strict_types=1);

namespace App\Actions\Admin\Vertix;

use App\Enums\ArticleStatus;
use App\Enums\ArticleType;
use App\Models\Article;
use App\Models\Category;
use App\Models\MediaAsset;
use App\Models\User;
use App\Models\VertixRun;
use App\Support\Content\SlugGenerator;
use App\Support\Vertix\VertixAuthor;
use App\Support\Vertix\VertixContentTransformer;
use App\Support\Vertix\VertixImageImporter;
use App\Support\Vertix\VertixImageUrl;
use App\Support\Vertix\VertixSource;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/**
 * المرحلة الثانية: استيراد أخبار Vertix بحفظ المعرّف الأصليّ مباشرةً —
 * articles.id = art_news.newsid (بلا mapping/source_id/تحويل). الترتيب الأحدث ← الأقدم.
 *
 * المطابقة/الدّيدوب بالـ id نفسه على جدول articles: موجود ⇒ تخطٍّ (لا تكرار)؛ غير
 * موجود ⇒ إنشاء بمعرّفه. القسم مباشرة: primary_category_id = catid (= categories.id).
 * الصورة رابط مُولَّد من folder+ph_name (لا يُخزَّن). Idempotent، إعادة تشغيل آمنة.
 */
class ImportVertixNewsBatchAction
{
    private int $authorId;

    private User $actor;

    private string $locale;

    private int $mediaImported = 0;

    private int $mediaFailed = 0;

    /** slug القسم الاحتياطيّ — أخبار القسم المفقود تُسنَد إليه بدل الفشل (إن وُجد القسم). */
    public const FALLBACK_CATEGORY_SLUG = 'mukhtarat';

    private ?int $fallbackCategoryId = null;

    private bool $fallbackResolved = false;

    /** تنزيل الأغلفة (شبكيّ). يُعطَّل في الاسترجاع للسرعة — تبقى الصورة البارزة داخل المتن. */
    private bool $importCovers = true;

    public function __construct()
    {
        $this->actor = VertixAuthor::resolve();
        $this->authorId = $this->actor->id;
        $this->locale = (string) config('vertix.locale', 'ar');
    }

    /** @return array{imported:int,failed:int} عدّادات تنزيل صور الأغلفة (للتقارير/الإثبات الحيّ). */
    public function mediaCounts(): array
    {
        return ['imported' => $this->mediaImported, 'failed' => $this->mediaFailed];
    }

    /** تعطيل تنزيل الأغلفة (سرعة الاسترجاع): الصورة البارزة تبقى داخل المتن، og_image = null. */
    public function withoutCovers(): self
    {
        $this->importCovers = false;

        return $this;
    }

    /** تهيئة عند أوّل تشغيل: سقف الردم = أعلى newsid (يبدأ من الأحدث). Idempotent. */
    public static function initialize(VertixRun $run): void
    {
        if (! $run->backfill_done && $run->cursor === 0 && $run->high_water === 0 && $run->imported === 0) {
            $max = VertixSource::make()->maxNewsId();
            $run->forceFill(['high_water' => $max, 'cursor' => $max + 1])->save();
        }
    }

    /**
     * دفعة واحدة (الأحدث ← الأقدم): ① تلتقط الجديد فوق high_water، ② ثمّ تردم تنازلياً
     * تحت cursor. تتخطّى الموجود (articles.id) — Idempotent بلا تكرار.
     *
     * @return array{processed:int,imported:int,failed:int,skipped:int,done:bool}
     */
    public function handleRun(VertixRun $run, int $limit): array
    {
        $source = VertixSource::make();

        // ① الجديد فوق العلامة العليا (الأحدث أولاً).
        $newRows = $source->newsAbove($run->high_water, $limit);
        if ($newRows !== []) {
            $r = $this->importRows($newRows);
            $run->forceFill([
                'high_water' => max(array_map(static fn ($x): int => (int) $x->newsid, $newRows)),
                'imported' => $run->imported + $r['imported'],
                'failed' => $run->failed + $r['failed'],
            ])->save();
            $this->appendErrors($run, $r['errors']);

            return $this->summary($r, false);
        }

        // ② الردم التنازليّ (تحت المؤشّر نحو الأقدم).
        if (! $run->backfill_done) {
            $below = $run->cursor > 0 ? $run->cursor : ($source->maxNewsId() + 1);
            $rows = $source->newsBelow($below, $limit);
            if ($rows === []) {
                $run->forceFill(['backfill_done' => true])->save();

                return ['processed' => 0, 'imported' => 0, 'failed' => 0, 'skipped' => 0, 'done' => true];
            }
            $r = $this->importRows($rows);
            $run->forceFill([
                'cursor' => min(array_map(static fn ($x): int => (int) $x->newsid, $rows)),
                'imported' => $run->imported + $r['imported'],
                'failed' => $run->failed + $r['failed'],
            ])->save();
            $this->appendErrors($run, $r['errors']);

            return $this->summary($r, false);
        }

        return ['processed' => 0, 'imported' => 0, 'failed' => 0, 'skipped' => 0, 'done' => true];
    }

    /**
     * يستورد الصفوف غير الموجودة (المطابقة بوجود articles.id = newsid، شاملةً المحذوف
     * منطقيًّا) — بلا تكرار. جدول articles يستخدم SoftDeletes؛ فالصفّ المحذوف منطقيًّا
     * يبقى فيزيائيًّا ويحجبه النطاق الافتراضيّ، فلو فُحِص الوجود به لنجح الفحص كذباً ثمّ
     * فشل الإدراج بتضارب المفتاح الأساسيّ (Duplicate entry … articles.PRIMARY). لذا
     * الفحص عبر withTrashed، وأيّ تضارب فرادة متبقٍّ (سباق) يُعدّ تخطّيًا لا فشلاً.
     *
     * @param  array<int,object>  $rows
     * @return array{processed:int,imported:int,failed:int,skipped:int,errors:array<int,array<string,mixed>>}
     */
    private function importRows(array $rows): array
    {
        $ids = array_map(static fn ($x): int => (int) $x->newsid, $rows);
        // withTrashed: يكشف الصفوف المحذوفة منطقيًّا (deleted_at) التي يخفيها النطاق
        // الافتراضيّ — وإلّا نجح الفحص كذباً ثمّ فشل الإدراج بتضارب PRIMARY.
        $existing = Article::withTrashed()->whereIn('id', $ids)->pluck('id')->flip();

        $imported = 0;
        $failed = 0;
        $skipped = 0;
        $errors = [];

        foreach ($rows as $row) {
            $nid = (int) $row->newsid;
            if ($existing->has($nid)) {
                $skipped++;

                continue; // موجود بنفس المعرّف (ولو محذوفاً منطقيًّا) ⇒ لا إعادة (Idempotent)
            }
            try {
                $this->importOne($row);
                $imported++;
            } catch (UniqueConstraintViolationException $e) {
                $skipped++; // سُبِق إدراجه (سباق/صفّ غير مرئيّ للفحص) ⇒ تخطٍّ لا فشل
            } catch (Throwable $e) {
                $failed++;
                $errors[] = ['type' => 'news', 'id' => $nid, 'error' => mb_substr($e->getMessage(), 0, 300), 'at' => now()->toISOString()];
            }
        }

        return ['processed' => count($rows), 'imported' => $imported, 'failed' => $failed, 'skipped' => $skipped, 'errors' => $errors];
    }

    private function importOne(object $row): void
    {
        $categoryId = $this->resolveCategoryId((int) $row->catid);

        // ① رابط الصورة البارزة (يُستخدَم مرّتين: تنزيلًا للغلاف، ومطابقةً لإزالة تكرارها من صدر المتن).
        $featuredUrl = VertixImageUrl::build($row->folder ?? null, $row->ph_name ?? null);

        // ② الصورة البارزة → MediaAsset غلافاً (خارج المعاملة: تنزيل شبكيّ). ديدوب SHA-256 طبيعيّ.
        //    تعطيل الأغلفة (الاسترجاع): لا تنزيل، والصورة البارزة تبقى داخل المتن (لا تُحذف) فلا تُفقد.
        $cover = $this->importCovers ? $this->resolveCover($featuredUrl) : null;

        // ③ المتن يُحفَظ كاملاً (صور/روابط/عناوين/قوائم/جداول/اقتباسات/تضمينات) عبر HtmlToTipTap؛
        //    تُزال **فقط** الصورة البارزة إن تكرّرت في صدر المتن (صارت غلافاً). صفر strip_tags، صفر فقدان.
        $tx = VertixContentTransformer::transform($row->body ?? null, $this->importCovers ? $featuredUrl : null);

        // ③ إبقاء ذرّيّ: المقال (بمعرّفه الأصليّ) + ربط الغلاف.
        DB::transaction(function () use ($row, $categoryId, $tx, $cover): void {
            $article = new Article;
            $article->incrementing = false;
            $article->id = (int) $row->newsid; // حفظ المعرّف الأصليّ
            $article->fill([
                'author_id' => $this->authorId,
                'published_by_id' => $this->authorId,
                'primary_category_id' => $categoryId,
                'type' => ArticleType::News->value,
                'status' => ArticleStatus::Published->value,
                'locale' => $this->locale,
                'title' => $this->title($row),
                'excerpt' => $this->excerpt($row),
                'content' => $tx['html'],
                'content_json' => $tx['doc'],
                'og_image_id' => $cover?->id, // الغلاف (OG + cover)
                'seo_title' => $this->title($row),
                'seo_keywords' => trim((string) ($row->keywords ?? '')) !== '' ? mb_substr((string) $row->keywords, 0, 255) : null,
                'comments_enabled' => false,
                'views_count' => (int) ($row->views ?? 0),
                'published_at' => $this->publishedAt($row),
            ]);
            $article->slug = $this->slug($row);
            $article->save();

            // ربط الغلاف — Idempotent (syncWithoutDetaching: لا صفوف مكرّرة في article_media).
            if ($cover !== null) {
                $article->mediaAssets()->syncWithoutDetaching([
                    $cover->id => ['collection' => 'cover', 'position' => 0],
                ]);
            }
        });
    }

    /**
     * يربط معرّف القسم: catid مباشرةً إن وُجد؛ وإلّا القسم الاحتياطيّ «مختارات» إن أُنشئ؛
     * وإلّا يرمي category_missing (السلوك الأصليّ محفوظ حين لا قسم احتياطيّ).
     */
    private function resolveCategoryId(int $catid): int
    {
        if (Category::query()->whereKey($catid)->exists()) {
            return $catid;
        }
        $fallback = $this->fallbackCategoryId();
        if ($fallback !== null) {
            return $fallback;
        }

        throw new RuntimeException('category_missing:'.$catid);
    }

    /** معرّف القسم الاحتياطيّ (بحسب الـslug) أو null إن لم يُنشأ — يُحلّ مرّة ويُخزَّن. */
    private function fallbackCategoryId(): ?int
    {
        if (! $this->fallbackResolved) {
            $this->fallbackResolved = true;
            $id = Category::query()->where('slug', self::FALLBACK_CATEGORY_SLUG)->value('id');
            $this->fallbackCategoryId = $id !== null ? (int) $id : null;
        }

        return $this->fallbackCategoryId;
    }

    /**
     * استرجاع «أيتام القسم»: يستورد الأخبار المؤهَّلة التي قسمها مفقود (تذهب للقسم الاحتياطيّ
     * عبر resolveCategoryId). Idempotent — يتخطّى الموجود. لا يلمس high_water/cursor/backfill.
     *
     * @param  array<int,int>  $validCatids
     * @return array{processed:int,imported:int,skipped:int,failed:int,errors:array<int,array<string,mixed>>}
     */
    public function recoverOrphans(array $validCatids, int $chunk): array
    {
        $source = VertixSource::make();
        $below = $source->maxNewsId() + 1;
        $processed = $imported = $skipped = $failed = 0;
        $errors = [];

        do {
            $rows = $source->newsMissingCategoryBelow($validCatids, $below, $chunk);
            if ($rows === []) {
                break;
            }
            $r = $this->importRows($rows);
            $processed += $r['processed'];
            $imported += $r['imported'];
            $skipped += $r['skipped'];
            $failed += $r['failed'];
            $errors = array_slice(array_merge($errors, $r['errors']), -50);
            $below = min(array_map(static fn ($x): int => (int) $x->newsid, $rows));
        } while (true);

        return ['processed' => $processed, 'imported' => $imported, 'skipped' => $skipped, 'failed' => $failed, 'errors' => $errors];
    }

    /**
     * ردم أغلفة أخبار مُستورَدة بلا غلاف (og_image=null): ينزّل الصورة البارزة، يربطها غلافاً،
     * ويُزيل تكرارها من صدر المتن (مطابقةً للاستيراد العاديّ). يتخطّى ما لا صورة بارزة له،
     * ويعدّ فشلاً تعذُّرَ التنزيل. لا يلمس عدّادات الـrun (الأغلفة لا تغيّر عدّ الاستيراد).
     *
     * @param  array<int,int>  $articleIds
     * @return array{processed:int,covered:int,skipped:int,failed:int}
     */
    public function backfillCovers(array $articleIds, int $chunk): array
    {
        $source = VertixSource::make();
        $processed = $covered = $skipped = $failed = 0;

        foreach (array_chunk($articleIds, max(1, $chunk)) as $batch) {
            $rows = [];
            foreach ($source->newsByIds($batch) as $row) {
                $rows[(int) $row->newsid] = $row;
            }
            foreach ($batch as $id) {
                $processed++;
                $row = $rows[$id] ?? null;
                if ($row === null) {
                    $skipped++;

                    continue;
                }
                $featuredUrl = VertixImageUrl::build($row->folder ?? null, $row->ph_name ?? null);
                if ($featuredUrl === null) {
                    $skipped++; // لا صورة بارزة في المصدر

                    continue;
                }
                try {
                    $cover = $this->resolveCover($featuredUrl);
                    if ($cover === null) {
                        $failed++; // تعذّر التنزيل

                        continue;
                    }
                    $tx = VertixContentTransformer::transform($row->body ?? null, $featuredUrl);
                    DB::transaction(function () use ($id, $tx, $cover): void {
                        $article = Article::query()->find($id);
                        if ($article === null) {
                            return;
                        }
                        $article->forceFill([
                            'content' => $tx['html'],
                            'content_json' => $tx['doc'],
                            'og_image_id' => $cover->id,
                        ])->save();
                        $article->mediaAssets()->syncWithoutDetaching([
                            $cover->id => ['collection' => 'cover', 'position' => 0],
                        ]);
                    });
                    $covered++;
                } catch (Throwable $e) {
                    $failed++;
                }
            }
        }

        return ['processed' => $processed, 'covered' => $covered, 'skipped' => $skipped, 'failed' => $failed];
    }

    /**
     * يُدخل رابط الصورة البارزة إلى MediaAsset (محدِّثاً عدّادات النجاح/الفشل). رابط null/فارغ
     * (لا folder/ph_name) ⇒ null دون احتساب فشل (الخبر بلا صورة بارزة، ليس فشل تنزيل).
     */
    private function resolveCover(?string $url): ?MediaAsset
    {
        if ($url === null) {
            return null;
        }

        $asset = VertixImageImporter::fetch($url, $this->actor);
        if ($asset !== null) {
            $this->mediaImported++;
        } else {
            $this->mediaFailed++;
        }

        return $asset;
    }

    private function title(object $row): string
    {
        $t = trim((string) ($row->title ?? ''));

        return $t !== '' ? mb_substr($t, 0, 200) : ('خبر '.(int) $row->newsid);
    }

    private function excerpt(object $row): ?string
    {
        $b = trim(strip_tags((string) ($row->brief ?? '')));

        return $b !== '' ? mb_substr($b, 0, 500) : null;
    }

    /** slug فريد بلا استعلام per-row (newsid فريد؛ المعرّف = newsid هو مفتاح المسار). */
    private function slug(object $row): string
    {
        $src = trim((string) ($row->link ?? '')) !== '' ? (string) $row->link : (string) $row->title;
        $base = mb_substr(SlugGenerator::makeWithFallback($src), 0, 170);
        if ($base === '') {
            $base = 'news';
        }

        return $base.'-'.(int) $row->newsid;
    }

    private function publishedAt(object $row): Carbon
    {
        $ts = (int) ($row->updatedate_int ?? 0);
        if ($ts > 0) {
            return Carbon::createFromTimestamp($ts);
        }
        $date = trim((string) ($row->createdate ?? ''));
        try {
            return $date !== '' ? Carbon::parse($date) : now();
        } catch (Throwable) {
            return now();
        }
    }

    /** @param  array{processed:int,imported:int,failed:int,skipped:int,errors:array<int,mixed>}  $r */
    private function summary(array $r, bool $done): array
    {
        return ['processed' => $r['processed'], 'imported' => $r['imported'], 'failed' => $r['failed'], 'skipped' => $r['skipped'], 'done' => $done, 'media_imported' => $this->mediaImported, 'media_failed' => $this->mediaFailed];
    }

    /** @param  array<int,array<string,mixed>>  $new */
    private function appendErrors(VertixRun $run, array $new): void
    {
        if ($new === []) {
            return;
        }
        $merged = array_merge($run->errors ?? [], $new);
        $run->forceFill(['errors' => array_slice($merged, -50)])->save();
    }
}
