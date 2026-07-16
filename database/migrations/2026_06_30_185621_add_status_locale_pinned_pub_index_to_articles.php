<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // يخدم ترتيب قائمة الأخبار العامّة (ListPublicArticlesAction): status+locale تكافؤ ثمّ
        // is_pinned DESC, published_at DESC عبر Backward index scan ⇒ يُلغي الـfilesort على
        // كامل المجموعة (217ألف صفّ). مُثبَت: 10,387ms → 0.136ms على هذا الجدول.
        Schema::table('articles', function (Blueprint $table) {
            $table->index(
                ['status', 'locale', 'is_pinned', 'published_at'],
                'articles_status_locale_pinned_pub_idx'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropIndex('articles_status_locale_pinned_pub_idx');
        });
    }
};
