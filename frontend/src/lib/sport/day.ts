// مساعِدات تاريخ نقيّة لفلتر أيّام /sport (لا server-only — يُستعمل في مكوّن خادميّ + طبقة البيانات).
// «اليوم» بتوقيت عمّان (مهمّ: قبل منتصف الليل UTC قد يختلف اليوم المحليّ عن UTC). الصيغة الداخليّة YYYY-MM-DD.

const TZ = 'Asia/Amman';

/** تاريخ اليوم (YYYY-MM-DD) بتوقيت عمّان. */
export function todayAmman(): string {
  // en-CA يُخرج ISO ‎YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

/** إزاحة يوم (YYYY-MM-DD) بعدد أيّام؛ ظهيرة UTC لتفادي مشاكل التوقيت الصيفيّ. */
export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → DD/MM/YYYY (صيغة بارامتر تاريخ 365). */
export function ymdToDmy(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/** تحقّق صارم من الصيغة + أنّه تاريخ حقيقيّ (يمنع حقن مدخلات في الـAPI). */
export function isValidYmd(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** فرق الأيّام بين تاريخين (b − a) بالأيّام التقويميّة. */
export function diffDays(a: string, b: string): number {
  const u = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d, 12);
  };
  return Math.round((u(b) - u(a)) / 86_400_000);
}

/** وسم اليوم: أمس/اليوم/غداً وإلا اسم اليوم؛ مع تاريخ مقروء (٨ يونيو) وتاريخ كامل بالسنة. */
export function dayParts(
  ymd: string,
  today: string,
): { label: string; date: string; fullDate: string; weekday: string } {
  const diff = diffDays(today, ymd);
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = new Intl.DateTimeFormat('ar', { weekday: 'long', timeZone: 'UTC' }).format(dt);
  const date = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(dt);
  const fullDate = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt);
  const label = diff === -1 ? 'أمس' : diff === 0 ? 'اليوم' : diff === 1 ? 'غداً' : weekday;
  return { label, date, fullDate, weekday };
}

/** إزاحة شهر كامل (لتنقّل التقويم المنبثق بين الأشهر) — يُثبَّت على اليوم 1 لتفادي انزلاق يوم النهاية
    (مثال: 31 يناير + شهر ≠ نهاية فبراير تلقائيًّا لو أُزيح اليوم الفعليّ مباشرة). */
export function addMonths(ymd: string, months: number): string {
  const [y, m] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  return dt.toISOString().slice(0, 10);
}

/** تسمية الشهر/السنة للتقويم المنبثق (مثال: "يوليو ٢٠٢٦"). */
export function monthLabel(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1, 12));
  return new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt);
}

/** رؤوس أيّام الأسبوع مختصرة، الأحد أوّلاً (اصطلاح المنطقة/عمّان) — مُشتَقّة من Intl لا نصوص ثابتة. */
export function weekdayShortLabels(): string[] {
  const sunday = Date.UTC(2023, 0, 1, 12); // 1 يناير 2023 كان أحدًا — مرجع ثابت آمن، لا علاقة بالسنة الحاليّة
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat('ar', { weekday: 'short', timeZone: 'UTC' }).format(new Date(sunday + i * 86_400_000)),
  );
}

export interface MonthGridCell {
  ymd: string;
  inMonth: boolean;
}

/** شبكة تقويم الشهر (أسابيع × 7 أيّام، الأحد أوّلاً) لأيّ يوم ضمن الشهر — تُكمِل أطراف الشهر بأيّام
    الشهرين المجاورين (inMonth=false) لملء أسابيع كاملة، بلا أي منطق جلب/شبكة، حساب تقويميّ صرف. */
export function monthGrid(ymd: string): MonthGridCell[][] {
  const [y, m] = ymd.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  const firstWeekday = first.getUTCDay(); // 0 = الأحد
  const daysInMonth = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();

  const cells: MonthGridCell[] = [];
  for (let i = firstWeekday; i > 0; i--) {
    cells.push({ ymd: shiftYmd(first.toISOString().slice(0, 10), -i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ ymd: new Date(Date.UTC(y, m - 1, d, 12)).toISOString().slice(0, 10), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ ymd: shiftYmd(cells[cells.length - 1].ymd, 1), inMonth: false });
  }

  const weeks: MonthGridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
