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
        // composite indexes are specific to MySQL 8+ supporting descending indexes.
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        if (! $this->hasIndex('articles', 'articles_deleted_published_desc_idx')) {
            DB::statement('CREATE INDEX articles_deleted_published_desc_idx ON articles (deleted_at, published_at DESC)');
        }

        if (! $this->hasIndex('articles', 'articles_pcat_deleted_published_idx')) {
            DB::statement('CREATE INDEX articles_pcat_deleted_published_idx ON articles (primary_category_id, deleted_at, published_at DESC)');
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

        if ($this->hasIndex('articles', 'articles_pcat_deleted_published_idx')) {
            Schema::table('articles', function (Blueprint $table): void {
                $table->dropIndex('articles_pcat_deleted_published_idx');
            });
        }

        if ($this->hasIndex('articles', 'articles_deleted_published_desc_idx')) {
            Schema::table('articles', function (Blueprint $table): void {
                $table->dropIndex('articles_deleted_published_desc_idx');
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
