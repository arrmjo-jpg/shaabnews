<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('competitions', function (Blueprint $table) {
            // أعلام شريط الصفحة الرئيسية للرياضة — تحريريّة، مستقلّة تمامًا عن show_in_match_bar/
            // match_bar_sort_order (ميزة منفصلة بالكامل، تشترك فقط بجدول البطولات كمصدر واحد).
            $table->boolean('show_in_sports_home_bar')->default(false);
            $table->unsignedInteger('sports_home_bar_sort_order')->nullable();

            $table->index('show_in_sports_home_bar');
        });
    }

    public function down(): void
    {
        Schema::table('competitions', function (Blueprint $table) {
            $table->dropIndex(['show_in_sports_home_bar']);
            $table->dropColumn(['show_in_sports_home_bar', 'sports_home_bar_sort_order']);
        });
    }
};
