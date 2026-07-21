<?php

declare(strict_types=1);

namespace App\Support\Sport;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * عميل 365 الخادميّ (قراءة عامّة بلا توكن) — مصدر مواعيد المباريات لمرآة `sport_fixtures` (نظام إشعارات «تابع»).
 * نمط المشروع: Http facade مضبوط المهلة، try/catch، يعيد بيانات منظَّمة بلا استثناءات (مهمّة المزامنة تتابع عند الفشل).
 * كلّ مباراة تُطبَّع إلى مصفوفة موحَّدة: game_id/competition_id/season_num/الفريقان(id+name)/start_at/status.
 */
final class Sport365Client
{
    /** الدول العربية بمعرّفات 365Scores الثابتة (مصدر: web/competitions/?sports=1 ⇒ countries[]). */
    private const ARAB_COUNTRY_IDS = [
        122, // السعودية
        131, // مصر
        119, // الأردن
        123, // لبنان
        114, // العراق
        126, // الكويت
        115, // قطر
        124, // الإمارات
        116, // البحرين
        117, // عمان
        127, // المغرب
        139, // الجزائر
        135, // تونس
        161, // ليبيا
        125, // سوريا
        226, // فلسطين
        130, // السودان
        170, // اليمن
    ];

    /**
     * meta بطولات تراكميّ (imageVersion/countryId) من مصفوفة `competitions[]` — موجودة أصلًا بكلّ
     * استجابات `games/*` بجانب `games[]`، مُتجاهَلة سابقًا. تُملأ انتهازيًّا داخل get() من أيّ نداء
     * (fixtures/results) بلا أيّ طلب HTTP إضافي؛ عمر الذاكرة = عمر الكائن (طلب/دورة مزامنة واحدة).
     *
     * @var array<int,array{image_version:int|null,country_id:int|null}>
     */
    private array $competitionMeta = [];

    /** مواعيد بطولة (كلّ مبارياتها القادمة) — `web/games/fixtures/?competitions={id}`. */
    public function fixturesByCompetition(int $competitionId): array
    {
        return $this->fixturesFrom($this->get('games/fixtures/', ['competitions' => $competitionId]));
    }

    /**
     * بطولات صاحبة مباريات اليوم — **نفس** `web/games/allscores/?sports={id}` الذي يستدعيه الفرونت
     * إند العام حرفيًّا لصفحة المباريات (frontend/src/lib/sport/games.ts: fetchAllScores/getCompetitions)
     * — مصدر واحد لا مصدر ثانٍ، بعكس كتالوج `web/competitions/` المرفوض (يشمل مئات البطولات
     * الخاملة/خارج الموسم). القائمة تتغيّر يوميًّا بتغيّر جدول المباريات، تمامًا كما تراها صفحة
     * المباريات العامة كل يوم.
     *
     * @return array<int,array{id:int,name:string}>
     */
    public function todaysCompetitions(int $sportId = 1): array
    {
        $json = $this->get('games/allscores/', ['sports' => $sportId]);
        $competitions = is_array($json['competitions'] ?? null) ? $json['competitions'] : [];

        $out = [];
        foreach ($competitions as $c) {
            if (! is_array($c) || ! isset($c['id'], $c['name'])) {
                continue;
            }
            $out[] = ['id' => (int) $c['id'], 'name' => (string) $c['name']];
        }

        return $out;
    }

    /**
     * كل بطولات كرة القدم لدول عربية معروفة عند 365Scores — بعكس todaysCompetitions() لا تُحصَر
     * بمباريات اليوم (أغلب الدوريات العربية بعطلة صيفية بهذا التاريخ فلا تظهر بذاك المصدر رغم
     * كونها حقيقية ومستخدَمة بأماكن أخرى بالموقع العام، كقائمة الهدّافين). كتالوج **مُقيَّد بالدول**
     * لا كتالوج عالميّ (بعكس الكتالوج الكامل المرفوض سابقًا — 804 بطولة أغلبها بلا صلة).
     *
     * @return array<int,array{id:int,name:string}>
     */
    public function arabCompetitions(int $sportId = 1): array
    {
        $json = $this->get('competitions/', ['sports' => $sportId]);
        $competitions = is_array($json['competitions'] ?? null) ? $json['competitions'] : [];

        $out = [];
        foreach ($competitions as $c) {
            if (! is_array($c) || ! isset($c['id'], $c['name'], $c['countryId'])) {
                continue;
            }
            if (! in_array((int) $c['countryId'], self::ARAB_COUNTRY_IDS, true)) {
                continue;
            }
            $out[] = ['id' => (int) $c['id'], 'name' => (string) $c['name']];
        }

        return $out;
    }

