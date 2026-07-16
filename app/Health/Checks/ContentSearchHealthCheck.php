<?php

declare(strict_types=1);

namespace App\Health\Checks;

use Meilisearch\Client;
use Meilisearch\Exceptions\ApiException;
use Spatie\Health\Checks\Check;
use Spatie\Health\Checks\Result;
use Throwable;

/**
 * محرّك مشترك لصحّة فهرس بحث نوع محتوى واحد (Meilisearch) — يقارن عدد وثائق
 * الفهرس بعدد صفوف القاعدة التي يجب أن تكون مفهرَسة (حسب shouldBeSearchable()
 * الفعليّ لكل نوع، لا افتراضاً موحَّداً). نمط مطابق لِـ CacheTagScheme/
 * EditorialWorkflowGuard: منطق مشترك واحد + بيانات نوعيّة عبر الأصناف الفرعية،
 * لا نسخ الفحص أربع مرّات.
 *
 * ثلاث حالات:
 *  - Meilisearch غير المحرّك الفعّال ⇒ ok (القراءة من القاعدة مباشرة، لا فهرس لمراقبته).
 *  - تعذّر الوصول للمحرّك ⇒ failed (بحث هذا النوع متدهور).
 *  - انحراف العدّ (فهرس مقابل قاعدة) ضمن حدّين مُهيّأين: تحذير > تحذير%، فشل > فشل%
 *    أو فهرس فارغ بينما القاعدة تتوقّع صفوفاً — الأخير يعني فهرساً مفقوداً/غير مبنيّ.
 */
abstract class ContentSearchHealthCheck extends Check
{
    /** اسم فهرس Meilisearch لهذا النوع (searchableAs() الفعليّ في النموذج). */
    abstract protected function indexName(): string;

    /** عدد صفوف القاعدة التي يجب أن تكون مفهرَسة الآن — يطابق shouldBeSearchable() الفعليّ. */
    abstract protected function expectedSearchableCount(): int;

    /** الأمر الذي يُصلح الانحراف — يظهر في رسالة الفشل/التحذير. */
    abstract protected function recoveryCommandHint(): string;

    /** واجهة عامّة لـ expectedSearchableCount() للاختبار المباشر بلا محرّك بحث. */
    public function publicExpectedCount(): int
    {
        return $this->expectedSearchableCount();
    }

    /** نسبة الانحراف (٪) التي تتحوّل عندها الحالة إلى تحذير. */
    protected function warningDriftPercent(): float
    {
        return (float) config('performance.search.health_warning_drift_percent', 10.0);
    }

    /** نسبة الانحراف (٪) التي تتحوّل عندها الحالة إلى فشل. */
    protected function failureDriftPercent(): float
    {
        return (float) config('performance.search.health_failure_drift_percent', 30.0);
    }

    public function run(): Result
    {
        if (config('scout.driver') !== 'meilisearch') {
            return Result::make()->ok('Scout driver is not Meilisearch — nothing to index-check.');
        }

        $index = $this->indexName();

        try {
            $client = new Client(
                (string) config('scout.meilisearch.host'),
                config('scout.meilisearch.key'),
            );
            $docs = (int) ($client->index($index)->stats()['numberOfDocuments'] ?? 0);
        } catch (ApiException $e) {
            if ($e->errorCode !== 'index_not_found') {
                return Result::make()->failed("Meilisearch error on {$index}: ".$e->getMessage());
            }
            $docs = 0; // الفهرس غير موجود بعد — يُقارَن بالمتوقَّع أدناه كأيّ انحراف آخر
        } catch (Throwable $e) {
            return Result::make()->failed("Meilisearch unreachable for {$index}: ".$e->getMessage());
        }

        return $this->evaluateDrift($index, $docs, max(0, $this->expectedSearchableCount()));
    }

    /**
     * يقارن عدد الوثائق المفهرَسة بالمتوقَّع ويقرّر الحالة — معزولة عن نداء
     * Meilisearch الحيّ عمداً كي تُختبَر بأعداد صريحة دون الحاجة لمحرّك بحث حقيقيّ.
     * عامّة (public) خصّيصاً لهذا الغرض الاختباريّ.
     */
    public function evaluateDrift(string $index, int $docs, int $expected): Result
    {
        $drift = $expected > 0 ? abs($expected - $docs) / $expected * 100 : ($docs > 0 ? 100.0 : 0.0);

        $result = Result::make()->meta([
            'index' => $index,
            'indexed_documents' => $docs,
            'expected_documents' => $expected,
            'drift_percent' => round($drift, 1),
        ])->shortSummary("{$docs}/{$expected} indexed");

        if ($expected > 0 && $docs === 0) {
            return $result->failed(
                "{$index} is empty while {$expected} row(s) should be indexed — index likely lost or never built. Recover: {$this->recoveryCommandHint()}"
            );
        }

        if ($drift >= $this->failureDriftPercent()) {
            return $result->failed(
                sprintf('%s drift is %.1f%% (%d indexed vs %d expected) — recover: %s', $index, $drift, $docs, $expected, $this->recoveryCommandHint())
            );
        }

        if ($drift >= $this->warningDriftPercent()) {
            return $result->warning(
                sprintf('%s drift is %.1f%% (%d indexed vs %d expected) — watch, recover if it keeps growing: %s', $index, $drift, $docs, $expected, $this->recoveryCommandHint())
            );
        }

        return $result->ok("{$index} in sync ({$docs} documents, {$drift}% drift).");
    }
}
