<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * علم عرض جديد «مربعات» — منطقة عرض مستقلّة على الموقع
 * (نظير أعلام السلايدر/العاجل/الهيدر/تريندنغ، تُضبط من نموذج الخبر مباشرةً).
 */
return new class extends Migration
{
    public function up(): void
    {
        // idempotent: العمود قد يكون أُضيف مسبقًا (محاولة سابقة/يدويًّا) ⇒ لا نُكرّره.
        if (Schema::hasColumn('articles', 'is_squares')) {
            return;
        }

        Schema::table('articles', function (Blueprint $table): void {
            $table->boolean('is_squares')->default(false)->after('is_editor_pick')->index();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('articles', 'is_squares')) {
            return;
        }

        Schema::table('articles', function (Blueprint $table): void {
            $table->dropColumn('is_squares');
        });
    }
};
