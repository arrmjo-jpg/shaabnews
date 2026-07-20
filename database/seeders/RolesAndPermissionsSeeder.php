<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * يُنشئ مجموعات الصلاحيات (كيانات حقيقية) + الصلاحيات + الأدوار للوحة الإدارة.
 * قابل للتشغيل المتكرر دون تكرار (idempotent).
 *
 * @author Fakhri Al-Najjar <arrmjo@gmail.com>
 */
class RolesAndPermissionsSeeder extends Seeder
{
    // ─── مجموعات الصلاحيات النظامية (slug => بيانات العرض) ────────────────
    private function groupsMap(): array
    {
        return [
            'user_management' => ['display_name' => 'إدارة المستخدمين', 'icon' => 'Users',          'description' => 'إدارة حسابات المستخدمين وحالاتهم'],
            'team' => ['display_name' => 'فريق العمل',        'icon' => 'Users',          'description' => 'إدارة صفحات التعريف بفريق العمل (محتوى تعريفيّ مستقلّ عن المستخدمين)'],
            'access_control' => ['display_name' => 'الأدوار والصلاحيات', 'icon' => 'ShieldCheck',   'description' => 'إدارة الأدوار والصلاحيات ومجموعاتها'],
            'articles' => ['display_name' => 'المقالات',          'icon' => 'FileText',       'description' => 'إنشاء وتحرير ونشر المقالات'],
            'pages' => ['display_name' => 'الصفحات الثابتة',  'icon' => 'FileText',       'description' => 'إدارة الصفحات الثابتة (من نحن/الخصوصية/الاستخدام/الشروط/أعلن معنا)'],
            'reels' => ['display_name' => 'الريلز',            'icon' => 'Clapperboard',   'description' => 'إنشاء وتحرير ونشر الريلز'],
            'video_library' => ['display_name' => 'مكتبة الفيديو',    'icon' => 'Film',           'description' => 'إدارة الفيديوهات وقوائم التشغيل وتصنيفات الفيديو'],
            'sport' => ['display_name' => 'الرياضة',            'icon' => 'Trophy',         'description' => 'البطولات: تغطية المزامنة وأعلام شريط المباريات'],
            'broadcast' => ['display_name' => 'البثّ',             'icon' => 'RadioTower',     'description' => 'إدارة البثّ المباشر والقنوات والراديو وتصنيفاتها'],
            'epaper' => ['display_name' => 'الجريدة الرقمية',    'icon' => 'Newspaper',      'description' => 'إدارة الأعداد الرقمية (PDF) للجريدة ودورة حياتها'],
            'categories' => ['display_name' => 'التصنيفات',         'icon' => 'FolderTree',     'description' => 'إدارة تصنيفات المحتوى'],
            'tags' => ['display_name' => 'الوسوم',            'icon' => 'Tag',            'description' => 'إدارة وسوم المحتوى'],
            'entities' => ['display_name' => 'الكيانات',          'icon' => 'Users',          'description' => 'سجلّ الكيانات الكنونيّ (أشخاص/منظّمات/أماكن/مواضيع)'],
            'media' => ['display_name' => 'الوسائط',           'icon' => 'Image',          'description' => 'إدارة مكتبة الوسائط'],
            'settings' => ['display_name' => 'الإعدادات',         'icon' => 'Settings',       'description' => 'إعدادات النظام العامة'],
            'cdn' => ['display_name' => 'شبكة التوصيل CDN',   'icon' => 'Cloud',          'description' => 'إعدادات وتفريغ كاش الـ CDN'],
            'notifications' => ['display_name' => 'الإشعارات',         'icon' => 'Bell',           'description' => 'إرسال وإدارة الإشعارات'],
            'ads' => ['display_name' => 'الإعلانات',         'icon' => 'Megaphone',      'description' => 'إدارة الإعلانات'],
            'whatsapp' => ['display_name' => 'حملات واتساب',     'icon' => 'MessageCircle',  'description' => 'مجموعات وجهات اتصال وحملات إرسال واتساب'],
            'comments' => ['display_name' => 'التعليقات',         'icon' => 'MessageSquare',  'description' => 'الإشراف على التعليقات'],
            'contact_messages' => ['display_name' => 'رسائل الاتصال',   'icon' => 'Mail',           'description' => 'إدارة رسائل «اتصل بنا» الواردة من الزوّار'],
            'ad_requests' => ['display_name' => 'طلبات الإعلان',    'icon' => 'Megaphone',      'description' => 'إدارة طلبات الإعلان الواردة من المعلِنين'],
            'polls' => ['display_name' => 'الاستطلاعات',       'icon' => 'BarChart3',      'description' => 'إدارة الاستطلاعات'],
            'seo' => ['display_name' => 'تحسين محركات البحث', 'icon' => 'Search',         'description' => 'إعدادات SEO'],
            'analytics' => ['display_name' => 'التحليلات',         'icon' => 'LineChart',      'description' => 'تقارير وإحصائيات الموقع'],
            'ai' => ['display_name' => 'الذكاء الاصطناعي',   'icon' => 'Sparkles',       'description' => 'توليد المحتوى وإعداداته'],
            'system' => ['display_name' => 'عمليات النظام',  'icon' => 'Server',         'description' => 'بنية تشغيلية: المُجدوِل والنُّسخ والصحّة'],
            'wp_migration' => ['display_name' => 'ترحيل ووردبريس', 'icon' => 'DatabaseZap',     'description' => 'منصّة ترحيل المحتوى التحريري من ووردبريس'],
            'vertix_migration' => ['display_name' => 'ترحيل Vertix',   'icon' => 'DatabaseZap',     'description' => 'نظام مستقلّ لاستيراد الأقسام والأخبار من قاعدة Vertix'],
        ];
    }

