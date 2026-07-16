<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * حجز عمود tenant_id (Phase 1، Task 9) — غير مُستخدَم وغير مُنفَّذ الآن؛
 * White-label اليوم عزل على مستوى النشر (deployment-per-tenant)، لا بيانات
 * مشتركة. هذا العمود تأمين رخيص: ALTER TABLE على صفوف 2M+ لاحقاً مؤلم؛
 * إضافته الآن على جداول فارغة نسبياً غير مكلفة.
 *
 * بلا فهرس عمداً — شكل الفهرس المُركَّب الصحيح يعتمد على أنماط استعلام
 * فعليّة لا توجد بعد (Phase 6 مُشرَّط بإشارة عمل حقيقيّة: عميل White-label
 * ثانٍ فعليّ). إضافة فهرس تخمينيّ الآن سابقة لأوانها.
 *
 * النطاق: أنواع المحتوى الأساسيّة + تصنيفاتها + الأصول المشتركة + سجلّ
 * الكيانات (Task 4) — لا Users ولا جداول pivot (tenant مُشتقّ ضمنيّاً من
 * طرفي العلاقة في هذه الأخيرة).
 */
return new class extends Migration
{
    private const TABLES = [
        'articles', 'videos', 'reels', 'broadcasts', 'pages',
        'categories', 'video_categories', 'broadcast_categories',
        'video_playlists', 'media_assets', 'entities',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t): void {
                $t->unsignedBigInteger('tenant_id')->nullable()->after('id');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t): void {
                $t->dropColumn('tenant_id');
            });
        }
    }
};
