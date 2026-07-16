<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_entity', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('entity_id')->constrained('entities')->cascadeOnDelete();

            // تجميع polymorphic عبر أنواع المحتوى (Article/Video/Reel/…) — عقد
            // توسيم مستقلّ عن جدول أيّ نوع بعينه (ADR-E1: عقد سلوكيّ، لا جدول
            // موحَّد). لا قيد FK ممكن على العمود الـpolymorphic (نمط Laravel القياسي).
            $table->string('taggable_type');
            $table->unsignedBigInteger('taggable_id');

            // مَن أسند الوسم — polymorphic أيضاً كي تُمثِّل هويّة غير بشريّة لاحقاً
            // (P5: وكيل AI) دون تعديل المخطّط. Phase 1: 'App\Models\User' فقط،
            // يُضبَط صراحةً في كود التطبيق (لا افتراض على مستوى القاعدة).
            $table->string('assigned_by_type')->nullable();
            $table->unsignedBigInteger('assigned_by_id')->nullable();

            // Phase 1: توسيم يدويّ فقط ⇒ confirmed دائماً. suggested/confidence
            // محجوزان لاقتراحات AI (Phase 5) — غير مُستخدَمين الآن.
            $table->string('status', 20)->default('confirmed');
            $table->float('confidence')->nullable();

            $table->timestamps();

            $table->unique(['entity_id', 'taggable_type', 'taggable_id'], 'content_entity_unique');
            $table->index(['taggable_type', 'taggable_id'], 'content_entity_taggable_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_entity');
    }
};