    // ─── تعريف الصلاحيات مجمّعة حسب slug المجموعة ─────────────────────────
    private function permissionsMap(): array
    {
        return [
            'user_management' => [
                ['name' => 'users.view',    'display_name' => 'عرض المستخدمين',       'description' => 'عرض قائمة المستخدمين وتفاصيلهم'],
                ['name' => 'users.create',  'display_name' => 'إنشاء مستخدم',         'description' => 'إضافة مستخدم جديد من لوحة الإدارة'],
                ['name' => 'users.edit',    'display_name' => 'تعديل مستخدم',         'description' => 'تعديل بيانات مستخدم موجود'],
                ['name' => 'users.delete',  'display_name' => 'حذف مستخدم',           'description' => 'حذف مستخدم واسترجاعه'],
                ['name' => 'users.ban',     'display_name' => 'حظر مستخدم',           'description' => 'حظر مستخدم ومنعه من الوصول'],
                ['name' => 'users.suspend', 'display_name' => 'إيقاف مستخدم مؤقتاً', 'description' => 'إيقاف حساب المستخدم بشكل مؤقت'],
                ['name' => 'writer-requests.view',   'display_name' => 'عرض طلبات الترقية لكاتب',  'description' => 'عرض طلبات ترقية الحساب إلى كاتب'],
                ['name' => 'writer-requests.review', 'display_name' => 'مراجعة طلبات الترقية',     'description' => 'قبول أو رفض طلبات الترقية لكاتب'],
                ['name' => 'activity.view',          'display_name' => 'عرض سجل النشاط',           'description' => 'عرض سجل تدقيق نشاط النظام الشامل'],
            ],

            'team' => [
                ['name' => 'team.view',         'display_name' => 'عرض أعضاء الفريق',     'description' => 'عرض قائمة أعضاء الفريق وتفاصيلهم'],
                ['name' => 'team.create',       'display_name' => 'إنشاء عضو فريق',       'description' => 'إضافة عضو فريق جديد'],
                ['name' => 'team.edit',         'display_name' => 'تعديل عضو فريق',       'description' => 'تعديل بيانات عضو فريق وحالته وترتيبه'],
                ['name' => 'team.delete',       'display_name' => 'حذف عضو فريق',         'description' => 'حذف عضو فريق (حذف ناعم قابل للاسترجاع)'],
                ['name' => 'team.restore',      'display_name' => 'استرجاع عضو محذوف',    'description' => 'استرجاع عضو فريق من المحذوفات'],
                ['name' => 'team.force_delete', 'display_name' => 'حذف نهائي لعضو',       'description' => 'حذف عضو فريق نهائياً دون إمكانية استرجاع'],
            ],

            'access_control' => [
                ['name' => 'roles.view',                'display_name' => 'عرض الأدوار',           'description' => 'عرض الأدوار المتاحة في النظام'],
                ['name' => 'roles.create',              'display_name' => 'إنشاء دور',             'description' => 'إضافة دور جديد'],
                ['name' => 'roles.edit',                'display_name' => 'تعديل دور',             'description' => 'تعديل اسم أو صلاحيات دور موجود'],
                ['name' => 'roles.delete',              'display_name' => 'حذف دور',               'description' => 'حذف دور من النظام'],
                ['name' => 'permissions.view',          'display_name' => 'عرض الصلاحيات',         'description' => 'عرض جميع الصلاحيات المتاحة'],
                ['name' => 'permissions.assign',        'display_name' => 'تعيين الصلاحيات',       'description' => 'تعيين أو سحب الصلاحيات من الأدوار'],
                ['name' => 'permission-groups.view',    'display_name' => 'عرض مجموعات الصلاحيات', 'description' => 'عرض مجموعات الصلاحيات'],
                ['name' => 'permission-groups.create',  'display_name' => 'إنشاء مجموعة صلاحيات',  'description' => 'إضافة مجموعة صلاحيات جديدة'],
                ['name' => 'permission-groups.edit',    'display_name' => 'تعديل مجموعة صلاحيات',  'description' => 'تعديل بيانات مجموعة صلاحيات'],
                ['name' => 'permission-groups.delete',  'display_name' => 'حذف مجموعة صلاحيات',    'description' => 'حذف مجموعة صلاحيات غير نظامية'],
            ],

            'articles' => [
                ['name' => 'articles.view',    'display_name' => 'عرض المقالات',    'description' => 'عرض قائمة المقالات وتفاصيلها'],
                ['name' => 'articles.create',  'display_name' => 'إنشاء مقال',      'description' => 'كتابة وإنشاء مقال جديد'],
                ['name' => 'articles.edit',    'display_name' => 'تعديل مقال',      'description' => 'تعديل محتوى مقال موجود'],
                ['name' => 'articles.delete',  'display_name' => 'حذف مقال',        'description' => 'حذف مقال (حذف ناعم قابل للاسترجاع)'],
                ['name' => 'articles.restore', 'display_name' => 'استرجاع مقال محذوف', 'description' => 'استرجاع مقال من المحذوفات'],
                ['name' => 'articles.force_delete', 'display_name' => 'حذف نهائي لمقال', 'description' => 'حذف مقال نهائياً دون إمكانية استرجاع'],
                ['name' => 'articles.publish', 'display_name' => 'نشر مقال',        'description' => 'نشر مقال وإتاحته للعموم'],
                ['name' => 'articles.feature', 'display_name' => 'تمييز مقال',      'description' => 'تمييز مقال كمحتوى مميّز'],
                ['name' => 'articles.archive', 'display_name' => 'أرشفة مقال',      'description' => 'نقل مقال إلى الأرشيف'],
                // التنسيبات التحريرية أُزيلت — مكان العرض صار بأعلام جدول الأخبار
                // (is_featured/is_breaking/is_header/is_editor_pick) عبر articles.edit.
            ],

            'categories' => [
                ['name' => 'categories.view',   'display_name' => 'عرض التصنيفات',   'description' => 'عرض قائمة التصنيفات'],
                ['name' => 'categories.create', 'display_name' => 'إنشاء تصنيف',     'description' => 'إضافة تصنيف جديد'],
                ['name' => 'categories.edit',   'display_name' => 'تعديل تصنيف',     'description' => 'تعديل بيانات تصنيف موجود'],
                ['name' => 'categories.delete', 'display_name' => 'حذف تصنيف',       'description' => 'حذف تصنيف (حذف ناعم قابل للاسترجاع)'],
                ['name' => 'categories.restore', 'display_name' => 'استرجاع تصنيف محذوف', 'description' => 'استرجاع تصنيف من المحذوفات'],
                ['name' => 'categories.force_delete', 'display_name' => 'حذف نهائي لتصنيف', 'description' => 'حذف تصنيف نهائياً دون إمكانية استرجاع'],
            ],

            'pages' => [
                ['name' => 'pages.view',    'display_name' => 'عرض الصفحات',    'description' => 'عرض قائمة الصفحات الثابتة وتفاصيلها'],
                ['name' => 'pages.create',  'display_name' => 'إنشاء صفحة',      'description' => 'إنشاء صفحة ثابتة جديدة'],
                ['name' => 'pages.edit',    'display_name' => 'تعديل صفحة',      'description' => 'تعديل محتوى صفحة ثابتة موجودة'],
                ['name' => 'pages.publish', 'display_name' => 'نشر صفحة',        'description' => 'نشر صفحة ثابتة وإتاحتها للعموم'],
                ['name' => 'pages.archive', 'display_name' => 'أرشفة صفحة',      'description' => 'نقل صفحة ثابتة إلى الأرشيف'],
                ['name' => 'pages.delete',  'display_name' => 'حذف صفحة',        'description' => 'حذف صفحة ثابتة (حذف ناعم قابل للاسترجاع)'],
                ['name' => 'pages.restore', 'display_name' => 'استرجاع صفحة محذوفة', 'description' => 'استرجاع صفحة ثابتة من المحذوفات'],
                ['name' => 'pages.force_delete', 'display_name' => 'حذف نهائي لصفحة', 'description' => 'حذف صفحة ثابتة نهائياً دون إمكانية استرجاع'],
            ],

            'contact_messages' => [
                ['name' => 'contact-messages.view',   'display_name' => 'عرض رسائل الاتصال', 'description' => 'عرض رسائل «اتصل بنا» وتفاصيلها وتعليمها مقروءة'],
                ['name' => 'contact-messages.reply',  'display_name' => 'الرد وتغيير الحالة', 'description' => 'تغيير حالة رسالة الاتصال والرد عليها'],
                ['name' => 'contact-messages.delete', 'display_name' => 'حذف رسالة اتصال',    'description' => 'حذف رسالة اتصال (حذف ناعم قابل للاسترجاع)'],
            ],

            'ad_requests' => [
                ['name' => 'ad-requests.view',   'display_name' => 'عرض طلبات الإعلان', 'description' => 'عرض طلبات الإعلان وتفاصيلها وملاحظاتها'],
                ['name' => 'ad-requests.review', 'display_name' => 'مراجعة طلبات الإعلان', 'description' => 'تغيير حالة الطلب وإضافة ملاحظات داخليّة'],
                ['name' => 'ad-requests.delete', 'display_name' => 'حذف طلب إعلان',      'description' => 'حذف طلب إعلان (حذف ناعم قابل للاسترجاع)'],
            ],

            'reels' => [
                ['name' => 'reels.view',    'display_name' => 'عرض الريلز',    'description' => 'عرض قائمة الريلز وتفاصيلها'],
                ['name' => 'reels.create',  'display_name' => 'إنشاء ريل',      'description' => 'إنشاء ريل جديد'],
                ['name' => 'reels.edit',    'display_name' => 'تعديل ريل',      'description' => 'تعديل بيانات ريل موجود'],
                ['name' => 'reels.publish', 'display_name' => 'نشر ريل',        'description' => 'نشر ريل وإتاحته للعموم'],
                ['name' => 'reels.archive', 'display_name' => 'أرشفة ريل',      'description' => 'نقل ريل إلى الأرشيف'],
                ['name' => 'reels.delete',  'display_name' => 'حذف ريل',        'description' => 'حذف ريل (حذف ناعم قابل للاسترجاع)'],
                ['name' => 'reels.restore', 'display_name' => 'استرجاع ريل محذوف', 'description' => 'استرجاع ريل من المحذوفات'],
                ['name' => 'reels.force_delete', 'display_name' => 'حذف نهائي لريل', 'description' => 'حذف ريل نهائياً دون إمكانية استرجاع'],
            ],

            'video_library' => [
                ['name' => 'videos.view',          'display_name' => 'عرض الفيديوهات',        'description' => 'عرض قائمة مكتبة الفيديو وتفاصيلها'],
                ['name' => 'videos.create',        'display_name' => 'إنشاء فيديو',           'description' => 'إضافة فيديو (مرفوع أو خارجي)'],
                ['name' => 'videos.edit',          'display_name' => 'تعديل فيديو',           'description' => 'تعديل بيانات فيديو موجود'],
                ['name' => 'videos.publish',       'display_name' => 'نشر فيديو',             'description' => 'نشر فيديو وإتاحته للعموم'],
                ['name' => 'videos.archive',       'display_name' => 'أرشفة فيديو',           'description' => 'نقل فيديو إلى الأرشيف'],
                ['name' => 'videos.delete',        'display_name' => 'حذف فيديو',             'description' => 'حذف فيديو (حذف ناعم قابل للاسترجاع)'],
                ['name' => 'videos.restore',       'display_name' => 'استرجاع فيديو محذوف',   'description' => 'استرجاع فيديو من المحذوفات'],
                ['name' => 'videos.force_delete',  'display_name' => 'حذف نهائي لفيديو',      'description' => 'حذف فيديو نهائياً دون إمكانية استرجاع'],
                ['name' => 'videos.reprocess',     'display_name' => 'إعادة معالجة فيديو',    'description' => 'إعادة تشغيل خطّ المعالجة (HLS) لفيديو مرفوع'],
                ['name' => 'videos.sync',          'display_name' => 'مزامنة الفيديو البعيدة', 'description' => 'مزامنة/تحقّق/إصلاح مرآة التخزين البعيد لأصول الفيديو'],
                ['name' => 'video-playlists.view',     'display_name' => 'عرض قوائم التشغيل',  'description' => 'عرض قوائم تشغيل الفيديو'],
                ['name' => 'video-playlists.manage',   'display_name' => 'إدارة قوائم التشغيل', 'description' => 'إنشاء/تعديل/ترتيب/حذف قوائم التشغيل'],
                ['name' => 'video-categories.view',    'display_name' => 'عرض تصنيفات الفيديو', 'description' => 'عرض تصنيفات مكتبة الفيديو'],
                ['name' => 'video-categories.manage',  'display_name' => 'إدارة تصنيفات الفيديو', 'description' => 'إنشاء/تعديل/ترتيب/حذف تصنيفات الفيديو'],
            ],

            'sport' => [
                ['name' => 'competitions.view',   'display_name' => 'عرض البطولات',   'description' => 'عرض قائمة البطولات وتغطيتها وأعلام شريط المباريات'],
                ['name' => 'competitions.manage', 'display_name' => 'إدارة البطولات', 'description' => 'إنشاء/تعديل/حذف بطولة، تفعيل تغطيتها ومزامنتها، وضبط ظهورها في شريط المباريات'],
                ['name' => 'sport_menu.view',   'display_name' => 'عرض قائمة الرياضة',  'description' => 'عرض عناصر قائمة قسم الرياضة (تصنيفات وأقسام وظيفية)'],
                ['name' => 'sport_menu.manage', 'display_name' => 'إدارة قائمة الرياضة', 'description' => 'إنشاء/تعديل/ترتيب/حذف عناصر قائمة قسم الرياضة'],
            ],

            'broadcast' => [
                ['name' => 'broadcasts.view',   'display_name' => 'عرض البثّ',   'description' => 'عرض قائمة البثّ وتفاصيله'],
                ['name' => 'broadcasts.create', 'display_name' => 'إنشاء بثّ',    'description' => 'إنشاء بثّ جديد (مصدر خارجي موثوق)'],
                ['name' => 'broadcasts.edit',   'display_name' => 'تعديل بثّ',    'description' => 'تعديل بيانات بثّ موجود'],
                ['name' => 'broadcasts.delete', 'display_name' => 'حذف بثّ',      'description' => 'حذف بثّ (حذف ناعم قابل للاسترجاع)'],
                ['name' => 'broadcasts.schedule', 'display_name' => 'جدولة بثّ',   'description' => 'جدولة بثّ للبدء التلقائي مستقبلاً'],
                ['name' => 'broadcasts.control',  'display_name' => 'التحكّم بدورة حياة البثّ', 'description' => 'بدء/تعليق/استئناف/إنهاء/وسم فشل البثّ المباشر'],
                ['name' => 'broadcasts.archive',  'display_name' => 'أرشفة بثّ',   'description' => 'نقل بثّ منتهٍ/فاشل إلى الأرشيف'],
                ['name' => 'broadcasts.viewer_control',     'display_name' => 'طرد المشاهدين',     'description' => 'طرد مشاهد من البثّ (تعاونيّ — يُعيد الانضمام ما لم يُحظَر)'],
                ['name' => 'broadcasts.viewer_ban',         'display_name' => 'حظر المشاهدين',     'description' => 'حظر/رفع حظر مشاهد مؤقّتاً (منع إعادة الاتصال أثناء سريانه)'],
                ['name' => 'broadcasts.audience_control',   'display_name' => 'التحكّم بالجمهور',  'description' => 'إغلاق/إعادة فتح جمهور البثّ بالكامل'],
                ['name' => 'broadcasts.emergency_shutdown', 'display_name' => 'الإيقاف الطارئ',    'description' => 'إيقاف تشغيليّ طارئ: تعليق البثّ + إغلاق الجمهور + تفكيك الحضور'],
                ['name' => 'broadcast-categories.view',   'display_name' => 'عرض تصنيفات البثّ',  'description' => 'عرض تصنيفات البثّ'],
                ['name' => 'broadcast-categories.manage', 'display_name' => 'إدارة تصنيفات البثّ', 'description' => 'إنشاء/تعديل/حذف تصنيفات البثّ'],
            ],

            'epaper' => [
                ['name' => 'epapers.view',         'display_name' => 'عرض الأعداد',       'description' => 'عرض قائمة الأعداد الرقمية وتفاصيلها'],
                ['name' => 'epapers.create',       'display_name' => 'إنشاء عدد',         'description' => 'رفع عدد رقميّ جديد (PDF)'],
                ['name' => 'epapers.edit',         'display_name' => 'تعديل عدد',         'description' => 'تعديل بيانات عدد + استبدال الـ PDF'],
                ['name' => 'epapers.publish',      'display_name' => 'نشر/جدولة عدد',     'description' => 'نشر عدد أو جدولته للنشر التلقائي'],
                ['name' => 'epapers.archive',      'display_name' => 'أرشفة عدد',         'description' => 'نقل عدد إلى الأرشيف'],
                ['name' => 'epapers.delete',       'display_name' => 'حذف عدد',           'description' => 'حذف ناعم قابل للاسترجاع'],
                ['name' => 'epapers.restore',      'display_name' => 'استرجاع عدد محذوف', 'description' => 'استرجاع عدد من المحذوفات'],
                ['name' => 'epapers.force_delete', 'display_name' => 'حذف نهائيّ لعدد',   'description' => 'حذف عدد نهائياً دون إمكانية استرجاع'],
            ],

            'tags' => [
                ['name' => 'tags.view',   'display_name' => 'عرض الوسوم',   'description' => 'عرض قائمة الوسوم'],
                ['name' => 'tags.create', 'display_name' => 'إنشاء وسم',    'description' => 'إضافة وسم جديد'],
                ['name' => 'tags.edit',   'display_name' => 'تعديل وسم',    'description' => 'تعديل وسم موجود'],
                ['name' => 'tags.delete', 'display_name' => 'حذف وسم',      'description' => 'حذف وسم من النظام'],
            ],

            'entities' => [
                ['name' => 'entities.view',   'display_name' => 'عرض الكيانات',   'description' => 'عرض/بحث سجلّ الكيانات الكنونيّ (أشخاص/منظّمات/أماكن/مواضيع)'],
                ['name' => 'entities.create', 'display_name' => 'إنشاء كيان',     'description' => 'إضافة كيان جديد إلى السجلّ'],
                ['name' => 'entities.edit',   'display_name' => 'تعديل كيان',     'description' => 'تعديل بيانات كيان موجود'],
                ['name' => 'entities.delete', 'display_name' => 'حذف كيان',       'description' => 'حذف ناعم لكيان من السجلّ'],
            ],

            'media' => [
                ['name' => 'media.view',   'display_name' => 'عرض الوسائط',   'description' => 'عرض مكتبة الوسائط'],
                ['name' => 'media.upload', 'display_name' => 'رفع وسائط',     'description' => 'رفع صور وملفات إلى المكتبة'],
                ['name' => 'media.delete', 'display_name' => 'حذف وسائط',     'description' => 'حذف ملفات من مكتبة الوسائط'],
            ],

            'settings' => [
                ['name' => 'settings.view', 'display_name' => 'عرض الإعدادات',   'description' => 'عرض إعدادات النظام'],
                ['name' => 'settings.edit', 'display_name' => 'تعديل الإعدادات', 'description' => 'تعديل إعدادات النظام العامة'],
            ],

            'cdn' => [
                ['name' => 'cdn.view',  'display_name' => 'عرض إعدادات CDN',   'description' => 'عرض حالة وإعدادات شبكة التوصيل (Cloudflare)'],
                ['name' => 'cdn.edit',  'display_name' => 'تعديل إعدادات CDN', 'description' => 'تعديل إعدادات شبكة التوصيل'],
                ['name' => 'cdn.purge', 'display_name' => 'تفريغ كاش CDN',     'description' => 'تفريغ روابط محددة أو كامل كاش الـ CDN'],
            ],

            'notifications' => [
                ['name' => 'notifications.view',   'display_name' => 'عرض الإشعارات',   'description' => 'عرض الحملات والمصفوفة والقوالب والصحّة'],
                ['name' => 'notifications.manage', 'display_name' => 'إدارة الإشعارات', 'description' => 'المصفوفة والقوالب والموافقة/الإيقاف/الاستئناف/الإلغاء'],
                ['name' => 'notifications.send',   'display_name' => 'إرسال إشعارات',   'description' => 'إنشاء وإرسال حملات إشعار يدويّة'],
                ['name' => 'notifications.delete', 'display_name' => 'حذف إشعارات',     'description' => 'حذف إشعارات من النظام'],
            ],

            'ads' => [
                ['name' => 'ads.view',   'display_name' => 'عرض الإعلانات',   'description' => 'عرض قائمة الإعلانات والحملات'],
                ['name' => 'ads.create', 'display_name' => 'إنشاء إعلان',     'description' => 'إضافة حملة/إعلان جديد'],
                ['name' => 'ads.edit',   'display_name' => 'تعديل إعلان',     'description' => 'تعديل حملة/إعلان موجود'],
                ['name' => 'ads.delete', 'display_name' => 'حذف إعلان',       'description' => 'حذف حملة/إعلان من النظام'],
                ['name' => 'ads.publish',       'display_name' => 'دورة حياة الحملة', 'description' => 'تغيير حالة الحملة (تفعيل/إيقاف/إكمال/أرشفة)'],
                ['name' => 'ads.restore',       'display_name' => 'استرجاع إعلان',    'description' => 'استرجاع حملة/إعلان محذوف'],
                ['name' => 'ads.force_delete',  'display_name' => 'حذف نهائي للإعلان', 'description' => 'حذف نهائي لا يمكن استرجاعه'],
                ['name' => 'ad-zones.view',     'display_name' => 'عرض المساحات الإعلانية',  'description' => 'عرض مساحات عرض الإعلانات'],
                ['name' => 'ad-zones.manage',   'display_name' => 'إدارة المساحات الإعلانية', 'description' => 'إنشاء/تعديل/حذف مساحات عرض الإعلانات'],
            ],

            'whatsapp' => [
                ['name' => 'whatsapp.view',   'display_name' => 'عرض واتساب',          'description' => 'عرض المجموعات وجهات الاتصال والحملات وسجلّها'],
                ['name' => 'whatsapp.manage', 'display_name' => 'إدارة واتساب',        'description' => 'إنشاء/تعديل/حذف المجموعات وجهات الاتصال'],
                ['name' => 'whatsapp.send',   'display_name' => 'إرسال حملات واتساب',  'description' => 'إنشاء الحملات واختبارها وإرسالها وجدولتها وإلغاؤها'],
                ['name' => 'whatsapp.import', 'display_name' => 'استيراد جهات اتصال',  'description' => 'استيراد جهات الاتصال من CSV/Excel'],
                ['name' => 'whatsapp.export', 'display_name' => 'تصدير جهات اتصال',    'description' => 'تصدير جهات الاتصال إلى CSV/Excel'],
            ],

            'comments' => [
                ['name' => 'comments.view',    'display_name' => 'عرض التعليقات',    'description' => 'عرض تعليقات المستخدمين'],
                ['name' => 'comments.approve', 'display_name' => 'اعتماد تعليق',     'description' => 'اعتماد تعليق ونشره'],
                ['name' => 'comments.delete',  'display_name' => 'حذف تعليق',        'description' => 'حذف تعليق من النظام'],
            ],

            'polls' => [
                ['name' => 'polls.view',    'display_name' => 'عرض الاستطلاعات',     'description' => 'عرض قائمة الاستطلاعات وتفاصيلها'],
                ['name' => 'polls.create',  'display_name' => 'إنشاء استطلاع',       'description' => 'إضافة استطلاع جديد'],
                ['name' => 'polls.edit',    'display_name' => 'تعديل استطلاع',       'description' => 'تعديل استطلاع وخياراته'],
                ['name' => 'polls.publish', 'display_name' => 'تفعيل/تعطيل استطلاع', 'description' => 'تغيير حالة تفعيل الاستطلاع (نشر)'],
                ['name' => 'polls.delete',  'display_name' => 'حذف استطلاع',         'description' => 'حذف استطلاع (سلّة قابلة للاسترجاع)'],
                ['name' => 'polls.restore', 'display_name' => 'استرجاع استطلاع',     'description' => 'استرجاع استطلاع محذوف من السلّة'],
                ['name' => 'polls.force_delete', 'display_name' => 'حذف نهائي للاستطلاع', 'description' => 'حذف نهائي لا يمكن استرجاعه'],
            ],

            'seo' => [
                ['name' => 'seo.view', 'display_name' => 'عرض إعدادات SEO',   'description' => 'عرض إعدادات محركات البحث'],
                ['name' => 'seo.edit', 'display_name' => 'تعديل إعدادات SEO', 'description' => 'تعديل بيانات تحسين محركات البحث'],
            ],

            'analytics' => [
                ['name' => 'analytics.view', 'display_name' => 'عرض التحليلات', 'description' => 'عرض تقارير وإحصائيات الموقع'],
            ],

            'ai' => [
                ['name' => 'ai.use',      'display_name' => 'استخدام الذكاء الاصطناعي',  'description' => 'توليد محتوى بالذكاء الاصطناعي'],
                ['name' => 'ai.settings', 'display_name' => 'إعدادات الذكاء الاصطناعي', 'description' => 'تعديل إعدادات وحدود الذكاء الاصطناعي'],
            ],

            'system' => [
                ['name' => 'scheduler.view',   'display_name' => 'عرض المُجدوِل',        'description' => 'عرض المهام المجدوَلة وحالتها'],
                ['name' => 'scheduler.manage', 'display_name' => 'إدارة المُجدوِل',       'description' => 'تفعيل/تعطيل المهام وتعديل الملاحظات'],
                ['name' => 'scheduler.run',    'display_name' => 'تشغيل مهمة يدوياً',     'description' => 'تشغيل مهمة مجدوَلة مسموح بها يدوياً'],
                ['name' => 'failed_jobs.view',   'display_name' => 'عرض المهام الفاشلة',  'description' => 'عرض قائمة المهام الفاشلة في الطابور'],
                ['name' => 'failed_jobs.manage', 'display_name' => 'إدارة المهام الفاشلة', 'description' => 'إعادة محاولة/حذف المهام الفاشلة'],
                ['name' => 'cache.clear',        'display_name' => 'تفريغ كاش المحتوى',   'description' => 'تفريغ كاش المحتوى العام (مقالات/ريلز/خرائط/تصنيفات)'],
            ],

            'wp_migration' => [
                ['name' => 'wp-migration.view',   'display_name' => 'عرض الترحيل',  'description' => 'عرض لوحات ترحيل ووردبريس وحالته وتقاريره'],
                ['name' => 'wp-migration.manage', 'display_name' => 'إدارة الترحيل', 'description' => 'تهيئة الاتصال والخرائط وتشغيل/إيقاف/استئناف الترحيل وإعادة المحاولة'],
            ],

            'vertix_migration' => [
                ['name' => 'vertix-migration.view',   'display_name' => 'عرض ترحيل Vertix',  'description' => 'عرض حالة ترحيل Vertix وعدّاداته وأخطائه'],
                ['name' => 'vertix-migration.manage', 'display_name' => 'إدارة ترحيل Vertix', 'description' => 'تشغيل استيراد الأقسام والأخبار من قاعدة Vertix'],
            ],
        ];
    }

