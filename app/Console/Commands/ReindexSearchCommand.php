<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Article;
use App\Models\Broadcast;
use App\Models\Reel;
use App\Models\Video;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

/**
 * أمر تعافٍ موحَّد لفهارس البحث الأربعة القياسيّة (Article/Video/Reel/Broadcast)
 * — غلاف رقيق حول أوامر Scout الجاهزة والمُختبَرة (scout:import/scout:queue-import)،
 * لا إعادة تنفيذ لمنطق المزامنة. يمنح فريق العمليات اسماً واحداً متّسقاً بدل تذكّر
 * اسم الصنف الكامل لكل نوع. الجريدة (Epaper) خارج هذا الأمر عمداً — لها مسار
 * تعافٍ مستقلّ (epaper:search-reindex) لأنها لا تستخدم Scout Searchable القياسيّ.
 */
class ReindexSearchCommand extends Command
{
    protected $signature = 'search:reindex
        {type : article|video|reel|broadcast}
        {--fresh : امسح الفهرس قبل إعادة الاستيراد (يمرَّر إلى scout:import --fresh)}
        {--queue : استورد عبر طابور البحث (scout:queue-import) بدل التنفيذ المتزامن}';

    protected $description = 'يعيد بناء فهرس بحث Meilisearch لنوع محتوى واحد (article|video|reel|broadcast) من القاعدة.';

    /** @var array<string,class-string> */
    private const MODELS = [
        'article' => Article::class,
        'video' => Video::class,
        'reel' => Reel::class,
        'broadcast' => Broadcast::class,
    ];

    public function handle(): int
    {
        if (config('scout.driver') !== 'meilisearch') {
            $this->warn('SCOUT_DRIVER ليس meilisearch — لا فهرس لإعادة بنائه.');

            return self::SUCCESS;
        }

        $type = (string) $this->argument('type');
        $model = self::MODELS[$type] ?? null;

        if ($model === null) {
            $this->error("نوع غير معروف: {$type}. المتاح: ".implode(', ', array_keys(self::MODELS)));

            return self::FAILURE;
        }

        // scout:queue-import لا يدعم --fresh (خلافاً لـ scout:import) — إن طُلبا معاً
        // نُفرِّغ الفهرس يدويّاً أوّلاً عبر scout:flush ثمّ نُصدِّر بلا العلم.
        if ($this->option('queue')) {
            if ($this->option('fresh')) {
                Artisan::call('scout:flush', ['model' => $model]);
                $this->output->write(Artisan::output());
            }

            $exitCode = Artisan::call('scout:queue-import', ['model' => $model]);
        } else {
            $exitCode = Artisan::call('scout:import', array_filter([
                'model' => $model,
                '--fresh' => $this->option('fresh'),
            ]));
        }

        $this->output->write(Artisan::output());

        return $exitCode;
    }
}
