<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Sport\SyncTrackedCompetitionFixturesAction;
use Illuminate\Console\Command;

/**
 * يزامن fixtures لبطولات التغطية (Competition::is_tracked). يُدار عبر SchedulerRegistry (كل دقيقة).
 * idempotent، آمن عند الفراغ (لا بطولات مُتابَعة ⇒ صفر نداءات).
 */
class SyncTrackedCompetitionFixturesCommand extends Command
{
    protected $signature = 'competitions:sync-fixtures';

    protected $description = 'Sync fixtures for tracked (is_tracked=true) competitions, independent of Match Bar flags.';

    public function handle(SyncTrackedCompetitionFixturesAction $action): int
    {
        $count = $action->handle();

        $this->info("Synced {$count} fixture(s) for tracked competitions.");

        return self::SUCCESS;
    }
}
