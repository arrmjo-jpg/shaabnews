/**
 * محرّم تصميم صفحات المقال (Editorial Design Tokens) — SSoT بصري بحت لأنماط
 * العناوين/الفقرة الافتتاحية/الاقتباس/التعليق التوضيحي المستخدمة في مكوّنات
 * `components/articles/blocks/*`. لا منطق بيانات هنا إطلاقاً — ثوابت Tailwind فقط.
 * منقول بصريًّا من المشروع المرجعي (D:\gasem\frontend).
 */

export const editorialTypography = {
  display: 'font-sans font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.1] text-fg',
  h1: 'font-sans font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-tight sm:leading-[1.15] tracking-tight text-fg',
  lead: 'font-sans font-semibold text-[1.1875rem] sm:text-xl md:text-[1.375rem] leading-relaxed text-fg/90 border-r-4 border-primary/50 pr-4 my-6 block',
  body: 'font-serif text-[19px] leading-[1.9] text-fg/95 antialiased font-normal',
  caption:
    'font-sans text-xs text-muted leading-relaxed p-3 bg-surface border-t border-border border-r-4 border-primary flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2',
  meta: 'font-sans text-xs sm:text-sm font-bold text-muted/80 tracking-wide flex flex-wrap items-center gap-1.5',
  quote: 'font-sans text-[1.25rem] sm:text-[1.375rem] font-medium leading-relaxed text-fg bg-primary/5 border-r-4 border-primary p-6 my-8 block',
  aside: 'font-sans text-[10px] sm:text-xs font-extrabold text-muted uppercase tracking-wider',
};

export const editorialSpacing = {
  section: 'mt-12 sm:mt-16 lg:mt-20',
  readingColumn: 'max-w-[680px] mx-auto w-full',
};
