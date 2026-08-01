<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Admin\Media\StoreMediaAssetAction;
use App\Enums\EpaperAccessLevel;
use App\Enums\EpaperStatus;
use App\Jobs\GenerateEpaperCoverJob;
use App\Models\Epaper;
use App\Models\EpaperVersion;
use App\Support\Security\SafeUrl;
use App\Support\WpMigration\MigrationAuthor;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * يرحّل قسم "الصفحات الكاملة لصحيفة صدى الشعب" من قاعدة ووردبريس الأصلية
 * (shaab_wp، term_id=34) إلى نظام Epaper — مباشرة من المصدر، لا من مقالات
 * AlphaCMS الست المُرحَّلة سابقاً (كانت جزئية وغير كافية).
 *
 * قواعد صارمة (متّفق عليها صراحة):
 *  - التواريخ الأصلية (publication_date/published_at/created_at/updated_at) من
 *    post_date الحقيقي — لا وقت التشغيل.
 *  - رقم العدد كما استُخرج من العنوان، بلا تعديل.
 *  - slug = (string) issue_number حرفياً — لا تحويل عنوان، لا لاحقات عند التكرار
 *    (تكرار رقم عدد يُسجَّل كخطأ بيانات ولا يُصلَح تلقائياً).
 *  - epapers.id يبقى auto-increment طبيعياً؛ source_post_id هو معرّف الربط الوحيد.
 *  - Idempotent بالكامل عبر source_post_id.
 *  - PDF الحقيقي يُنزَّل من المصدر ويُخزَّن عبر StoreMediaAssetAction — لا تحويل
 *    صور، لا رفع يدوي.
 *  - عدم المساس بأي مقال أو بيانات AlphaCMS موجودة.
 *  - بلا OCR/استخراج نصّ/فهرسة/بحث — قرار منتج: القارئ للعرض والتصفّح والتكبير
 *    والتنزيل فقط. text_layer/ocr_status/page_count تبقى NULL عمداً (تعني صراحةً
 *    "غير مُستخدَم" — القيمة الافتراضية للعمود أصلاً، لا حاجة لضبطها).
 *
 * خطوات الاستيراد لكل عدد: 1) تنزيل PDF  2) إنشاء MediaAsset  3) إنشاء Epaper
 * Issue  4) ربط الـ PDF (media_asset_id)  5) توليد الغلاف  6) انتهاء.
 */
class EpaperMigrateFullPagesCommand extends Command
{
    protected $signature = 'epaper:migrate-full-pages
        {--dry-run : تحليل وعرض بلا أي كتابة أو تنزيل}
        {--limit= : أقصى عدد أعداد يُعالَج فعلياً في هذا التشغيل}';

    protected $description = 'Migrate "الصفحات الكاملة لصحيفة صدى الشعب" from the original WordPress database (shaab_wp) into the Epaper system.';

    private const WP_TERM_ID = 34;

    private const WP_CONNECTION = 'wp_legacy_shaab';

    /** @var array<int,array{wp_post_id:int,reason:string,detail:string}> */
    private array $skipped = [];

    /** @var array<int,array{wp_post_id:int,error:string}> */
    private array $failed = [];

    /** @var array<int,array{wp_post_id:int,epaper_id:int,issue_number:int}> */
    private array $created = [];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $limit = $this->option('limit') !== null ? (int) $this->option('limit') : null;

        if (! MigrationAuthor::exists()) {
            $this->error('الكاتب القانوني "'.MigrationAuthor::name().'" غير موجود — لا يمكن المتابعة.');

            return self::FAILURE;
        }

        $this->registerWpConnection();

        $posts = $this->fetchCategoryPosts();
        $pdfIndex = $this->fetchPdfIndex();

        $this->info('منشورات ووردبريس (قسم "الصفحات الكاملة"): '.count($posts));
        $this->info('ملفات PDF قابلة للفهرسة (رقم عدد مستخرَج): '.count($pdfIndex));
        $this->newLine();

        $actor = MigrationAuthor::resolve();
        $processed = 0;

