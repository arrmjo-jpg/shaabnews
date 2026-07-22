<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * تعديل معماري مُصرَّح به: نظام تصميم الأقسام (Section Design System).
 * إضافي بحت — nullable/قيم افتراضية آمنة، لا backfill مطلوب: banner_media_id=null
 * ⇒ التصميم القديم (بدون بانر)، appearance=null ⇒ افتراضيات SectionAppearanceResolver.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table): void {
            $table->foreignId('banner_media_id')->nullable()->after('icon')
                ->constrained('media_assets')->nullOnDelete();
            $table->boolean('show_title')->default(true)->after('banner_media_id');
            $table->string('layout_type', 20)->default('default')->after('show_title');
            $table->json('appearance')->nullable()->after('layout_type');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('banner_media_id');
            $table->dropColumn(['show_title', 'layout_type', 'appearance']);
        });
    }
};
