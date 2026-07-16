<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Enums\MatchBarSource;
use App\Models\Competition;
use App\Settings\MatchBarSettings;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * يعيد الوضع الحاليّ + عدّاد البطولات المؤهَّلة له (لا مواعيد — مجرّد عدّ سريع) كي تُظهر
 * لوحة الإدارة تحذيرًا فوريًّا حين يُختار وضع بلا أيّ بطولة مؤهَّلة (سيُعرَض شريط فارغ فيُخفى
 * تلقائيًّا من الواجهة العامة — التحذير هنا يمنع مفاجأة المحرّر لا أكثر).
 */
final class ShowMatchBarSettingsAction
{
    public function handle(): JsonResponse
    {
        $settings = app(MatchBarSettings::class);
        $source = MatchBarSource::tryFrom($settings->source) ?? MatchBarSource::Disabled;

        return ApiResponse::success(data: [
            'source' => $source->value,
            'eligible_competitions_count' => match ($source) {
                MatchBarSource::FeaturedCompetitions => Competition::query()->currentlyFeatured()->count(),
                MatchBarSource::RegularLeagues => Competition::query()->where('show_in_match_bar', true)->count(),
                MatchBarSource::Disabled => 0,
            },
        ]);
    }
}
