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
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        // 1. Index on engagement_counters for Most Read sorting
        if (! $this->hasIndex('engagement_counters', 'engagement_counters_type_views_likes_idx')) {
            DB::statement('CREATE INDEX engagement_counters_type_views_likes_idx ON engagement_counters (engageable_type, views DESC, likes DESC, engageable_id)');
        }

        // 2. Index on articles for Trending sorting
        if (! $this->hasIndex('articles', 'articles_status_locale_vcount_idx')) {
            DB::statement('CREATE INDEX articles_status_locale_vcount_idx ON articles (status, locale, views_count DESC)');
        }

        // 3. Composite Index on articles for Category Pagination
        if (! $this->hasIndex('articles', 'articles_locale_pcat_status_pub_idx')) {
            DB::statement('CREATE INDEX articles_locale_pcat_status_pub_idx ON articles (locale, status, primary_category_id, is_pinned DESC, published_at DESC)');
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

        if ($this->hasIndex('articles', 'articles_locale_pcat_status_pub_idx')) {
            Schema::table('articles', function (Blueprint $table): void {
                $table->dropIndex('articles_locale_pcat_status_pub_idx');
            });
        }

        if ($this->hasIndex('articles', 'articles_status_locale_vcount_idx')) {
            Schema::table('articles', function (Blueprint $table): void {
                $table->dropIndex('articles_status_locale_vcount_idx');
            });
        }

        if ($this->hasIndex('engagement_counters', 'engagement_counters_type_views_likes_idx')) {
            Schema::table('engagement_counters', function (Blueprint $table): void {
                $table->dropIndex('engagement_counters_type_views_likes_idx');
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
