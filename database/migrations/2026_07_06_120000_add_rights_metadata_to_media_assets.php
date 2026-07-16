<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * بيانات حقوق/ترخيص الوسيط (Phase 1، Task 8) — media_assets يملك بالفعل
 * credit/source (منذ 2026_05_20_110000)؛ هذه الحقول الثلاثة تُكمِّلها بما
 * يلزم لإدارة رخصة الاستخدام وانتهائها فعليًّا، لا مجرّد الإسناد.
 *
 * license_type نصّ حرّ عمداً (لا enum بعد) — لا واجهة تستهلكه بعد ولا تصنيف
 * معتمَد؛ فرض قيمٍ مغلقة الآن تخمينٌ لا داعٍ له.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_assets', function (Blueprint $table): void {
            $table->string('license_type')->nullable()->after('source');
            $table->timestamp('rights_expiry_at')->nullable()->after('license_type');
            $table->text('usage_terms')->nullable()->after('rights_expiry_at');
        });
    }

    public function down(): void
    {
        Schema::table('media_assets', function (Blueprint $table): void {
            $table->dropColumn(['license_type', 'rights_expiry_at', 'usage_terms']);
        });
    }
};
