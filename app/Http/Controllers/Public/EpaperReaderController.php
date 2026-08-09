<?php

declare(strict_types=1);

namespace App\Http\Controllers\Public;

use App\Enums\EpaperAccessLevel;
use App\Http\Controllers\Controller;
use App\Models\Epaper;
use App\Settings\NewspaperSettings;
use App\Support\Content\EpaperSeoBuilder;
use App\Support\Epaper\EpaperAccessPolicy;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;

/**
 * السطح العام للجريدة الرقمية — صفحات SSR بـ Blade (لا SPA). يستهلك سكوب النموذج
 * published()‏ ولا يُعيد اشتقاق الرؤية. النطاق مسبوق باللغة (/{locale}/epaper) ومحميّ
 * ببوابة الوحدة (newspaper.enabled) فالوحدة المعطَّلة = 404. القارئ نفسه (PDF.js) يُروى
 * تدريجياً في 2ب من data-attributes؛ هنا الغلاف الخادميّ + بذرة تسليم الـ PDF فقط.
 */
class EpaperReaderController extends Controller
{
    private const PER_PAGE = 24;

    public function index(string $locale): View
    {
        app()->setLocale($locale);

        $issues = Epaper::query()
            ->published()
            ->forLocale($locale)
            ->where('access_level', '!=', EpaperAccessLevel::Private->value) // الخاصّ لا يُدرَج في الأرشيف العامّ
            ->orderByDesc('publication_date')
            ->orderByDesc('issue_number')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        return view('epaper.index', [
            'locale' => $locale,
            'displayName' => app(NewspaperSettings::class)->display_name,
            'issues' => $issues,
        ]);
    }

    public function show(string $locale, string $issue, ?string $page = null): View|RedirectResponse
    {
        app()->setLocale($locale);

        // البادئة الرقمية قبل أوّل شَرطة هي المُعرّف ({id}-{slug}).
        $id = (int) $issue;

        $epaper = Epaper::query()
            ->published()
            ->forLocale($locale)
            ->whereKey($id)
            ->with('mediaAsset')
            ->first();

        abort_if($epaper === null, 404);

        // slug غير مطابق للحاليّ ⇒ تحويل دائم للرابط الأساسي (مع الحفاظ على رقم الصفحة).
        $requested = "{$locale}/epaper/{$issue}";
        if ($requested !== ltrim($epaper->canonicalPath(), '/')) {
            return redirect($epaper->canonicalPath().($page !== null ? "/p/{$page}" : ''), 301);
        }

        // بوابة الوصول: خاصّ → 404 لغير الإداريّ (لا تسريب)؛ مشترك بلا استحقاق → صفحة تشويق (200).
        if (! app(EpaperAccessPolicy::class)->canView(request()->user(), $epaper)) {
            abort_if($epaper->access_level === EpaperAccessLevel::Private, 404);

            return view('epaper.paywall', [
                'locale' => $locale,
                'epaper' => $epaper,
                'seo' => EpaperSeoBuilder::build($epaper),
            ]);
        }

        $issueParam = $epaper->id.'-'.$epaper->slug;

        return view('epaper.show', [
            'locale' => $locale,
            'epaper' => $epaper,
            'hasDocument' => $epaper->media_asset_id !== null,
            // لا روابط PDF خام: القارئ يصكّ رابطاً موقَّتاً من نقطة التسليم بعد فحص الوصول.
            'docEndpoint' => route('epaper.document', ['locale' => $locale, 'issue' => $issueParam]),
            'downloadEndpoint' => route('epaper.download', ['locale' => $locale, 'issue' => $issueParam]),
            // احتفاظ القارئ + التحليلات (Phase 5): نقاط الحالة/التتبّع + علم المصادقة.
            'stateEndpoint' => route('epaper.state', ['locale' => $locale, 'issue' => $issueParam]),
            'progressEndpoint' => route('epaper.progress', ['locale' => $locale, 'issue' => $issueParam]),
            'bookmarksEndpoint' => route('epaper.bookmarks.store', ['locale' => $locale, 'issue' => $issueParam]),
            'trackEndpoint' => route('epaper.track', ['locale' => $locale, 'issue' => $issueParam]),
            'authenticated' => request()->user() !== null,
            'canDownload' => app(EpaperAccessPolicy::class)->canDownload(request()->user(), $epaper),
            'initialPage' => max(1, (int) ($page ?? 1)),
            'seo' => EpaperSeoBuilder::build($epaper),
        ]);
    }
}
