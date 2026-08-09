<?php

declare(strict_types=1);

namespace App\Actions\Admin\Epaper;

use App\Models\Epaper;
use App\Models\EpaperIssueStat;
use App\Models\EpaperPageView;
use App\Models\EpaperSearchTerm;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * تقرير تحليلات القارئ لعددٍ واحد (Phase 5) — أساسيّ لا مؤسسيّ: الإجماليّات +
 * أكثر الصفحات مشاهدةً + أكثر عبارات البحث. يقرأ العدّادات المجمَّعة فقط (لا PII).
 */
class ShowEpaperAnalyticsAction
{
    private const TOP_PAGES = 10;

    private const TOP_TERMS = 15;

    public function handle(Epaper $epaper): JsonResponse
    {
        $stat = EpaperIssueStat::query()->where('epaper_id', $epaper->id)->first();

        $topPages = EpaperPageView::query()
            ->where('epaper_id', $epaper->id)
            ->orderByDesc('views')->orderBy('page_number')
            ->limit(self::TOP_PAGES)
            ->get(['page_number', 'views']);

        $topTerms = EpaperSearchTerm::query()
            ->where('epaper_id', $epaper->id)
            ->orderByDesc('count')->orderBy('term')
            ->limit(self::TOP_TERMS)
            ->get(['term', 'count']);

        $sessions = (int) ($stat?->sessions ?? 0);
        $totalDuration = (int) ($stat?->total_duration_seconds ?? 0);

        return ApiResponse::success(__('epaper.analytics.shown'), [
            'issue' => [
                'id' => $epaper->id,
                'title' => $epaper->title,
                'issue_number' => $epaper->issue_number,
                'page_count' => $epaper->page_count,
            ],
            'totals' => [
                'opens' => (int) ($stat?->opens ?? 0),
                'sessions' => $sessions,
                'total_duration_seconds' => $totalDuration,
                'avg_session_seconds' => $sessions > 0 ? (int) round($totalDuration / $sessions) : 0,
                'pages_viewed' => (int) ($stat?->pages_viewed ?? 0),
                'searches' => (int) ($stat?->searches ?? 0),
                'bookmarks_used' => (int) ($stat?->bookmarks_used ?? 0),
                'resumes_used' => (int) ($stat?->resumes_used ?? 0),
                'last_activity_at' => $stat?->last_activity_at?->toISOString(),
            ],
            'top_pages' => $topPages->map(fn ($p): array => [
                'page' => (int) $p->page_number,
                'views' => (int) $p->views,
            ])->all(),
            'top_terms' => $topTerms->map(fn ($t): array => [
                'term' => (string) $t->term,
                'count' => (int) $t->count,
            ])->all(),
        ]);
    }
}
