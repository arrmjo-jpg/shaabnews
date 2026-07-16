<?php

declare(strict_types=1);

namespace App\Support\Content\Workflow;

/**
 * تعريف بيانات لسير عمل تحريريّ (حالات + انتقالات + صلاحيّات) — كيان بيانات
 * صرف، لا سلوك. كلّ نوع محتوى (Article/Video/Reel) يوفّر نسخته الخاصّة بقيمه
 * التجاريّة الفعليّة (جدول الانتقالات عمل هذه المؤسّسة، وليس تخميناً معمارياً).
 *
 * messages لكلّ نوع حرفيًّا — لا تُوحَّد عمداً، حفاظاً على نصوص الأخطاء
 * الحاليّة تمامًا كما هي (حتى مع اختلاف التسمية بين الأنواع اليوم: مثلاً
 * schedule_requires_future_date عند المقال مقابل schedule_future عند الريل).
 */
final readonly class WorkflowDefinition
{
    /**
     * @param  array<string, list<string>>  $transitions  حالة → الحالات المسموح الانتقال إليها
     * @param  array<string, list<string>>  $writerAllowed  حالة → ما يسمح للكاتب (غير التحريري) الانتقال إليه
     * @param  array<string, string>  $abilityForTarget  حالة هدف → صلاحيّة إضافيّة مطلوبة (فارغ = لا بوّابة دقيقة لهذا النوع)
     * @param  array<string, string>  $messages  اسم القاعدة → مفتاح الترجمة الحرفيّ لهذا النوع تحديدًا
     */
    public function __construct(
        public array $transitions,
        public array $writerAllowed,
        public array $abilityForTarget,
        public array $messages,
    ) {}
}
