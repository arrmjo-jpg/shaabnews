<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fixtures', function (Blueprint $table) {
            $table->id();
            $table->string('provider');
            $table->unsignedBigInteger('provider_id');
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();

            $table->string('home_name');
            $table->string('home_logo')->nullable();
            $table->unsignedSmallInteger('home_score')->nullable();

            $table->string('away_name');
            $table->string('away_logo')->nullable();
            $table->unsignedSmallInteger('away_score')->nullable();

            // scheduled | live | finished — mirrors Sport365Client::normalizeStatus.
            $table->string('status');
            $table->string('status_text')->nullable();
            $table->timestamp('kickoff_at')->nullable();

            $table->timestamps();

            $table->unique(['provider', 'provider_id']);
            $table->index(['competition_id', 'kickoff_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fixtures');
    }
};
