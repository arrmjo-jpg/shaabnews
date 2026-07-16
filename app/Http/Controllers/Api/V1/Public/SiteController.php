<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Settings\GeneralSettings;
use App\Settings\NewspaperSettings;
use App\Support\Media\MediaUrl;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SiteController extends Controller
{
    public function settings(Request $request, GeneralSettings $settings, NewspaperSettings $newspaper): JsonResponse
    {
        $locale = (string) $request->query('locale', 'ar');
        if (! in_array($locale, Category::LOCALES, true)) {
            $locale = 'ar';
        }

        $social = array_filter([
            'facebook' => $settings->social_facebook ?: null,
            'x' => $settings->social_twitter_x ?: null,
            'instagram' => $settings->social_instagram ?: null,
            'youtube' => $settings->social_youtube ?: null,
            'tiktok' => $settings->social_tiktok ?: null,
            'whatsapp' => $settings->social_whatsapp ?: null,
            'nabd' => $settings->social_nabd ?: null,
        ]);

        // جهات الاتصال: قائمة {name,title,phone} منظَّفة، مع رجوع للرقم الأحاديّ القديم إن فرغت.
        $phones = array_values(array_filter(array_map(static function ($c): array {
            $c = is_array($c) ? $c : ['phone' => $c];

            return [
                'name' => trim((string) ($c['name'] ?? '')),
                'title' => trim((string) ($c['title'] ?? '')),
                'phone' => trim((string) ($c['phone'] ?? '')),
            ];
        }, $settings->site_phones ?: []), static fn (array $c): bool => $c['phone'] !== ''));
        if ($phones === [] && trim((string) $settings->site_phone) !== '') {
            $phones = [['name' => '', 'title' => '', 'phone' => trim($settings->site_phone)]];
        }

        $logoUrl = fn (?string $path): ?string => MediaUrl::forPublic($path);

        // Header navigation categories — admin-curated via the `show_in_header` flag,
        // ordered by sort_order. الأقسام الرئيسية فقط (parent_id=null)؛ كل قسم يحمل أبناءه
        // المفعّلين لقائمة منسدلة في الهيدر. لا نشترط show_in_header على الأبناء (ظهور الأب
        // يكفي لكشف أبنائه ضمن الـdropdown). مصدر الحقيقة الوحيد لتنقّل الكروم.
        $navCategories = Category::query()
            ->active()
            ->forLocale($locale)
            ->where('show_in_header', true)
            ->whereNull('parent_id')
            ->with(['children' => fn ($q) => $q
                ->where('status', 'active')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->select(['id', 'parent_id', 'name', 'slug'])])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'name', 'slug'])
            ->map(fn (Category $c): array => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'children' => $c->children
                    ->map(fn (Category $child): array => ['id' => $child->id, 'name' => $child->name, 'slug' => $child->slug])
                    ->all(),
            ])
            ->all();

        return ApiResponse::success(data: [
            'site_name' => $settings->getLocalizedName($locale),
            // وصف الموقع الحقيقيّ (حقل مخصّص) — تستهلكه الواجهة في meta/og description.
            'description' => $settings->getLocalizedDescription($locale),
            'copyright' => $settings->getLocalizedCopyright($locale),
            // نصّ سياسة الكوكيز — يعرضه الفوتر في مودال (نصّ خام، لا HTML). عربي/إنجليزي حسب locale.
            'cookie_policy' => $settings->getLocalizedCookiePolicy($locale),
            'phone' => $phones[0]['phone'] ?? '',
            'phones' => $phones,
            'email' => $settings->site_email ?: '',
            // إحداثيّات المقرّ (خريطة صفحات التواصل) — null حين غير مضبوطة.
            'latitude' => $settings->latitude ?: null,
            'longitude' => $settings->longitude ?: null,
            'logo_light' => $logoUrl($settings->getLocalizedLogoLight($locale)),
            'logo_dark' => $logoUrl($settings->getLocalizedLogoDark($locale)),
            'favicon' => $logoUrl($settings->favicon),
            'social' => $social,
            'nav_categories' => $navCategories,
            // بوّابة المنتج: تظهر «الجريدة الرقمية» في الواجهة فقط عند تفعيلها.
            'newspaper_enabled' => $newspaper->enabled,
        ]);
    }
}
