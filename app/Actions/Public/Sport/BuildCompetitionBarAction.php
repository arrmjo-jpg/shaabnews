<?php

declare(strict_types=1);

namespace App\Actions\Public\Sport;

use App\Models\Competition;
use App\Models\Fixture;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * منطق بناء "شريط بطولات" مشترك — منظر مُصفّى فوق بيانات مُزامَنة أصلًا (Competition::is_tracked)،
 * لا مصدر بيانات بذاته. يستخدمه Match Bar وSports Home Bar، كلٌّ بأعلامه الخاصّة (عمود الاختيار،
 * عمود الترتيب) بلا أيّ تداخل بينهما — راجع MatchBarController/SportsHomeBarController. علم
 * التغطية (is_tracked) لا يُقرأ هنا أبدًا: مباراة لبطولة غير مُزامَنة ببساطة لا تملك صفوف fixtures،
 * فتُستبعَد تلقائيًّا بلا أيّ تحقّق صريح — الفصل بنيويّ لا اصطلاحيّ فقط.
 *
 * فارغ (معطَّل، أو بلا بطولات مختارة، أو بلا مواعيد بالنافذة) ⇒ enabled:false دائمًا — الواجهة لا
 * تعرض شريطًا فارغًا أبدًا.
 *
 * **نافذة زمنيّة: أمس + اليوم + غدًا فقط** (قرار المستخدم 2026-07-20، يُصحِّح تصميمًا أصليًّا
 * "بلا نافذة" كان يعرض الأرشيف الكامل مرتَّبًا تصاعديًّا). ذاك التصميم انكشف كخطأ فعليّ مع تعدّد
 * البطولات المختارة: ORDER BY kickoff_at ASC + LIMIT كانا يُرجعان أقدم 150 مباراة عبر الأرشيف
 * المجمَّع (امتدّ فعليًّا لأشهر ماضية عند اختيار 11 بطولة)، فتُحجَب كل المباريات الحاليّة/القادمة
 * خلف السقف رغم وجودها. LIMIT بقي سقف أمان احتياطيّ فقط، لا آلية التحكّم الأساسيّة بعد الآن.
 */
final class BuildCompetitionBarAction
{
    /** سقف أمان احتياطيّ — النافذة الزمنيّة (3 أيام) كافية وحدها عمليًّا لإبقاء العدد صغيرًا. */
    private const LIMIT = 150;

    public function handle(bool $enabled, string $selectedColumn, string $sortColumn): JsonResponse
    {
        if (! $enabled) {
            return $this->disabled();
        }

        $competitionIds = Competition::query()->where($selectedColumn, true)->pluck('id');
        if ($competitionIds->isEmpty()) {
            return $this->disabled();
        }

        $fixtures = Fixture::query()
            ->whereIn('competition_id', $competitionIds)
            ->whereBetween('kickoff_at', [now()->subDay()->startOfDay(), now()->addDay()->endOfDay()])
            ->with("competition:id,name,logo_url,{$sortColumn}")
            ->orderBy('kickoff_at')
            ->limit(self::LIMIT)
            ->get();

        if ($fixtures->isEmpty()) {
            return $this->disabled();
        }

        // ترتيب البطولة (سطح الأعمال) ثمّ زمن الانطلاق تصاعديًّا (نتائج سابقة ← اليوم ← قادمة).
        // مقارن صريح (لا Collection::sortBy متعدّد المعايير — سلوكها مع دوال مجرّدة غير موثوق).
        $ordered = $fixtures
            ->sort(function (Fixture $a, Fixture $b) use ($sortColumn): int {
                $orderA = $a->competition?->{$sortColumn} ?? PHP_INT_MAX;
                $orderB = $b->competition?->{$sortColumn} ?? PHP_INT_MAX;
                if ($orderA !== $orderB) {
                    return $orderA <=> $orderB;
                }

                return ($a->kickoff_at?->timestamp ?? 0) <=> ($b->kickoff_at?->timestamp ?? 0);
            })
            ->values();

        return ApiResponse::success(data: [
            'enabled' => true,
            'matches' => $ordered->map(fn (Fixture $f): array => $this->shape($f))->all(),
        ]);
    }

    private function disabled(): JsonResponse
    {
        return ApiResponse::success(data: ['enabled' => false, 'matches' => []]);
    }

    /** @return array<string,mixed> */
    private function shape(Fixture $f): array
    {
        return [
            'id' => $f->provider_id,
            'kind' => match ($f->status) {
                'live' => 'live',
                'finished' => 'finished',
                default => 'upcoming',
            },
            'status_text' => $f->status_text,
            'kickoff_at' => $f->kickoff_at?->toISOString(),
            'home' => ['name' => $f->home_name, 'logo' => $f->home_logo, 'score' => $f->home_score],
            'away' => ['name' => $f->away_name, 'logo' => $f->away_logo, 'score' => $f->away_score],
            // اختياريّ بالنسبة لمستهلكي الشريط الأفقي البسيط (LeagueMatchesTicker يتجاهله عبر
            // .passthrough())، لكن ضروريّ لأيّ مستهلك يحتاج تجميع المباريات حسب البطولة (مثل ودجت
            // «الدوريات العربية» بالصفحة الرئيسية).
            'competition' => $f->competition !== null ? [
                'id' => $f->competition->id,
                'name' => $f->competition->name,
                'logo' => $f->competition->logo_url,
            ] : null,
        ];
    }
}
