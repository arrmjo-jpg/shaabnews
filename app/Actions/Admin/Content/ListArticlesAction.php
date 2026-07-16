<?php

declare(strict_types=1);

namespace App\Actions\Admin\Content;

use App\Http\Resources\Admin\Content\ArticleResource;
use App\Models\Article;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * قائمة المقالات (لوحة الإدارة) — مرقّمة عبر QueryBuilder.
 *
 * Wave C2: لا كاش — قائمة إدارية متغيّرة وقابلة للفلترة، ولا قراءة عامة
 * في هذه الموجة. كاش القراءة العامة/الصفحة الرئيسية يأتي في موجاته.
 */
class ListArticlesAction
{
    public function handle(): JsonResponse
    {
        $default = (int) config('performance.pagination.default');
        $max = (int) config('performance.pagination.max');
        $perPage = max(1, min((int) request()->integer('per_page', $default), $max));
        $page = max(1, (int) request()->integer('page', 1));

        // نفس حماية الواجهة العامة (ListPublicArticlesAction): منع صفحات OFFSET عميقة جداً.
        // لا كاش هنا (قائمة إدارية متغيّرة)، لذا هذا هو خط الدفاع الوحيد ضد إساءة استخدام/طلب
        // عرضي بصفحة كبيرة على جدول من عشرات آلاف الصفوف.
        $maxPage = (int) config('performance.pagination.max_page', 100);
        if ($maxPage > 0 && $page > $maxPage) {
            abort(404, 'Page limit exceeded. Use filters to narrow the result set.');
        }

        // إذا كان هناك نص بحث، نستخدم Meilisearch لسرعة معالجة النصوص وحساب الترتيب بالصلة
        $searchTerm = request()->input('filter.title');
        if (filled($searchTerm)) {
            try {
                $search = Article::search(trim((string) $searchTerm));

                // 1. تصفية الفلاتر الأساسية مباشرة في Meilisearch لمطابقة سريعة
                if (request()->filled('filter.locale')) {
                    $search->where('locale', request()->input('filter.locale'));
                }
                if (request()->filled('filter.type')) {
                    $search->where('type', request()->input('filter.type'));
                }
                if (request()->filled('filter.status')) {
                    $search->where('status', request()->input('filter.status'));
                }
                if (request()->filled('filter.author_id')) {
                    $search->where('author_id', (int) request()->input('filter.author_id'));
                }
                if (request()->filled('filter.category')) {
                    $search->where('category_ids', (int) request()->input('filter.category'));
                }
                if (request()->filled('filter.primary_category_id')) {
                    $search->where('category_ids', (int) request()->input('filter.primary_category_id'));
                }

                // التعامل مع المحذوفات في Scout
                $trashed = (string) request()->query('trashed', '');
                if ($trashed === 'only') {
                    $search->onlyTrashed();
                } elseif ($trashed === 'with') {
                    $search->withTrashed();
                }

                // 2. تحميل الأعمدة والعلاقات المطلوبة ومنع الـ N+1 Queries
                $search->query(fn ($query) => $query->select([
                    'id',
                    'author_id',
                    'primary_category_id',
                    'type',
                    'status',
                    'locale',
                    'title',
                    'slug',
                    'is_featured',
                    'is_breaking',
                    'is_pinned',
                    'is_header',
                    'is_editor_pick',
                    'is_squares',
                    'published_at',
                    'created_at',
                    'deleted_at',
                ])->with([
                    'author:id,name',
                    'primaryCategory:id,name,slug',
                    'categories:id,name,slug',
                    'engagementCounter',
                ]));

                // 3. تنفيذ الـ pagination الأصلي الخاص بـ Scout (يحافظ على الترتيب بالصلة)
                $articles = $search->paginate($perPage)->appends(request()->query());

                return ApiResponse::success(
                    data: ArticleResource::collection($articles)->resolve(),
                    meta: [
                        'pagination' => [
                            'total' => $articles->total(),
                            'count' => $articles->count(),
                            'per_page' => $articles->perPage(),
                            'current_page' => $articles->currentPage(),
                            // يُقيَّد بـ maxPage حتى لا تعرض الواجهة رابط "آخر صفحة" يتجاوز
                            // ما يقبله الـ Backend فعلياً (الحماية أعلاه ترفض أي page > maxPage).
                            'total_pages' => $maxPage > 0 ? min($articles->lastPage(), $maxPage) : $articles->lastPage(),
                        ],
                    ]
                );
            } catch (\Throwable $e) {
                // تدهور رشيق (Graceful Degradation): تسجيل الخطأ والرجوع للبحث في قاعدة البيانات مباشرة في حال تعطل محرك البحث
                report($e);
            }
        }

        // تحسين أداء استعلام قائمة المقالات (لوحة الإدارة):
        // 1. لا تستخدم SELECT * لتجنب تحميل الأعمدة الضخمة مثل content وcontent_json
        //    مما يقلل حجم Payload بمعدل 13 ضعفاً (من 366KB إلى 28KB لـ 15 مقال).
        // 2. لا يوجد Index Hint هنا عمداً: كان هناك USE INDEX(articles_deleted_published_desc_idx)
        //    مربوطاً بشرط "$sort === '-published_at'"، لكن الترتيب الافتراضي الفعلي هو
        //    defaultSort('-created_at') أدناه — فالـ Hint كان يفرض فهرساً مرتَّباً بعمود مختلف
        //    عن عمود الترتيب الحقيقي، فيضطر MySQL لعمل Filesort كامل على كل الجدول في كل تحميل
        //    (قُيس فعلياً: 5.6s معه مقابل 1.84ms بإزالته تماماً، عبر EXPLAIN ANALYZE على البيانات
        //    الحقيقية، مع فحص created_at/published_at/id/title وفلاتر status/author/category —
        //    المُحسِّن يختار خطة صحيحة في كل الحالات الشائعة بلا أي تدخل). إجبار المحسّن استثناء
        //    يُلجأ إليه فقط بدليل أداء موثّق، لا افتراضاً.
        $query = QueryBuilder::for(Article::class);

        $query->select([
            'id',
            'author_id',
            'primary_category_id',
            'type',
            'status',
            'locale',
            'title',
            'slug',
            'is_featured',
            'is_breaking',
            'is_pinned',
            'is_header',
            'is_editor_pick',
            'is_squares',
            'published_at',
            'created_at',
            'deleted_at',
        ])
            ->with([
                'author:id,name',
                'primaryCategory:id,name,slug',
                'categories:id,name,slug',
                'engagementCounter',
            ])
            ->allowedFilters(
                AllowedFilter::exact('type'),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('locale'),
                AllowedFilter::exact('primary_category_id'),
                AllowedFilter::exact('author_id'),
                // فلتر القسم الموحّد: يطابق المقال إن كان القسم رئيسياً أو ثانوياً
                // (pivot) — فالخبر متعدّد الأقسام يظهر تحت كل أقسامه، لا الرئيسي فقط.
                AllowedFilter::callback('category', function ($query, $value): void {
                    $query->where(function ($q) use ($value): void {
                        $q->where('primary_category_id', $value)
                            ->orWhereHas('categories', fn ($c) => $c->where('categories.id', $value));
                    });
                }),
                AllowedFilter::exact('is_featured'),
                AllowedFilter::exact('is_breaking'),
                AllowedFilter::exact('is_pinned'),
                AllowedFilter::exact('is_header'),
                AllowedFilter::exact('is_editor_pick'),
                AllowedFilter::exact('is_squares'),
                // بحث العنوان عبر FULLTEXT (ngram) على MySQL — مفهرس، لا مسح كامل.
                // fallback إلى LIKE على محرّكات بلا FULLTEXT (SQLite في الاختبارات).
                AllowedFilter::callback('title', function ($query, $value): void {
                    $term = trim((string) $value);
                    if ($term === '') {
                        return;
                    }
                    if (DB::connection()->getDriverName() === 'mysql') {
                        $query->whereFullText('title', $term);
                    } else {
                        $query->where('title', 'like', '%'.$term.'%');
                    }
                }),
            )
            ->allowedSorts('id', 'title', 'created_at', 'published_at')
            ->defaultSort('-created_at');

        // عرض المحذوفات: only=المحذوفة فقط، with=الكل (تشمل المحذوف).
        $trashed = (string) request()->query('trashed', '');
        if ($trashed === 'only') {
            $query->onlyTrashed();
        } elseif ($trashed === 'with') {
            $query->withTrashed();
        }

        $articles = $query->paginate($perPage)->appends(request()->query());

        return ApiResponse::success(
            data: ArticleResource::collection($articles)->resolve(),
            meta: [
                'pagination' => [
                    'total' => $articles->total(),
                    'count' => $articles->count(),
                    'per_page' => $articles->perPage(),
                    'current_page' => $articles->currentPage(),
                    'total_pages' => $maxPage > 0 ? min($articles->lastPage(), $maxPage) : $articles->lastPage(),
                ],
            ]
        );
    }
}
