<?php

declare(strict_types=1);

namespace App\Actions\Admin\Vertix;

use App\Enums\CategoryScope;
use App\Enums\CategoryStatus;
use App\Enums\VertixPhase;
use App\Enums\VertixRunStatus;
use App\Models\Category;
use App\Models\VertixRun;
use App\Support\Content\SlugGenerator;
use App\Support\Vertix\VertixSource;
use Illuminate\Database\UniqueConstraintViolationException;
use Throwable;

/**
 * المرحلة الأولى: استيراد أقسام Vertix بحفظ المعرّف الأصليّ مباشرةً —
 * categories.id = art_categories.catid (بلا mapping/source_id/تحويل).
 *
 * المطابقة بالـ id نفسه: موجود ⇒ تخطٍّ (لا تكرار)؛ غير موجود ⇒ إنشاء بمعرّفه.
 * الهرمية مباشرة: parent_id = parentid (لأنّ id = catid). Idempotent، آمن لإعادة التشغيل.
 */
class ImportVertixCategoriesAction
{
    public function handle(): VertixRun
    {
        $run = VertixRun::forPhase(VertixPhase::Categories);
        $locale = (string) config('vertix.locale', 'ar');
        $rows = VertixSource::make()->categories();

        $run->forceFill([
            'status' => VertixRunStatus::Running->value,
            'total' => count($rows),
            'started_at' => $run->started_at ?? now(),
            'finished_at' => null,
            'last_error' => null,
            'errors' => [],
        ])->save();

        $failed = 0;
        $errors = [];

        // إنشاء مسطّح (المعرّف = catid).
        foreach ($rows as $c) {
            $catid = (int) $c->catid;
            // withTrashed: القسم المحذوف منطقيًّا يبقى فيزيائيًّا (categories يستخدم
            // SoftDeletes)؛ الفحص بالنطاق الافتراضيّ ينجح كذباً ثمّ يفشل الإدراج بتضارب PRIMARY.
            if (Category::withTrashed()->whereKey($catid)->exists()) {
                continue; // موجود بنفس المعرّف (ولو محذوفاً منطقيًّا) ⇒ لا تكرار (Idempotent)
            }
            try {
                $category = new Category;
                $category->incrementing = false;
                $category->id = $catid; // حفظ المعرّف الأصليّ
                $category->fill([
                    'locale' => $locale,
                    'scope' => CategoryScope::News->value,
                    'name' => trim((string) $c->title) !== '' ? mb_substr(trim((string) $c->title), 0, 150) : ('قسم '.$catid),
                    'status' => ((int) $c->status === 1 ? CategoryStatus::Active : CategoryStatus::Hidden)->value,
                ]);
                $category->slug = $this->slug($c, $locale);
                $category->save();
            } catch (UniqueConstraintViolationException $e) {
                continue; // سُبِق إنشاؤه (سباق/صفّ غير مرئيّ للفحص) ⇒ تخطٍّ لا فشل
            } catch (Throwable $e) {
                $failed++;
                $errors[] = ['type' => 'category', 'id' => $catid, 'error' => mb_substr($e->getMessage(), 0, 300), 'at' => now()->toISOString()];
            }
        }

        // ربط الأب مباشرةً (parent_id = parentid، لأنّ id = catid).
        foreach ($rows as $c) {
            $parent = (int) ($c->parentid ?? 0);
            if ($parent > 0
                && Category::query()->whereKey((int) $c->catid)->exists()
                && Category::query()->whereKey($parent)->exists()) {
                $category = Category::find((int) $c->catid);
                if ($category !== null && $category->parent_id !== $parent) {
                    $category->parent_id = $parent;
                    $category->save();
                }
            }
        }

        $run->forceFill([
            'status' => VertixRunStatus::Completed->value,
            'imported' => Category::query()->count(),
            'failed' => $failed,
            'errors' => $errors,
            'finished_at' => now(),
        ])->save();

        return $run->fresh();
    }

    private function slug(object $c, string $locale): string
    {
        $base = trim(rawurldecode((string) ($c->seo_name ?? '')));
        if ($base === '') {
            $base = SlugGenerator::makeWithFallback((string) $c->title, '-');
        }
        $base = mb_substr($base, 0, 180);
        if ($base === '') {
            $base = 'cat-'.$c->catid;
        }

        // قاعدة فارغة ⇒ تصادم slug نادر (بين أقسام Vertix فقط)؛ لاحقة بالمعرّف للفرادة.
        $exists = Category::query()->where('locale', $locale)->where('slug', $base)->exists();

        return $exists ? $base.'-'.(int) $c->catid : $base;
    }
}
