<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public\Content;

use App\Actions\Public\Content\ListPublicArticlesAction;
use App\Actions\Public\Content\ShowPublicWriterAction;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * مقالات كاتب عامّ منشورة — `GET /{locale}/writers/{id}/articles`.
 *
 * Wrapper رقيق فقط: يعيد استخدام بوّابة ShowPublicWriterAction (is_writer نشِط ⇒ وإلا 404،
 * بلا استعلام مكرَّر)، ثم يثبّت filter.author_id على نفس الـ Request المشترك ويُفوِّض كاملاً
 * إلى ListPublicArticlesAction — لا منطق ترقيم/فرز/بحث/كاش مكرَّر (author_id مدعوم أصلاً عبر
 * AllowedFilter::exact('author_id')). معرِّف المسار {id} يفوز دوماً على أي filter[author_id]
 * قد يرسله العميل بالخطأ في الاستعلام.
 */
class WriterArticlesController extends Controller
{
    public function index(Request $request, string $locale, int $id): JsonResponse
    {
        $writerCheck = (new ShowPublicWriterAction)->handle($id);
        if ($writerCheck->getStatusCode() === 404) {
            return $writerCheck;
        }

        $filters = $request->query('filter', []);
        $filters['author_id'] = (string) $id;
        $request->merge(['filter' => $filters]);

        return (new ListPublicArticlesAction)->handle($locale, $request);
    }
}
