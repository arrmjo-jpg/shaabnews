<?php

declare(strict_types=1);

namespace App\Actions\Admin\Sport;

use App\Settings\MatchBarSettings;
use App\Support\Audit\SettingsAudit;
use App\Support\Frontend\FrontendRevalidate;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

final class UpdateMatchBarSettingsAction
{
    /** @param  array<string,mixed>  $data */
    public function handle(array $data): JsonResponse
    {
        $settings = app(MatchBarSettings::class);
        $settings->source = (string) $data['source'];
        $settings->save();

        // حالة غير Eloquent (Spatie Settings) ⇒ تدقيق يدويّ بأسماء المفاتيح فقط.
        SettingsAudit::log('match_bar', array_keys($data));

        // إبطال فوريّ — المحرّر لا ينتظر انتهاء صلاحية كاش ليرى أثر تبديل الوضع.
        FrontendRevalidate::tags(['match-bar']);

        return ApiResponse::success(__('sport.match_bar_settings_updated'), ['source' => $settings->source]);
    }
}
