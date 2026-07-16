<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // composite index is specific to MySQL; covers the withCount('articles') subquery
        // in ShowPublicArticleAction (author_id + status + deleted_at + published_at), which
        // was doing a full row-by-row filter over every article by the given author after an
        // author_id-only index lookup (measured 5-8s for the WP-migration placeholder author,
        // who owns ~80k articles). This index lets MySQL answer the COUNT from the index alone.
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        if (! $this->hasIndex('articles', 'articles_author_published_count_idx')) {
            DB::statement('CREATE INDEX articles_author_published_count_idx ON articles (author_id, status, deleted_at, published_at)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        if ($this->hasIndex('articles', 'articles_author_published_count_idx')) {
            Schema::table('articles', function (Blueprint $table): void {
                $table->dropIndex('articles_author_published_count_idx');
            });
        }
    }

    /**
     * Check if an index exists on a table.
     */
    private function hasIndex(string $table, string $index): bool
    {
        return collect(Schema::getIndexes($table))
            ->contains(fn (array $i): bool => $i['name'] === $index);
    }
};
