<?php

declare(strict_types=1);

namespace App\Actions\Sport;

use App\Models\Competition;
use App\Models\Fixture;
use App\Support\Sport\Sport365Client;
use Illuminate\Support\Facades\Cache;

/**
 * يزامن `fixtures` لبطولات التغطية فقط (Competition::is_tracked = true) — النطاق الوحيد الذي
 * يقرأه هذا الإجراء. لا علاقة إطلاقًا بأعلام شريط المباريات التحريريّة (is_featured_tournament/
 * show_in_match_bar): تعطيل بطولة في الشريط لا يوقف مزامنتها هنا، وتفعيلها في الشريط لا يُسرِّع
 * مزامنتها هنا — فصل بنيويّ (راجع Competition::class docblock). idempotent (updateOrCreate
 * بـ(provider, provider_id)) + قفل موزّع يمنع التداخل. يُدار عبر SchedulerRegistry.
 * لا تقليم هنا: الأشرطة تعرض أرشيف البطولة كاملًا (راجع BuildCompetitionBarAction)، فحذف مواعيد
 * منقضية يُفقِد بيانات لا يزال العرض بحاجتها.
 *
 * @return int عدد المواعيد المُزامَنة
 */
final class SyncTrackedCompetitionFixturesAction
{
    private const LOCK_KEY = 'competitions:sync-fixtures';

    public function __construct(private readonly Sport365Client $client) {}

    public function handle(): int
    {
        // TTL مرفوع من 280 إلى 1800 ثانية (2026-07-20): قياس حقيقي أظهر أنّ دورة كاملة لـ61 بطولة
        // متتبَعة استغرقت 469 ثانية (تتجاوز 280) — قفل أقصر من زمن التنفيذ الفعلي يسمح بتداخل
        // دورتين، وهو بالضبط ما يُفترَض بالقفل منعه. الهامش هنا مبنيّ على توسّع النطاق لاحقًا
        // (130 بطولة متتبَعة بعد استيراد بطولات اليوم + البطولات العربية).
        $lock = Cache::lock(self::LOCK_KEY, 1800);
        if (! $lock->get()) {
            return 0; // تشغيل آخر جارٍ — تخطٍّ آمن
        }

        try {
            $competitions = Competition::query()->tracked()->get();
            if ($competitions->isEmpty()) {
                return 0;
            }

            $synced = 0;
            foreach ($competitions as $competition) {
                $fixtures = [
                    ...$this->client->fixturesByCompetition($competition->provider_id),
                    ...$this->client->resultsByCompetition($competition->provider_id),
                ];

                /** @var array<int,array<string,mixed>> $byGame */
                $byGame = [];
                foreach ($fixtures as $f) {
                    $byGame[$f['game_id']] = $f; // dedup بمعرّف المباراة (قد يتكرّر بين fixtures/results)
                }

                foreach ($byGame as $f) {
                    Fixture::updateOrCreate(
                        ['provider' => $competition->provider, 'provider_id' => $f['game_id']],
                        [
                            'competition_id' => $competition->id,
                            'home_name' => $f['home_name'] ?? '',
                            'home_logo' => $f['home_logo'],
                            'home_score' => $f['home_score'],
                            'away_name' => $f['away_name'] ?? '',
                            'away_logo' => $f['away_logo'],
                            'away_score' => $f['away_score'],
                            'status' => $f['status'],
                            'status_text' => $f['status_text'],
                            'kickoff_at' => $f['start_at'],
                        ],
                    );
                    $synced++;
                }

                // logo_url يُحدَّث فقط حين يملك المزوّد صورة فعليّة لهذه البطولة — لا يُفرَغ أبدًا
                // (لا نستبدل شعارًا مُدخَلًا يدويًّا أو مُزامَنًا سابقًا بـ null لمجرّد أنّ ردّ هذه
                // الدورة تحديدًا لم يتضمّن meta البطولة). idempotent: نفس imageVersion ⇒ نفس الرابط.
                $logoUrl = $this->client->competitionLogo($competition->provider_id);

                $competition->update([
                    'last_synced_at' => now(),
                    ...($logoUrl !== null ? ['logo_url' => $logoUrl] : []),
                ]);
            }

            return $synced;
        } finally {
            $lock->release();
        }
    }
}
