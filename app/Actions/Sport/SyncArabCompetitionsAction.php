<?php

declare(strict_types=1);

namespace App\Actions\Sport;

use App\Models\Competition;
use App\Support\Sport\Sport365Client;

/**
 * يُعرِّف Competition لكلّ بطولة كرة قدم عربية معروفة عند 365Scores (Sport365Client::arabCompetitions)
 * — بعكس SyncMatchesFeedCompetitionsAction لا يُحصَر بمباريات اليوم، لأنّ أغلب الدوريات العربية
 * بعطلة صيفية بهذا التاريخ فما كانت لتظهر إطلاقًا رغم وجودها الحقيقي (طلب المستخدم 2026-07-20 بعد
 * ملاحظة أنها موجودة بأماكن أخرى بالموقع العام كقائمة الهدّافين، رغم غيابها عن "مباريات اليوم").
 * نفس نمط الحماية والملكيّة تمامًا: بطولة جديدة ⇒ is_tracked=true (قرار "الكل يحدث لحاله" السابق)
 * و show_in_match_bar=false دائمًا؛ بطولة موجودة أصلًا يُحدَّث اسمها وشعارها فقط، لا تُلمَس أعلامها.
 */
final class SyncArabCompetitionsAction
{
    private const PROVIDER = '365scores';

    public function __construct(private readonly Sport365Client $client) {}

    public function handle(): int
    {
        $competitions = $this->client->arabCompetitions();

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
