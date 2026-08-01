import type { Viewport } from 'next';

// جذر شجرة "النسخة الكاملة" — المكان الوحيد الذي يضبط viewport العريض (Metadata API الرسمية،
// مُحلَّلة وقت الطلب/البناء بالسيرفر — لا سكربت، لا تعديل بعد الـHydration إطلاقًا). التفاصيل
// المعمارية الكاملة بـdocs/desktop-view.md. لا شيء آخر هنا سوى تمرير children — كل حاويات
// الموقع (SiteHeader/Footer/الأقسام...) تبقى بمكانها الأصليّ (site)/(sport)/(reels)، معاد
// تصديرها بلا تكرار منطق عبر ملفات stub تحت هذا المسار.
export const viewport: Viewport = {
  width: 1280,
  initialScale: 1,
  userScalable: true,
};

export default function DesktopViewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
