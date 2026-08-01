// تبديل «النسخة الكاملة / نسخة الجوال» — الآلية الرسمية: كوكيز يقرأها middleware.ts (Edge، قبل
// أي رندر React) لتحويل (rewrite) الطلب لشجرة /desktop-view المستقلّة، التي تضبط viewport=1280 عبر
// Metadata API الرسمية (app/desktop-view/layout.tsx) — لا سكربت، لا تعديل DOM، لا قراءة post-hydration.
// التفاصيل المعمارية الكاملة: docs/desktop-view.md.
//
// القراءة هنا (isForcedDesktop) عميلة بحتة (document.cookie) — تُستخدَم فقط لعرض الحالة الصحيحة
// بزرّ التبديل نفسه (MobileTopToggleBanner)، لا لأي قرار توجيه أو رندر يؤثّر على المحتوى. القرار
// الفعليّ الوحيد المؤثّر على الرندر يصير حصرًا بـmiddleware.ts (خارج شجرة React كليًّا) — فلا خطر
// على الـISR إطلاقًا هنا.
export const SITE_VIEW_COOKIE = 'acm_site_view';

export function isForcedDesktop(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${SITE_VIEW_COOKIE}=desktop`);
}

export function setForcedDesktop(forced: boolean) {
  if (forced) {
    document.cookie = `${SITE_VIEW_COOKIE}=desktop; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    document.cookie = `${SITE_VIEW_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
  // إعادة تحميل ضرورية: middleware.ts يقرأ الكوكيز وقت الطلب فقط — لازم طلب جديد كي يطبَّق الـrewrite.
  // هذا طبيعيّ لأي تغيير توجيه سيرفريّ (مو التفافًا حول تعديل DOM كما كان سابقًا).
  location.reload();
}
