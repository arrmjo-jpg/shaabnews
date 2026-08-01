import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// نمط "النسخة الكاملة على الجوّال" — المكان الوحيد لمنطق التوجيه (بلا أي حالة، بلا أي منطق آخر
// هنا سوى القراءة والـrewrite). القرار المعماري الكامل موثَّق بـ docs/desktop-view.md.
//
// **الموقع (src/middleware.ts لا الجذر frontend/middleware.ts) مُتحقَّق منه تجريبيًّا**: مشروع
// بهيكل src/ — next@15.5.19 المُثبَّت هنا لا يكتشف middleware.ts إلا داخل src/ تحديدًا (تأكّدت
// عبر manifest فارغ بالجذر مقابل manifest يعمل صح داخل src/، باختبار حيّ مباشر لا افتراض).
//
// لماذا Middleware لا generateViewport()+cookies(): أي قراءة cookies() داخل مسار الـrender (بما
// فيه generateMetadata/generateViewport) تُخرِج الصفحة كاملة من الـISR الثابت (بلا Partial
// Prerendering، غير مفعَّلة بهذا المشروع) — حادثتان موثَّقتان سابقًا بهذا الكودبيس (site-header.tsx
// القديم كسر ISR للموقع كامل بنفس الطريقة). قراءة الكوكيز هنا بالـMiddleware مختلفة جوهريًّا:
// تصير *قبل* أي رندر React، قرار توجيه بحت — الصفحة الناتجة (تحت /__desktop/*) تبقى ثابتة تمامًا
// ومخزَّنة (ISR) بشكل مستقلّ، بصرف النظر عن كون القرار بالوصول إليها اعتمد على كوكيز.
const COOKIE_NAME = 'acm_site_view';
const DESKTOP_PREFIX = '/desktop-view';

export function middleware(request: NextRequest) {
  if (request.cookies.get(COOKIE_NAME)?.value !== 'desktop') {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `${DESKTOP_PREFIX}${url.pathname}`;
  return NextResponse.rewrite(url);
}

// استثناءات: أصول Next الثابتة، مسارات الـAPI (بما فيها /api/revalidate ووسوم الإعلانات)، وملفات
// الميتاداتا (robots/sitemap/manifest) — لا معنى لـ"نسخة كاملة" لأيّ منها، ولا يجوز تحويل أيّ
// طلب API بالغلط. /desktop-view نفسها مستثناة أيضًا لمنع rewrite لا نهائي لو زارها أحد مباشرة.
//
// ملاحظة تسمية: الاسم الأصلي المقترَح كان `__desktop`، لكن تبيّن بالاختبار الحيّ المباشر (لا
// افتراضًا) أن Next.js يستثني أيّ مجلّد باسم يبدأ بـ`_` من التوجيه كليًّا (اصطلاح "Private Folders"
// الرسمي) — فكان المسار يعطي 404 دائمًا بصرف النظر عن الـcache. لذا استُبدل بـ`desktop-view` (بلا
// شرطة سفلية بادئة)، وهو اسم مسار غير محتمل التصادم مع أيّ slug تصنيف/مقال حقيقي بالموقع.
export const config = {
  matcher: [
    '/((?!_next/|api/|desktop-view/|robots\\.txt|manifest\\.webmanifest|sitemap|.*\\.xml$).*)',
  ],
};
