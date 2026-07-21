<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Sport\SyncMatchesFeedCompetitionsAction;
use Illuminate\Console\Command;

/**
 * يُعرِّف البطولات الظاهرة بصفحة المباريات العامة اليوم كصفوف Competition — لتغذية لوحة اختيار
 * شريط المباريات بنفس مصدر صفحة المباريات، لا كتالوج منفصل. يُدار عبر SchedulerRegistry (يوميًّا).
 */
class SyncMatchesFeedCompetitionsCommand extends Command
{
    protected $signature = 'competitions:sync-matches-feed';

    protected $description = 'Upsert competitions from the same feed the public matches page uses, for Match Bar selection.';

    public function handle(SyncMatchesFeedCompetitionsAction $action): int
    {
        $count = $action->handle();

        $this->info("Synced {$count} competition(s) from today's matches feed.");

        return self::SUCCESS;
    }
}
