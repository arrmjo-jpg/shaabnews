import Script from 'next/script';
import type { Viewport } from 'next';

// جذر شجرة "النسخة الكاملة" — المكان الوحيد الذي يضبط viewport العريض (Metadata API الرسمية،
// مُحلَّلة وقت الطلب/البناء بالسيرفر). التفاصيل المعمارية الكاملة بـdocs/desktop-view.md. سوى
// تمرير children — كل حاويات الموقع (SiteHeader/Footer/الأقسام...) تبقى بمكانها الأصليّ
// (site)/(sport)/(reels)، معاد تصديرها بلا تكرار منطق عبر ملفات stub تحت هذا المسار.
//
// ROOT CAUSE FIX (الفتح على الموبايل يظهر "مكبَّرًا" بدل أن يُقاس على عرض الشاشة): initialScale
// ثابت أدناه (1) لا مفرّ منه من الـMetadata API نفسها — تتبّعنا هذا داخل كود Next.js
// (resolve-metadata.js): كل صفحة تبدأ بـinitialScale:1 كقيمة افتراضية جذرية، وحذف الحقل من
// كائن viewport هنا لا يُلغيها (كل طبقة تُبدّل فقط الحقول المذكورة صراحة، بلا آلية "إلغاء").
// السيرفر أصلاً لا يعرف عرض شاشة الجهاز الفعلي وقت التوليد (375 أو 390 أو 430...)، فلا حل
// بلا جافاسكربت يحسب المقياس الصحيح من window.innerWidth الفعلي في المتصفح. beforeInteractive
// يُحقَن في <head> وينفَّذ قبل أن تصير الصفحة تفاعليّة — قبل أي hydration فعليّ لهذه الشجرة (لا
// تعارض مع تحذير "بلا تعديل بعد الـHydration" السابق: هذا سكربت خام لا يلمس DOM تديره React).
export const viewport: Viewport = {
  width: 1280,
  initialScale: 1,
  userScalable: true,
};

const FIT_SCALE_SCRIPT = `
(function () {
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  // screen.width لا window.innerWidth: بحلول تنفيذ هذا السكربت يكون المتصفّح قد طبّق فعلاً
  // width=1280 الساكن من وسم meta (المُولَّد من السيرفر)، فيصير window.innerWidth/clientWidth
  // مساويًا 1280 (عرض viewport التخطيطيّ الجديد) لا عرض شاشة الجهاز الفعليّ — screen.width يصف
  // عرض شاشة العرض نفسها، بمعزل تام عن أي تكبير/عرض صفحة، فهو الصحيح هنا دائمًا.
  var w = window.screen && window.screen.width ? window.screen.width : 1280;
  var scale = w / 1280;
  meta.setAttribute('content', 'width=1280, initial-scale=' + scale + ', user-scalable=yes');
})();
`;

export default function DesktopViewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="desktop-view-fit-scale" strategy="beforeInteractive">
        {FIT_SCALE_SCRIPT}
      </Script>
      {children}
    </>
  );
}