    /**
     * أرشيف نتائج بطولة كاملًا (لا آخر صفحة فقط) — `web/games/results/` ثمّ يمشي رجوعًا عبر
     * `paging.previousPage` (aftergame/direction=-1) حتى نفاد الصفحات أو بلوغ $maxPages (سقف أمان
     * يمنع حلقة لا نهائيّة ضدّ خدمة خارجيّة؛ 8×25≈200 مباراة يفوق أكبر بطولة واقعيّة).
     */
    public function resultsByCompetition(int $competitionId, int $maxPages = 8): array
    {
        $page = $this->get('games/results/', ['competitions' => $competitionId]);
        $all = $this->fixturesFrom($page);

        $previousPage = $this->pagingUrl($page, 'previousPage');
        for ($i = 1; $i < $maxPages && $previousPage !== null; $i++) {
            $afterGame = $this->queryParam($previousPage, 'aftergame');
            if ($afterGame === null) {
                break;
            }

            $page = $this->get('games/', ['competitions' => $competitionId, 'aftergame' => $afterGame, 'direction' => -1]);
            $games = $this->fixturesFrom($page);
            if ($games === []) {
                break;
            }

            $all = [...$all, ...$games];
            $previousPage = $this->pagingUrl($page, 'previousPage');
        }

        return $all;
    }

    /** مواعيد فريق — `web/games/fixtures/?competitors={teamId}`. */
    public function fixturesByTeam(int $teamId): array
    {
        return $this->fixturesFrom($this->get('games/fixtures/', ['competitors' => $teamId]));
    }

    /** مباراة مفردة (لمتابعة مباراة بعينها) — `web/game/?gameId={id}`. null إن لم تُحلَّ. */
    public function gameById(int $gameId): ?array
    {
        $json = $this->get('game/', ['gameId' => $gameId]);
        $game = is_array($json['game'] ?? null) ? $json['game'] : null;

        return $game ? $this->normalizeGame($game) : null;
    }

    /**
     * لقطة مباراة للاستطلاع الحيّ (الكتلة C) — `web/game/?gameId={id}`: الحالة المُطبَّعة + أحداثها. كلّ حدث يحمل
     * **مفتاح منع تكرار مُركَّبًا ثابتًا** (مستقلّ عن order/num ⇒ إعادة الترتيب لا تُغيّره):
     *   event:{gameId}-{eventTypeId}-{subTypeId}-{gameTime}-{addedTime}-{playerId}-{competitorId}  (كلّ null→0).
     * اسم اللاعب من `members`. null إن لم تُحلَّ المباراة.
     *
     * @return array{status:string, events:array<int,array<string,mixed>>}|null
     */
    public function gameSnapshot(int $gameId): ?array
    {
        $json = $this->get('game/', ['gameId' => $gameId]);
        $game = is_array($json['game'] ?? null) ? $json['game'] : null;
        if ($game === null) {
            return null;
        }

        $members = [];
        foreach ((is_array($game['members'] ?? null) ? $game['members'] : []) as $m) {
            if (is_array($m) && isset($m['id'])) {
                $members[(int) $m['id']] = (string) ($m['shortName'] ?? $m['name'] ?? '');
            }
        }

        $events = [];
        foreach ((is_array($game['events'] ?? null) ? $game['events'] : []) as $e) {
            if (! is_array($e)) {
                continue;
            }
            $type = is_array($e['eventType'] ?? null) ? $e['eventType'] : [];
            $typeId = (int) ($type['id'] ?? 0);
            $subTypeId = (int) ($type['subTypeId'] ?? 0);
            $gameTime = (int) ($e['gameTime'] ?? 0);
            $addedTime = (int) ($e['addedTime'] ?? 0);
            $playerId = (int) ($e['playerId'] ?? 0);
            $teamId = (int) ($e['competitorId'] ?? 0);

            $events[] = [
                // المفتاح المُركَّب (null مُطبَّعة إلى 0 عبر الـ cast أعلاه) — أساس منع التكرار.
                'dedup_key' => sprintf('event:%d-%d-%d-%d-%d-%d-%d', $gameId, $typeId, $subTypeId, $gameTime, $addedTime, $playerId, $teamId),
                'event_type_id' => $typeId,
                'label' => (string) ($type['subTypeName'] ?? $type['name'] ?? ''),
                'minute' => (string) ($e['gameTimeDisplay'] ?? ($gameTime > 0 ? "{$gameTime}'" : '')),
                'player_id' => $playerId,
                'player_name' => $members[$playerId] ?? null,
                'team_id' => $teamId,
            ];
        }

        return [
            'status' => $this->normalizeStatus((int) ($game['statusGroup'] ?? 0)),
            'events' => $events,
        ];
    }

