<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * قائمة أقسام محتوى Header 1 الرياضي (Sports Engine — Approved Architecture Baseline v1.0, §8).
 * مفهوم مستقلّ تمامًا عن شجرة تصنيفات نوع الرياضة (Football/Basketball/... في categories):
 * هذا الجدول يمثّل قائمة تنقّل تُدار من CMS (أخبار/مباريات/نتائج/بطولات/فرق/لاعبون/انتقالات/
 * فيديو/مقالات/توقعات) لا شجرة رياضات. عنصر واحد يحمل إمّا category_id (عنصر تحريريّ يشير
 * إلى تصنيف حقيقي) أو section_key (عنصر وظيفيّ يشير إلى صفحة/عرض ثابت في محرّك الرياضة) —
 * التحقّق من التبادليّة (XOR) بحسب type يقع في طبقة الـ FormRequest، لا هنا.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sport_menu_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('parent_id')->nullable()
                ->constrained('sport_menu_items')->nullOnDelete();
            $table->string('locale', 10)->index();
            $table->string('title', 150);
            $table->string('type', 20);
            $table->foreignId('category_id')->nullable()
                ->constrained('categories')->nullOnDelete();
            $table->string('section_key', 50)->nullable();
            $table->string('icon', 100)->nullable();
            $table->unsignedInteger('order')->default(0);
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->index(['parent_id', 'order'], 'sport_menu_items_parent_order_idx');
            $table->index(['locale', 'enabled', 'order'], 'sport_menu_items_locale_enabled_order_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sport_menu_items');
    }
};
