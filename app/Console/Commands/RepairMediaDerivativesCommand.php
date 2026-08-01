<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Admin\Media\RepairMissingMediaDerivativesAction;
use Illuminate\Console\Command;

/**
 * استرداد المشتقّات المفقودة فقط (thumb/medium/watermarked) — استرداد لا إعادة توليد شاملة.
 *
 * media:regenerate-derivatives يُجدوِل كل أصل صورة في المكتبة (مقصود بعد تغيير إعدادات العلامة).
 * هذا الأمر يفحص القرص ويُجدوِل الناقص فقط، فلا يُعاد ترميز ملف سليم ولا يُستهلَك الطابور بلا داعٍ.
 */
class RepairMediaDerivativesCommand extends Command
{
    protected $signature = 'media:repair-derivatives
        {--dry-run : Scan and report only — queue nothing}
        {--sync : Process inline instead of queueing (report reflects real outcomes)}
        {--limit= : Stop after this many assets have been repaired}
        {--chunk=200 : Rows per database chunk}';

    protected $description = 'Queue derivative regeneration for image assets whose thumb/medium/watermarked files are physically missing.';

    public function handle(RepairMissingMediaDerivativesAction $action): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $sync = (bool) $this->option('sync');
        $limit = $this->option('limit') !== null ? (int) $this->option('limit') : null;
        $chunk = max(1, (int) $this->option('chunk'));

        if ($dryRun && $sync) {
            $this->error('--dry-run and --sync are mutually exclusive.');

            return self::FAILURE;
        }

        $mode = $dryRun ? 'DRY RUN (nothing queued)' : ($sync ? 'SYNC (inline)' : 'QUEUE (async, queue=media)');
        $this->info("Scanning library image assets — mode: {$mode}");

        $r = $action->handle(sync: $sync, dryRun: $dryRun, limit: $limit, chunk: $chunk);

        // في وضع الطابور «repaired» = مُجدوَلة؛ النتيجة الفعليّة تظهر في worker-media.
        $repairedLabel = $dryRun ? 'Would repair' : ($sync ? 'Regenerated' : 'Queued');

        $this->newLine();
        $this->table(['Metric', 'Count'], [
            ['Scanned', $r['scanned']],
            ['Skipped (already complete)', $r['skipped']],
            [$repairedLabel, $r['repaired']],
            ['Failed', $r['failed']],
            ['Unrepairable (original missing)', $r['unrepairable']],
            ['Elapsed', sprintf('%.1fs', $r['elapsed'])],
        ]);

        if (! $dryRun && ! $sync && $r['repaired'] > 0) {
            $this->newLine();
            $this->line("  {$r['repaired']} job(s) dispatched to queue=media — processed by the worker-media service.");
            $this->line('  Re-run this command afterwards; a fully recovered library reports 0 to repair.');
        }

        if ($r['unrepairable'] > 0) {
            $this->newLine();
            $this->warn("  {$r['unrepairable']} asset(s) have no source file on disk and cannot be repaired by regeneration.");
        }

        return self::SUCCESS;
    }
}