    /**
     * فِرَق اللاعب (نادٍ/منتخب) — لتحويل متابعة لاعب إلى مواعيد فريقه — `web/athletes/?athletes={id}`.
     *
     * @return array<int,int> معرّفات الفِرَق
     */
    public function teamIdsForPlayer(int $athleteId): array
    {
        $json = $this->get('athletes/', ['athletes' => $athleteId]);
        $competitors = is_array($json['competitors'] ?? null) ? $json['competitors'] : [];

        return array_values(array_filter(array_map(
            static fn ($c): ?int => is_array($c) && isset($c['id']) ? (int) $c['id'] : null,
            $competitors,
        )));
    }

    /** نداء GET عامّ لـ365 (مع المعاملات المشتركة) — يعيد مصفوفة JSON أو [] عند أيّ فشل. */
    private function get(string $path, array $params): array
    {
        $base = rtrim((string) config('sport.api_base'), '/');
        $common = $this->commonParams();

        try {
            $response = Http::acceptJson()
                ->timeout((int) config('sport.http_timeout', 8))
                ->get("{$base}/{$path}", $common + $params);
        } catch (Throwable) {
            return [];
        }

        if (! $response->successful()) {
            return [];
        }

        $json = $response->json();
        $json = is_array($json) ? $json : [];

        $this->collectCompetitionMeta($json);

        return $json;
    }

    /** يلتقط `competitions[].{imageVersion,countryId}` إن وُجدت بهذا الرد — انتهازيّ، بلا فرض. */
    private function collectCompetitionMeta(array $json): void
    {
        $competitions = is_array($json['competitions'] ?? null) ? $json['competitions'] : [];
        foreach ($competitions as $c) {
            if (! is_array($c) || ! isset($c['id'])) {
                continue;
            }
            $this->competitionMeta[(int) $c['id']] = [
                'image_version' => isset($c['imageVersion']) ? (int) $c['imageVersion'] : null,
                'country_id' => isset($c['countryId']) ? (int) $c['countryId'] : null,
            ];
        }
    }

    /** @return array<string,int|string> */
    private function commonParams(): array
    {
        parse_str((string) config('sport.api_common'), $parsed);

        return $parsed;
    }

    /** رابط تنقّل من `paging.{key}` إن وُجد سلسلة نصّيّة. */
    private function pagingUrl(array $json, string $key): ?string
    {
        $paging = is_array($json['paging'] ?? null) ? $json['paging'] : [];
        $url = $paging[$key] ?? null;

        return is_string($url) && $url !== '' ? $url : null;
    }

    /** يستخرج معامل استعلام من رابط تنقّل نسبيّ (مثل `aftergame` من previousPage). */
    private function queryParam(string $url, string $name): ?int
    {
        $query = (string) (parse_url($url, PHP_URL_QUERY) ?? '');
        parse_str($query, $parsed);

        return isset($parsed[$name]) && is_numeric($parsed[$name]) ? (int) $parsed[$name] : null;
    }

    /** يطبّع مصفوفة `games` إلى مواعيد موحَّدة (يتجاهل ما لا معرّف له). */
    private function fixturesFrom(array $json): array
    {
        $games = is_array($json['games'] ?? null) ? $json['games'] : [];
        $out = [];
        foreach ($games as $g) {
            if (! is_array($g)) {
                continue;
            }
            $fixture = $this->normalizeGame($g);
            if ($fixture !== null) {
                $out[] = $fixture;
            }
        }

        return $out;
    }

