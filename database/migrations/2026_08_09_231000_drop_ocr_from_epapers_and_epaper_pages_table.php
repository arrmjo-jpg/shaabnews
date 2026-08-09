<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * إزالة OCR بالكامل (قرار منتج): يحذف عمودَي text_layer/ocr_status من epapers،
 * ويحذف جدول epaper_pages بأكمله (كان مخصَّصاً حصراً لنصّ الصفحات المُستخرَج عبر
 * OCR، لا استخدام آخر له — انظر app/Models/EpaperPage.php المحذوف بنفس التغيير).
 * forward-only بالتصميم (كسابقتها في هذا الملف) — down() لأغراض التطوير المحلي فقط.
 *
 * ⚠️ لم يُشغَّل هذا الترحيل بعد على أي بيئة (محلية أو إنتاج) وقت كتابته — فقط الملف
 * أُنشئ. التشغيل الفعليّ (php artisan migrate) قرار منفصل يتطلّب لمس قاعدة البيانات.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('epapers', function (Blueprint $table): void {
            $table->dropColumn(['text_layer', 'ocr_status']);
        });

        Schema::dropIfExists('epaper_pages');
    }

    public function down(): void
    {
        Schema::create('epaper_pages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('epaper_id')->constrained('epapers')->cascadeOnDelete();
            $table->unsignedInteger('page_number');
            $table->longText('text')->nullable();
            $table->string('source', 30)->nullable();
            $table->boolean('has_text')->default(false);
            $table->timestamps();

            $table->unique(['epaper_id', 'page_number']);
            $table->index(['epaper_id', 'has_text']);
        });

        Schema::table('epapers', function (Blueprint $table): void {
            $table->string('text_layer', 20)->nullable();
            $table->string('ocr_status', 20)->nullable();
        });
    }
};
