import { SearchIcon } from '@/components/icons';

// Phase 2.2 Commit 2 (بنية) + Commit 3 (ربط `allow_theme_switch` فقط): أزرار ثابتة، `disabled`،
// بلا أي حالة أو منطق تفاعليّ. البحث يُفعَّل مع ميزة البحث الرياضيّ لاحقاً (خارج نطاق هذا الـCommit).
// زرّ المظهر يظهر/يختفي بحسب `sport.allow_theme_switch` من Public Sport Settings — لا Theme
// Persistence ولا Provider هنا، القيمة تتحكّم فقط بالعرض/الإخفاء. لا أيقونة ثيم جديدة أُضيفت لملف
// الأيقونات المركزيّ (خارج ملفات هذا الـCommit) — بدلاً منها شكل دائريّ نصفيّ بسيط (CSS).
export function SportHeaderActions({ allowThemeSwitch }: { allowThemeSwitch: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        disabled
        aria-label="البحث (قريبًا)"
        className="flex size-9 items-center justify-center rounded-md text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SearchIcon className="size-[18px]" aria-hidden />
      </button>
      {allowThemeSwitch && (
        <button
          type="button"
          disabled
          aria-label="تبديل المظهر (قريبًا)"
          className="flex size-9 items-center justify-center rounded-md text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className="block size-4 rounded-full border border-current"
            style={{ backgroundImage: 'linear-gradient(90deg, currentColor 50%, transparent 50%)' }}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