    // ─── تعريف الأدوار مع بياناتها ────────────────────────────────────────
    private function rolesMap(): array
    {
        // فقط الأدوار الأساسية. باقي الأدوار التحريرية يضيفها المدير يدوياً من اللوحة.
        // ملاحظة: دور "user" مُبقىً عمداً لأنه تبعية نظامية صلبة —
        // RegisterAction يُسنده تلقائياً عند التسجيل العام (إزالته تكسر التسجيل).
        return [
            ['name' => 'super_admin', 'display_name' => 'مدير النظام', 'description' => 'صلاحيات كاملة وغير مقيّدة على جميع أقسام النظام'],
            ['name' => 'user',        'display_name' => 'مستخدم',      'description' => 'الدور الافتراضي المعيَّن تلقائياً عند التسجيل العام'],
        ];
    }

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // ─── إنشاء مجموعات الصلاحيات (كيانات) ─────────────────────────────
        $groups = [];
        $sort = 1;
        foreach ($this->groupsMap() as $slug => $meta) {
            $groups[$slug] = PermissionGroup::updateOrCreate(
                ['slug' => $slug],
                [
                    'display_name' => $meta['display_name'],
                    'description' => $meta['description'],
                    'icon' => $meta['icon'],
                    'sort_order' => $sort++,
                    'is_system' => true,
                ]
            );
        }

