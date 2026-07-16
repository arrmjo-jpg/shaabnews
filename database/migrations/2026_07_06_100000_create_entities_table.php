<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entities', function (Blueprint $table): void {
            $table->id();
            $table->string('type', 20)->index();
            $table->string('name', 190);
            $table->string('slug', 200);
            $table->text('description')->nullable();

            // مرجع خارجيّ (Wikidata QID أو ما شابه) — محجوز لمرحلة الربط
            // بالـKnowledge Graph لاحقاً (Phase 4)، غير مُستخدَم الآن.
            $table->string('external_ref', 190)->nullable();

            $table->foreignId('created_by_id')->nullable()
                ->constrained('users')->nullOnDelete();
            $table->softDeletes();
            $table->timestamps();

            // فرادة ضمن نفس النوع فقط (شخص وموضوع قد يتشابه اسمهما دون تصادم)
            $table->unique(['type', 'slug']);
            $table->index(['type', 'name'], 'entities_type_name_idx');
            // نفس نمط categories_deleted_locale_idx — استعلامات السرد الحيّ تُصفّي
            // بـ(deleted_at, type) معاً.
            $table->index(['deleted_at', 'type'], 'entities_deleted_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entities');
    }
};
