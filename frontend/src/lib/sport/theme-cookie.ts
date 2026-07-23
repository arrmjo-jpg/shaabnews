// تخزين ثيم الرياضة (Sprint 1.7 — ADR: Cookie، قراءة/كتابة من العميل فقط، أبداً عبر
// cookies()/next-headers داخل Server Component — راجع use-auth-session.ts للحادثة الموثَّقة
// (كسر ISR) التي يمنعها هذا القيد). [data-sport-theme] على <html> هو مصدر الحقيقة أثناء
// التشغيل (Runtime Source of Truth)؛ هذا الملف طبقة تخزين فقط، لا يملك حالة بنفسه.
export type SportTheme = 'light' | 'dark';

export const DEFAULT_SPORT_THEME_COOKIE = 'sport_theme';

function isSportTheme(value: string | null): value is SportTheme {
  return value === 'light' || value === 'dark';
}

// يُستدعى فقط من (sport)/layout.tsx (Server Component) لبناء نصّ سكربت ما-قبل-الرسم —
// لا ينفّذ هنا، فلا حاجة لأي شيء متصفّحيّ. القيم قادمة من getSiteSettings() (إعداد إداريّ،
// وليست كوكي مستخدم فرديّ) ولذا JSON.stringify كافٍ لتضمينها بأمان داخل نص جافاسكربت.
export function buildThemeBootstrapScript(cookieName: string, defaultTheme: string): string {
  const safeCookieName = JSON.stringify(cookieName);
  const safeDefault = JSON.stringify(defaultTheme);
  return (
    `(function(){try{` +
    `var n=${safeCookieName};var d=${safeDefault};` +
    `var esc=n.replace(/([.$?*|{}()[\\]\\\\/+^])/g,'\\\\$1');` +
    `var m=document.cookie.match(new RegExp('(?:^|; )'+esc+'=([^;]*)'));` +
    `var t=m?decodeURIComponent(m[1]):null;` +
    `if(t!=='light'&&t!=='dark'){` +
    `t=(d==='light'||d==='dark')?d:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');` +
    `}` +
    `document.documentElement.setAttribute('data-sport-theme',t);` +
    `}catch(e){}})();`
  );
}

// قراءة/كتابة من العميل فقط (تُستدعى من useSportTheme لاحقاً، Phase T2) — لا تُستدعى أبداً
// من Server Component. القراءة تُطابق منطق سكربت التهيئة أعلاه (نفس شرط isSportTheme).
export function readSportThemeCookie(cookieName: string): SportTheme | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return isSportTheme(value) ? value : null;
}

export function writeSportThemeCookie(cookieName: string, theme: SportTheme): void {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${cookieName}=${theme}; path=/; max-age=${oneYear}; SameSite=Lax`;
}
