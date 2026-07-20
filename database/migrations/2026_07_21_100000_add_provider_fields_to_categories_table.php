<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ربط تصنيف الرياضة بمزوّد البيانات الخارجي (Sports Engine — Approved Architecture Baseline v1.0).
 * إضافي بحت — nullable، بلا قيم افتراضية تمسّ الصفوف الحالية. provider/external_id يُستهلكان
 * علنًا (PublicCategoryResource) لأن الواجهة تحتاجهما لتوجيه تصنيف الرياضة إلى محرّك الرياضة؛
 * provider_metadata يبقى داخليًّا (Admin فقط) إذ لا عقد عامّ محدَّد لشكله.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table): void {
            $table->string('provider', 50)->nullable()->after('appearance');
            $table->string('external_id', 100)->nullable()->after('provider');
            $table->json('provider_metadata')->nullable()->after('external_id');
            $table->index(['provider', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table): void {
            $table->dropIndex(['provider', 'external_id']);
            $table->dropColumn(['provider', 'external_id', 'provider_metadata']);
        });
    }
};