        // ─── إنشاء الصلاحيات وربطها بمجموعاتها ─────────────────────────────
        $allPermissions = [];

        foreach ($this->permissionsMap() as $groupSlug => $permissions) {
            foreach ($permissions as $permissionData) {
                $permission = Permission::updateOrCreate(
                    ['name' => $permissionData['name'], 'guard_name' => 'web'],
                    [
                        'display_name' => $permissionData['display_name'],
                        // العمود النصّي يُبقى مرآةً للـ slug (توافق خلفي)
                        'group' => $groupSlug,
                        'description' => $permissionData['description'],
                        'permission_group_id' => $groups[$groupSlug]->id,
                    ]
                );

                $allPermissions[] = $permission->name;
            }
        }

        // ─── إنشاء الأدوار ────────────────────────────────────────────────
        foreach ($this->rolesMap() as $roleData) {
            Role::updateOrCreate(
                ['name' => $roleData['name'], 'guard_name' => 'web'],
                [
                    'display_name' => $roleData['display_name'],
                    'description' => $roleData['description'],
                ]
            );
        }

        // ─── تعيين جميع الصلاحيات لـ super_admin ─────────────────────────
        $superAdmin = Role::findByName('super_admin', 'web');
        $superAdmin->syncPermissions($allPermissions);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
