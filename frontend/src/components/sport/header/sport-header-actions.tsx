import { SearchIcon } from '@/components/icons';

// Phase 2.2 Commit 2 — أزرار ثابتة (بحث/مظهر): بنية بصريّة فقط، `disabled`، بلا أي حالة أو منطق.
// البحث يُفعَّل مع ميزة البحث الرياضيّ لاحقاً (خارج نطاق هذا الـCommit)؛ المظهر يُفعَّل مع نظام
// الثيم في Commit منفصل لاحق. لا أيقونة ثيم جديدة أُضيفت لملف الأيقونات المركزيّ — بدلاً منها
// شكل دائريّ نصفيّ بسيط (CSS) يرمز للفاتح/الداكن دون الحاجة لأيقونة جديدة.
export function SportHeaderActions() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        disabled
        aria-label="البحث (قريبًا)"
        className="flex size-9 items-center justify-center rounded-md text-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SearchIcon className="size-[18px]" aria-hidden />
      </button>
      <button
        type="button"
        disabled
        aria-label="تبديل المظهر (قريبًا)"
        className="flex size-9 items-center justify-center rounded-md text-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className="block size-4 rounded-full border border-current"
          style={{ backgroundImage: 'linear-gradient(90deg, currentColor 50%, transparent 50%)' }}
          aria-hidden
        />
      </button>
    </div>
  );
}