    /** يطبّع مباراة 365 واحدة. null إن لا معرّف. */
    private function normalizeGame(array $g): ?array
    {
        $gameId = isset($g['id']) ? (int) $g['id'] : 0;
        if ($gameId <= 0) {
            return null;
        }
        $home = is_array($g['homeCompetitor'] ?? null) ? $g['homeCompetitor'] : [];
        $away = is_array($g['awayCompetitor'] ?? null) ? $g['awayCompetitor'] : [];

        return [
            'game_id' => $gameId,
            'competition_id' => isset($g['competitionId']) ? (int) $g['competitionId'] : 0,
            'season_num' => isset($g['seasonNum']) ? (int) $g['seasonNum'] : null,
            'home_team_id' => isset($home['id']) ? (int) $home['id'] : null,
            'home_name' => isset($home['name']) ? (string) $home['name'] : null,
            'home_logo' => $this->competitorLogo($home),
            'home_score' => $this->competitorScore($home),
            'away_team_id' => isset($away['id']) ? (int) $away['id'] : null,
            'away_name' => isset($away['name']) ? (string) $away['name'] : null,
            'away_logo' => $this->competitorLogo($away),
            'away_score' => $this->competitorScore($away),
            'start_at' => $this->parseTime($g['startTime'] ?? null),
            'status' => $this->normalizeStatus(isset($g['statusGroup']) ? (int) $g['statusGroup'] : 0),
            'status_text' => isset($g['statusText']) ? (string) $g['statusText'] : null,
        ];
    }

    /** شعار متنافس (فريق/منتخب) — نمط 365 الموحَّد لكلّ صور الكيانات. null بلا imageVersion. */
    private function competitorLogo(array $competitor): ?string
    {
        $id = isset($competitor['id']) ? (int) $competitor['id'] : 0;
        $version = $competitor['imageVersion'] ?? null;
        if ($id <= 0 || $version === null) {
            return null;
        }

        return sprintf(
            'https://imagecache.365scores.com/image/upload/f_png,w_64,h_64,c_limit,q_auto:eco,dpr_2,d_Competitors:default1.png/v%d/Competitors/%d',
            (int) $version,
            $id,
        );
    }

    /**
     * شعار بطولة — نفس صيغة الفرونت إند العام حرفيًّا (frontend/src/lib/sport/games.ts:101-105)،
     * مبنيّ من meta التُقطت سابقًا بهذا الكائن (راجع collectCompetitionMeta) — لا نداء HTTP هنا.
     * null إن لم تُشاهَد هذه البطولة بأيّ رد بعد، أو بلا imageVersion (لا صورة عند المزوّد).
     * الفشل الرمزيّ (علم دولة مستدير) عند غياب countryId — نفس اختيار الفرونت إند بالضبط.
     */
    public function competitionLogo(int $competitionId): ?string
    {
        $meta = $this->competitionMeta[$competitionId] ?? null;
        if ($meta === null || $meta['image_version'] === null) {
            return null;
        }

        $fallback = $meta['country_id'] !== null ? "Countries:Round:{$meta['country_id']}" : 'Competitions:default1';

        return sprintf(
            'https://imagecache.365scores.com/image/upload/f_png,w_48,h_48,c_limit,q_auto:eco,dpr_2,d_%s.png/v%d/Competitions/%d',
            $fallback,
            $meta['image_version'],
            $competitionId,
        );
    }

    /** نتيجة متنافس — سالب/غائب يُطبَّع إلى null (لم تبدأ المباراة بعد). */
    private function competitorScore(array $competitor): ?int
    {
        $score = $competitor['score'] ?? null;

        return is_numeric($score) && (int) $score >= 0 ? (int) $score : null;
    }

    private function parseTime(mixed $iso): ?Carbon
    {
        if (! is_string($iso) || $iso === '') {
            return null;
        }
        try {
            return Carbon::parse($iso);
        } catch (Throwable) {
            return null;
        }
    }

    /** statusGroup 365 → حالة مُطبَّعة. 3=جارية، ≥4=منتهية، غير ذلك=مجدولة. */
    private function normalizeStatus(int $statusGroup): string
    {
        return match (true) {
            $statusGroup === 3 => 'live',
            $statusGroup >= 4 => 'finished',
            default => 'scheduled',
        };
    }
}
