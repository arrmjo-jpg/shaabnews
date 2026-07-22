<?php

declare(strict_types=1);

namespace App\Events\Content;

use App\Enums\ArticleStatus;
use App\Models\Article;
use App\Models\User;

/**
 * يُصدَر بعد commit ناجح لانتقال حالة مقال (TransitionArticleStatusAction) —
 * أوّل حدث نطاقيّ في المنصّة (ADR-E2). يُغلِّف الآثار الجانبية القائمة
 * (إبطال كاش/CDN/إشعار الكاتب) بلا تغيير توقيتها أو تسلسلها: نفس السلوك
 * تماماً، فقط منقول لمستمعين متزامنين بدل نداءات أمريّة مباشرة.
 *
 * مستمعوه (app/Listeners/Content) متزامنون عمداً — لا يُحوَّلون لطابور دون
 * قرار معماريّ صريح جديد، لأنّ ذلك يغيّر توقيت الاستجابة الملحوظ (السلوك
 * الحاليّ: الاستجابة لا تُعاد إلا بعد اكتمال الإبطال/الإشعار).
 *
 * $oldPath (2026-07-18): المسار القانوني قبل الانتقال — الرابط الجديد
 * /news/dd/mm/yyyy/{id}/ يُضمِّن published_at، فتغيير الجدولة (draft→scheduled
 * بتاريخ جديد) يُغيِّر المسار القانوني رغم ثبات id. يُستهلَك في
 * PurgeArticleCdnOnStatusChanged لتمريره إلى ArticleCdnPurge::purge()، مرآةً
 * لنمط UpdateArticleAction القائم (ADR A4).
 */
final class ArticleStatusChanged
{
    public function __construct(
        public readonly Article $article,
        public readonly ArticleStatus $from,
        public readonly ArticleStatus $to,
        public readonly User $actor,
        public readonly ?string $oldPath = null,
    ) {}
}
