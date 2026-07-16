<?php

declare(strict_types=1);

namespace App\Support\Vertix;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;

/**
 * قارئ مصدر Vertix (قراءة فقط). الأخبار المؤهَّلة = status=1 ∧ deleteflag=0.
 * الأقسام تُقرأ كلّها (deleteflag غير موثوق؛ الحالة تُشتقّ من status). تعداد الأخبار
 * بالمفتاح التتابعيّ (keyset على newsid) — لا حلقات عملاقة على 217k+ صفّ.
 */
final class VertixSource
{
    public function __construct(private readonly Connection $db) {}

    public static function make(): self
    {
        return new self(VertixConnection::db());
    }

    // ─── Categories ──────────────────────────────────────────────────────────

    public function categoriesCount(): int
    {
        return (int) $this->db->table('art_categories')->count();
    }

    /** كلّ الأقسام مرتّبة بالأب قبل الابن (ord ثمّ catid) — للترتيب الطوبولوجيّ. */
    public function categories(): array
    {
        return $this->db->table('art_categories')
            ->orderBy('catid')
            ->get(['catid', 'parentid', 'title', 'seo_name', 'lang', 'status'])
            ->all();
    }

    // ─── News ────────────────────────────────────────────────────────────────

    public function newsCount(): int
    {
        return (int) $this->eligibleNews()->count();
    }

    /** أعلى newsid مؤهَّل (سقف الردم التنازليّ وأساس كشف الجديد). */
    public function maxNewsId(): int
    {
        return (int) $this->eligibleNews()->max('newsid');
    }

    /** الأخبار الأحدث من العلامة العليا (تنازليّ) — المُضاف لاحقاً، الأحدث أولاً. */
    public function newsAbove(int $highWater, int $limit): array
    {
        return $this->newsSelect($this->eligibleNews()->where('newsid', '>', $highWater), $limit);
    }

    /** الأخبار الأقدم من المؤشّر (تنازليّ) — ردم تاريخيّ من الأحدث للأقدم. */
    public function newsBelow(int $below, int $limit): array
    {
        return $this->newsSelect($this->eligibleNews()->where('newsid', '<', $below), $limit);
    }

    /**
     * الأخبار المؤهَّلة التي قسمها (catid) ليس ضمن المعرّفات الصالحة — «أيتام القسم»
     * (تلك التي تفشل بـcategory_missing). keyset تنازليّ لاسترجاعها وإسنادها قسماً احتياطيّاً.
     *
     * @param  array<int,int>  $validCatids
     * @return array<int,object>
     */
    public function newsMissingCategoryBelow(array $validCatids, int $below, int $limit): array
    {
        $q = $this->eligibleNews()->where('newsid', '<', $below);
        if ($validCatids !== []) {
            $q->whereNotIn('catid', $validCatids);
        }

        return $this->newsSelect($q, $limit);
    }

    /**
     * صفوف المصدر بمعرّفاتها (newsid) — لردم بيانات لاحقة (غلاف/متن) لأخبار مُستورَدة سابقاً.
     *
     * @param  array<int,int>  $ids
     * @return array<int,object>
     */
    public function newsByIds(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return $this->eligibleNews()->whereIn('newsid', $ids)
            ->get([
                'newsid', 'catid', 'title', 'link', 'brief', 'body', 'keywords',
                'ph_name', 'folder', 'createdate', 'updatedate_int', 'lang', 'views',
            ])
            ->all();
    }

    private function newsSelect(Builder $q, int $limit): array
    {
        return $q->orderByDesc('newsid')
            ->limit($limit)
            ->get([
                'newsid', 'catid', 'title', 'link', 'brief', 'body', 'keywords',
                'ph_name', 'folder', 'createdate', 'updatedate_int', 'lang', 'views',
            ])
            ->all();
    }

    private function eligibleNews(): Builder
    {
        return $this->db->table('art_news')->where('status', 1)->where('deleteflag', 0);
    }
}
