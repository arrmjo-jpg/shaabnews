<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('competitions', function (Blueprint $table) {
            $table->id();
            $table->string('provider');
            $table->unsignedBigInteger('provider_id');
            $table->string('name');
            $table->string('logo_url')->nullable();
            $table->boolean('is_active')->default(true);

            // Coverage (sync scope) — system-owned, decides what the sync layer keeps fresh.
            // Independent of every presentation flag below (see is_featured_tournament / show_in_match_bar).
            $table->boolean('is_tracked')->default(false);
            $table->timestamp('last_synced_at')->nullable();

            // Match Bar presentation flags — editorial, read-only from the sync layer's perspective.
            // Only meaningful once is_tracked = true and fixtures actually exist to display.
            $table->boolean('is_featured_tournament')->default(false);
            $table->date('featured_until')->nullable();
            $table->boolean('show_in_match_bar')->default(false);
            $table->unsignedInteger('match_bar_sort_order')->nullable();

            $table->timestamps();

            $table->unique(['provider', 'provider_id']);
            $table->index('is_tracked');
            $table->index(['is_featured_tournament', 'featured_until']);
            $table->index('show_in_match_bar');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('competitions');
    }
};
