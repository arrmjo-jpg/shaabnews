<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Settings\GeneralSettings;
use App\Settings\NewspaperSettings;
use App\Settings\SportSettings;
use App\Support\Media\MediaUrl;
use App\Support\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SiteController extends Controller
{
    public function settings(Request $request, GeneralSettings $settings, NewspaperSettings $newspaper, SportSettings $sport): JsonResponse
    {
        $locale = (string) $request->query('locale', 'ar');
        if (! in_array($locale, Category::LOCALES, true)) {
            $locale = 'ar';
        }

        // عقد ثابت: `social` خريطة {منصّة: رابط} دائماً. بلا الصبّ، يُعيد array_filter
        // مصفوفة PHP فارغة حين لا رابط مضبوطاً، فيُصدرها json_encode كـ`[]` (مصفوفة) بدل
        // `{}` (كائن) — أي أنّ **نوع الحقل يتبدّل بحسب البيانات**، وهو ما يكسر أيّ مستهلك
        // يتوقّع خريطة (مُثبَت: فشل تحقّق Zod في الواجهة يُسقط كامل إعدادات الموقع إلى null،
        // فيختفي الشعار والأيقونة والعنوان وJSON-LD). الصبّ إلى object يُثبّت النوع:
        // `{}` حين تفرغ، و`{"facebook":"…"}` حين تُملأ.
        $social = (object) array_filter([
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
            // Phase 2.1 — حقول الثيم فقط + شعارَي الرياضة (من GeneralSettings، لا SportSettings،
            // راجع SportSettings.php:14). لا نكشف هنا sport_default_*/feature-flags: لا مستهلك
            // فعليّ لها اليوم (Header/Footer لا تحتاجها) — تُضاف فقط حين تحتاجها مرحلة لاحقة
            // فعليّة (Search/Prediction)، لا استباقًا.
            'sport' => [
                'primary_color' => $sport->sport_primary_color,
                'secondary_color' => $sport->sport_secondary_color,
                'default_theme' => $sport->sport_default_theme,
                'allow_theme_switch' => $sport->sport_allow_theme_switch,
                'theme_cookie' => $sport->sport_theme_cookie,
                'logo_light' => $logoUrl($settings->logo_light_sports),
                'logo_dark' => $logoUrl($settings->logo_dark_sports),
            ],
            // ربط تتبّع الموقع (لوحة التحكم → الواجهة): الحقول محفوظة أصلاً بـGeneralSettings
            // (تبويب "التتبع والتحليلات") وتُستهلَك أصلاً بمكوّن <Analytics/> على الواجهة —
            // كانتا غير متصلتين فقط (هذا الـendpoint لم يكن يُصدرهما إطلاقاً). الأسماء هنا
            // مطابقة حرفياً لعقد frontend/src/lib/site-settings.ts (SiteSettingsSchema.analytics/
            // verification). لا نُصدر instagram_pixel/facebook_page_id/other_meta: لا مستهلك لها
            // بالواجهة بعد (ولا gtm_id/snapchat_pixel_id/verification.bing: لا حقل لها بلوحة
            // التحكم بعد) — تُضاف لاحقاً فقط إذا استُحدثت فعلاً.
            'analytics' => (object) array_filter([
                'google_analytics_id' => $settings->analytics_google_analytics ?: null,
                'meta_pixel_id' => $settings->analytics_facebook_pixel ?: null,
                'tiktok_pixel_id' => $settings->analytics_tiktok_pixel ?: null,
            ]),
            'verification' => (object) array_filter([
                'google' => $settings->analytics_google_meta_tag ?: null,
            ]),
        ]);
    }
}