        foreach ($posts as $post) {
            if ($limit !== null && $processed >= $limit) {
                break;
            }

            $wpId = (int) $post['ID'];
            $title = (string) $post['post_title'];

            // Idempotency: منشور رُحِّل مسبقاً في تشغيل سابق.
            if (Epaper::withTrashed()->where('source_post_id', $wpId)->exists()) {
                continue;
            }

            $issueNumber = $this->extractPostIssue($title);
            if ($issueNumber === null) {
                $this->skipped[] = ['wp_post_id' => $wpId, 'reason' => 'unparseable_title', 'detail' => $title];

                continue;
            }

            // رقم عدد مكرّر بين منشورات ووردبريس نفسها — لم يُتوقَّع؛ يُسجَّل ولا يُصلَح.
            if (isset($this->issueNumberSeen[$issueNumber])) {
                $this->skipped[] = [
                    'wp_post_id' => $wpId,
                    'reason' => 'duplicate_issue_number_in_source',
                    'detail' => "issue={$issueNumber}, first seen on wp_post_id={$this->issueNumberSeen[$issueNumber]}",
                ];

                continue;
            }

            // رقم عدد يتصادم مع عدد موجود مسبقاً في AlphaCMS من مصدر آخر (مثلاً
            // السجل التجريبي الذي زرعتُه سابقاً، أو عدد أُنشئ يدوياً من لوحة الإدارة).
            $existingByIssue = Epaper::withTrashed()->where('issue_number', $issueNumber)->first();
            if ($existingByIssue !== null && (int) $existingByIssue->source_post_id !== $wpId) {
                $this->skipped[] = [
                    'wp_post_id' => $wpId,
                    'reason' => 'issue_number_conflict_with_existing_epaper',
                    'detail' => "issue={$issueNumber} already used by epaper id={$existingByIssue->id} (source_post_id=".($existingByIssue->source_post_id ?? 'null').')',
                ];

                continue;
            }

            $this->issueNumberSeen[$issueNumber] = $wpId;

            $pdf = $pdfIndex[$issueNumber] ?? null;
            if ($pdf === null) {
                $this->skipped[] = ['wp_post_id' => $wpId, 'reason' => 'no_pdf_found', 'detail' => "issue={$issueNumber}"];

                continue;
            }

            $processed++;

            if ($dryRun) {
                $this->line("[DRY-RUN] issue={$issueNumber} wp_post={$wpId} pdf={$pdf['guid']}");

                continue;
            }

            $this->migrateOne($wpId, $issueNumber, $title, (string) $post['post_date'], $pdf, $actor);
        }

        $this->printReport($dryRun);
        $this->writeReportFile();

