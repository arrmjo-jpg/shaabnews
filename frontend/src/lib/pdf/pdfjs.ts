// مُحمِّل pdf.js (عميل فقط): استيراد ديناميكيّ يُبقي المكتبة خارج حزمة الخادم/التحميل الأوّل،
// ويضبط العامل المُستضاف ذاتيّاً مرّة واحدة (موثوق عبر webpack/Next بلا اعتماد CDN للعامل).
// مُشترك بين كلّ مكوّنات القارئ كي تُحمَّل المكتبة + العامل نسخةً واحدة.
let cached: Promise<typeof import('pdfjs-dist')> | null = null;

export function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  cached ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
    return pdfjs;
  });
  return cached;
}

// cMaps + خطوط احتياطيّة — تُستعمَل حين يشير الـ PDF لخطوط/ترميزات غير مضمَّنة بالكامل
// (Identity-H). كانت مُشارة سابقاً إلى unpkg.com (CDN خارجي) — وهذا بالضبط ما كان يُنتج
// عربية مكسورة في القارئ عند تعذّر الوصول لذلك الـ CDN (لوحة الإدارة لا تتأثّر لأنها لا
// تستخدم PDF.js إطلاقاً، بل عارض PDF المدمَّج بالمتصفح). مستضافة الآن محلياً في
// public/pdf/ (نُسخت حرفياً من node_modules/pdfjs-dist بنفس الإصدار أدناه — بلا أي CDN)،
// بنفس معالجة pdf.worker.min.mjs أعلاه تماماً.
export const PDF_CMAP_URL = '/pdf/cmaps/';
export const PDF_STANDARD_FONTS_URL = '/pdf/standard_fonts/';
