<?php

declare(strict_types=1);

namespace App\Actions\Sport;

use App\Models\Competition;
use App\Support\Sport\Sport365Client;

/**
 * يُعرِّف Competition لكلّ بطولة تظهر بصفحة المباريات العامة اليوم — **نفس مصدر** صفحة المباريات
 * بالضبط (Sport365Client::todaysCompetitions ⇒ نفس games/allscores/?sports=1 الذي يستدعيه
 * frontend/src/lib/sport/games.ts)، لا كتالوج منفصل. الهدف: تعبئة لوحة اختيار شريط المباريات
 * بنفس ما يراه الزائر فعليًّا، ومزامنة تغطيتها تلقائيًّا بلا تدخّل يدويّ (قرار المستخدم الصريح
 * 2026-07-20: "بدي الكل يحدث لحاله زي الموقع الرياضي").
 *
 * بطولة **جديدة** تُنشَأ بـ is_tracked=true تلقائيًّا (SyncTrackedCompetitionFixturesAction
 * كل دقيقة رح تلتقطها بالدورة التالية) لكن show_in_match_bar=false دائمًا — التتبّع تلقائيّ،
 * الظهور بشريط المباريات العام يبقى قرار المُشرِف الصريح حصرًا (لم يتغيّر هذا الفصل). بطولة
 * موجودة أصلًا يُحدَّث اسمها وشعارها فقط؛ show_in_match_bar/match_bar_sort_order مملوكة
 * للمُشرِف ولا تُلمَس هنا. تنبيه أداء موثَّق: تتبّع عشرات البطولات يُبطئ فعليًّا وتيرة
 * SyncTrackedCompetitionFixturesAction من "كل دقيقة" إلى دورة أطول (قياس حقيقي: ~3.9 ثانية
 * لكل بطولة متتبَعة) بسبب القفل الموزّع الذي يمنع التداخل — تدهور تدريجي مقصود، لا عطل.
 */
final class SyncMatchesFeedCompetitionsAction
{
    private const PROVIDER = '365scores';

    public function __construct(private readonly Sport365Client $client) {}

    public function handle(): int
    {
        $competitions = $this->client->todaysCompetitions();

        $count = 0;
        foreach ($competitions as $c) {
            $competition = Competition::firstOrNew(['provider' => self::PROVIDER, 'provider_id' => $c['id']]);
            $isNew = ! $competition->exists;

            $competition->name = $c['name'];

            $logoUrl = $this->client->competitionLogo($c['id']);
            if ($logoUrl !== null) {
                $competition->logo_url = $logoUrl;
            }

            if ($isNew) {
                $competition->is_tracked = true;
                $competition->show_in_match_bar = false;
            }

            $competition->save();
            $count++;
        }

        return $count;
    }
}