        return self::SUCCESS;
    }

    /** @var array<int,int> issue_number => wp_post_id (كشف تكرار داخل هذا التشغيل) */
    private array $issueNumberSeen = [];

    /** @param array{ID:int,post_title:string,guid:string,post_date:string} $pdf */
    private function migrateOne(int $wpId, int $issueNumber, string $title, string $postDate, array $pdf, \App\Models\User $actor): void
    {
        $publicationDate = Carbon::parse($postDate);

        try {
            $asset = $this->downloadPdf((string) $pdf['guid'], $actor);
        } catch (Throwable $e) {
            $this->failed[] = ['wp_post_id' => $wpId, 'error' => 'pdf_download_failed: '.$e->getMessage()];

            return;
        }

        if ($asset === null) {
            $this->failed[] = ['wp_post_id' => $wpId, 'error' => 'pdf_download_failed: unresolved'];

            return;
        }

        try {
            DB::transaction(function () use ($wpId, $issueNumber, $title, $publicationDate, $asset, $actor): Epaper {
                $epaper = new Epaper;
                $epaper->fill([
                    'source_post_id' => $wpId,
                    'locale' => 'ar',
                    'issue_number' => $issueNumber,
                    'title' => $title,
                    'slug' => (string) $issueNumber,
                    'publication_date' => $publicationDate->toDateString(),
                    'access_level' => EpaperAccessLevel::Public->value,
                    'media_asset_id' => $asset->id,
                    'author_id' => $actor->id,
                    'published_by_id' => $actor->id,
                    'status' => EpaperStatus::Published->value,
                    'current_version' => 1,
                    'published_at' => $publicationDate,
                ]);
                // slug صريح رقميّ — Sluggable لا يُعيد توليده فوق قيمة غير فارغة.
                $epaper->timestamps = false;
                $epaper->created_at = $publicationDate;
                $epaper->updated_at = $publicationDate;
                $epaper->save();

                $version = new EpaperVersion;
                $version->fill([
                    'epaper_id' => $epaper->id,
                    'version' => 1,
                    'media_asset_id' => $asset->id,
                    'note' => 'مستورَد من الأرشيف الأصلي لووردبريس (wp_post_id='.$wpId.')',
                    'created_by' => $actor->id,
                ]);
                $version->timestamps = false;
                $version->created_at = $publicationDate;
                $version->updated_at = $publicationDate;
                $version->save();

                return $epaper;
            });
        } catch (Throwable $e) {
            $this->failed[] = ['wp_post_id' => $wpId, 'error' => 'db_write_failed: '.$e->getMessage()];

            return;
        }

        $epaper = Epaper::where('source_post_id', $wpId)->first();
        if ($epaper !== null) {
            // OCR مُعطَّل عمداً بقرار منتج: القارئ للعرض/التصفّح/التكبير/التنزيل فقط —
            // لا بحث، لا استخراج نصّ، لا فهرسة. توليد الغلاف فقط هو المطلوب هنا.
            GenerateEpaperCoverJob::enqueue($epaper);
            $this->created[] = ['wp_post_id' => $wpId, 'epaper_id' => $epaper->id, 'issue_number' => $issueNumber];
            $this->line("  + issue={$issueNumber} -> epaper#{$epaper->id} (wp_post={$wpId})");
        }
    }

    private function downloadPdf(string $url, \App\Models\User $actor): ?\App\Models\MediaAsset
    {
        // بعض روابط الأرشيف القديمة (guid) مخزَّنة بمخطّط http:// رغم أن نفس
        // المضيف يدعم https فعلياً (تحقّقت). SafeUrl يفرض https حصراً (دفاع SSRF) —
        // نرفع المخطّط هنا بدل إضعاف الحارس، لا يغيّر المضيف/المسار.
        if (str_starts_with($url, 'http://')) {
            $url = 'https://'.substr($url, 7);
        }

        if (! SafeUrl::isPublicHttps($url)) {
            throw new \RuntimeException('blocked by SSRF guard: '.$url);
        }

        $tmp = tempnam(sys_get_temp_dir(), 'epmig');
        if ($tmp === false) {
            throw new \RuntimeException('tempnam failed');
        }

        try {
            $response = Http::connectTimeout(10)
                ->timeout(60)
                ->retry(2, 500, throw: false)
                ->withOptions(['allow_redirects' => ['max' => 3, 'strict' => true, 'protocols' => ['https']]])
                ->get($url);

            if (! $response->successful()) {
                throw new \RuntimeException('http '.$response->status());
            }

            $body = (string) $response->body();
            if ($body === '') {
                throw new \RuntimeException('empty body');
            }

            file_put_contents($tmp, $body);

            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = $finfo !== false ? (string) finfo_file($finfo, $tmp) : '';
            if ($finfo !== false) {
                finfo_close($finfo);
            }
            if ($mime !== 'application/pdf') {
                throw new \RuntimeException('unexpected mime after download: '.$mime);
            }

            $name = rawurldecode(basename((string) parse_url($url, PHP_URL_PATH)));
            $file = new UploadedFile($tmp, $name !== '' ? $name : 'issue.pdf', 'application/pdf', null, true);

            return (new StoreMediaAssetAction)->handle($file, $actor);
        } finally {
            if (is_file($tmp)) {
                @unlink($tmp);
            }
        }
    }

    private function extractPostIssue(string $title): ?int
    {
        if (preg_match('/رقم\s+(\d{3,5})/u', $title, $m) === 1) {
            return (int) $m[1];
        }

        return null;
    }

    private function extractPdfIssue(string $title): ?int
    {
        if (preg_match_all('/\d{3,5}/', $title, $m) === false || $m[0] === []) {
            return null;
        }

        return (int) end($m[0]);
    }

    /** @return array<int,array{ID:int,post_title:string,post_date:string}> */
    private function fetchCategoryPosts(): array
    {
        $termTaxonomyId = DB::connection(self::WP_CONNECTION)
            ->table('3b5qs_term_taxonomy')
            ->where('term_id', self::WP_TERM_ID)
            ->where('taxonomy', 'category')
            ->value('term_taxonomy_id');

        $rows = DB::connection(self::WP_CONNECTION)
            ->table('3b5qs_term_relationships as tr')
            ->join('3b5qs_posts as p', 'p.ID', '=', 'tr.object_id')
            ->where('tr.term_taxonomy_id', $termTaxonomyId)
            ->where('p.post_type', 'post')
            ->where('p.post_status', 'publish')
            ->orderBy('p.post_date')
            ->get(['p.ID', 'p.post_title', 'p.post_date']);

        return $rows->map(fn ($r) => (array) $r)->all();
    }

    /**
     * فهرس أفضل PDF لكل رقم عدد — عند تعدّد نسخ لنفس الرقم يُفضَّل الأحدث رفعاً
     * (post_date)، وعند تساوي التاريخ يُفضَّل أعلى ID.
     *
     * @return array<int,array{ID:int,post_title:string,guid:string,post_date:string}>
     */
    private function fetchPdfIndex(): array
    {
        $rows = DB::connection(self::WP_CONNECTION)
            ->table('3b5qs_posts')
            ->where('post_type', 'attachment')
            ->where('post_mime_type', 'application/pdf')
            ->orderBy('post_date')
            ->orderBy('ID')
            ->get(['ID', 'post_title', 'guid', 'post_date']);

        $index = [];
        foreach ($rows as $row) {
            $issue = $this->extractPdfIssue((string) $row->post_title);
            if ($issue === null) {
                continue;
            }
            // آخر صف يفوز (الترتيب تصاعدي بالتاريخ ثم ID) = الأحدث/الأعلى ID.
            $index[$issue] = (array) $row;
        }

        return $index;
    }

    private function registerWpConnection(): void
    {
        $base = Config::get('database.connections.mysql');
        Config::set('database.connections.'.self::WP_CONNECTION, array_merge($base, [
            'database' => 'shaab_wp',
        ]));
    }

    private function printReport(bool $dryRun): void
    {
        $this->newLine();
        $this->info('=== ملخّص التشغيل'.($dryRun ? ' (DRY-RUN — بلا كتابة)' : '').' ===');
        $this->line('أُنشئت بنجاح: '.count($this->created));
        $this->line('فشلت: '.count($this->failed));
        $this->line('تُخطّيت: '.count($this->skipped));

        if ($this->failed !== []) {
            $this->newLine();
            $this->error('حالات الفشل:');
            foreach ($this->failed as $f) {
                $this->line("  wp_post={$f['wp_post_id']}: {$f['error']}");
            }
        }

        if ($this->skipped !== []) {
            $byReason = [];
            foreach ($this->skipped as $s) {
                $byReason[$s['reason']] = ($byReason[$s['reason']] ?? 0) + 1;
            }
            $this->newLine();
            $this->comment('أسباب التخطّي:');
            foreach ($byReason as $reason => $count) {
                $this->line("  {$reason}: {$count}");
            }
        }
    }

    private function writeReportFile(): void
    {
        $path = storage_path('app/epaper-migration-report-'.now()->format('Ymd_His').'.json');
        file_put_contents($path, json_encode([
            'created' => $this->created,
            'failed' => $this->failed,
            'skipped' => $this->skipped,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->newLine();
        $this->info('تقرير كامل محفوظ في: '.$path);
    }
}
