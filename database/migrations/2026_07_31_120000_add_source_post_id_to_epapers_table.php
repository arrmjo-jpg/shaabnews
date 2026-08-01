<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ترحيل "الصفحات الكاملة" من ووردبريس (shaab_wp) إلى Epaper: يحتاج ربطاً بمعرّف
 * منشور ووردبريس الأصلي (idempotency + تتبّع)، ودون فرض نفس الـ ID على epapers.id
 * (يبقى auto-increment طبيعياً — انظر نقاش الخطة). فريد كي لا يُرحَّل نفس المنشور
 * مرّتين عبر تشغيلات متكرّرة للأمر.
 *
 * قيد فريد إضافي على issue_number وحده (وليس فقط ضمن المركّب locale+issue_number
 * الموجود مسبقاً) — بطلب صريح: كل عدد رقميّ يجب أن يحمل رقماً فريداً عالمياً بصرف
 * النظر عن اللغة، لأن slug (بعد هذا الترحيل) = issue_number حرفياً، وslug فريد
 * لكل locale أصلاً — ازدواج issue_number عبر لغتين كان سيُنتج slugs متطابقة بلا
 * تعارض DB (لأن قيد slug الحالي أيضاً مركّب مع locale)، فهذا القيد الإضافي يمنع
 * ذلك التصادم المنطقي بصرامة على مستوى القاعدة، لا التطبيق فقط. forward-only.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('epapers', function (Blueprint $table): void {
            $table->unsignedBigInteger('source_post_id')->nullable()->unique()->after('id');
        });

        Schema::table('epapers', function (Blueprint $table): void {
            $table->unique('issue_number');
        });
    }

    public function down(): void
    {
        Schema::table('epapers', function (Blueprint $table): void {
            $table->dropUnique(['issue_number']);
            $table->dropColumn('source_post_id');
        });
    }
};
