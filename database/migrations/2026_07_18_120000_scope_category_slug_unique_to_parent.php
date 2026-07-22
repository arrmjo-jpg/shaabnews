<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * يوسّع فرادة slug القسم من (locale, slug) إلى (locale, parent_id, slug) —
 * لازم لسلامة المسار المتداخل الجديد /news/category/{...} (2026-07-18):
 * لولا هذا القيد لأمكن تصنيفَين تحت أبوين مختلفين أن يتشاركا نفس الـ slug
 * فيتعذّر تمييز مسارهما.
 *
 * آمن بلا فحص تصادم مسبق على البيانات القائمة: القيد القديم (locale, slug)
 * أشدّ صرامة من الجديد (يمنع أي تشارك slug ضمن اللغة بصرف النظر عن الأب) —
 * فأي بيانات تحقّقه اليوم تحقّق تلقائياً القيد الأوسع الجديد.
 *
 * ملاحظة صدق: عمود مُولَّد (COALESCE(parent_id,0) STORED) كان سيجعل الفهرس
 * يفرض التفرّد بدقّة حتى بين الجذور (parent_id IS NULL) — جُرِّب فعلياً وفشل
 * على MySQL 8.4 بخطأ 1215 (self-referencing foreign key على parent_id يرفض
 * إعادة بناء الجدول لإضافة عمود مُولَّد). البديل الأبسط أدناه (فهرس مباشر على
 * parent_id) **لا يفرض تفرّداً بين صفّين جذريين يتشاركان نفس slug** (MySQL
 * يعامل NULL كقيمة متمايزة دوماً في unique index) — التصنيفات الجذرية قليلة
 * ومُنسَّقة إدارياً، ويبقى المستوى التطبيقي (Category::scopeWithUniqueSlugConstraints
 * + Sluggable) خطّ الدفاع الفعليّ لهذه الحالة تحديداً، تماماً كما كان قبل هذه
 * الهجرة. التصنيفات غير الجذرية (parent_id محدَّد) تُفرَض بدقّة كاملة على مستوى القاعدة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table): void {
            $table->dropUnique(['locale', 'slug']);
            $table->unique(['locale', 'parent_id', 'slug'], 'categories_locale_parent_slug_unique');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table): void {
            $table->dropUnique('categories_locale_parent_slug_unique');
            $table->unique(['locale', 'slug']);
        });
    }
};
