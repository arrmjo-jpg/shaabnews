<?php

declare(strict_types=1);

namespace App\Actions\Public\Sport;

use App\Enums\MatchBarSource;
use App\Models\Competition;
use App\Models\Fixture;
use App\Settings\MatchBarSettings;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

/**
 * شريط المباريات — منظر مُصفّى فوق بيانات مُزامَنة أصلًا (Competition::is_tracked)، لا مصدر
 * بيانات بذاته. المصدر الفعليّ (المميّزة/الدوريّات) قرار تحريريّ حصريّ واحد (MatchBarSource) —
 * لا وضع دمج، فلا حاجة لخطوة merge/dedupe إطلاقًا. علمَا التغطية (is_tracked) لا يُقرآن هنا
 * أبدًا: مباراة لبطولة غير مُزامَنة ببساطة لا تملك صفوف fixtures، فتُستبعَد تلقائيًّا بلا أيّ
 * تحقّق صريح — الفصل بنيويّ لا اصطلاحيّ فقط.
 *
 * فارغ (معطَّل، أو المصدر المختار بلا بطولات مؤهَّلة، أو بلا مواعيد مُزامَنة) ⇒ enabled:false
 * دائمًا — الواجهة لا تعرض شريطًا فارغًا أبدًا. بلا نافذة زمنيّة: يعرض أرشيف البطولة المؤهَّلة
 * كاملًا (كلّ ما زامنته SyncTrackedCompetitionFixturesAction)، مُرتَّبًا زمنيًّا تصاعديًّا.
 */
final class BuildMatchBarAction
{
    /** سقف أمان أعلى من أكبر بطولة واقعيّة (كأس عالم 48 منتخبًا = 104 مباراة) بهامش. */
    private const LIMIT = 150;

    public function handle(): JsonResponse
    {
        $source = MatchBarSource::tryFrom(app(MatchBarSettings::class)->source) ?? MatchBarSource::Disabled;

        if ($source === MatchBarSource::Disabled) {
            return $this->disabled();
        }

        $competitionIds = $this->eligibleCompetitionIds($source);
        if ($competitionIds->isEmpty()) {
            return $this->disabled();
        }

        $fixtures = Fixture::query()
            ->whereIn('competition_id', $competitionIds)
            ->with('competition:id,match_bar_sort_order')
            ->orderBy('kickoff_at')
            ->limit(self::LIMIT)
            ->get();

        if ($fixtures->isEmpty()) {
            return $this->disabled();
        }

        // ترتيب البطولة (سطح الأعمال) ثمّ زمن الانطلاق تصاعديًّا (نتائج سابقة ← اليوم ← قادمة).
        // مقارن صريح (لا Collection::sortBy متعدّد المعايير — سلوكها مع دوال مجرّدة غير موثوق).
        $ordered = $fixtures
            ->sort(function (Fixture $a, Fixture $b): int {
                $orderA = $a->competition?->match_bar_sort_order ?? PHP_INT_MAX;
                $orderB = $b->competition?->match_bar_sort_order ?? PHP_INT_MAX;
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

    /** @return Collection<int,int> */
    private function eligibleCompetitionIds(MatchBarSource $source): Collection
    {
        return match ($source) {
            MatchBarSource::FeaturedCompetitions => Competition::query()->currentlyFeatured()->pluck('id'),
            MatchBarSource::RegularLeagues => Competition::query()->where('show_in_match_bar', true)->pluck('id'),
            MatchBarSource::Disabled => collect(),
        };
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
        ];
    }
}
