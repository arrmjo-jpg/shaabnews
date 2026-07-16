<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * عدّاد محاولات دفتر الوسائط (wp_migration_media) — كان غائباً منذ إنشاء الجدول رغم
 * أن WpMediaImporter يعتمد عليه لحسم إعادة المحاولة مقابل dead-letter لكل صورة
 * (منفصل عن attempts على مستوى المنشور في wp_migration_items).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wp_migration_media', function (Blueprint $table): void {
            $table->unsignedInteger('attempts')->default(0)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('wp_migration_media', function (Blueprint $table): void {
            $table->dropColumn('attempts');
        });
    }
};
