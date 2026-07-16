import Link from 'next/link';

// Root-level 404 — catches unmatched URLs outside every route group ((site), (reels)), e.g. under
// /newspaper/*. No site chrome here (root layout is a bare shell), so this stays self-contained.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-extrabold tracking-wide text-primary">404</p>
      <h1 className="text-2xl font-black text-fg sm:text-3xl">الصفحة غير موجودة</h1>
      <p className="max-w-md text-sm text-muted">
        الرابط الذي وصلت إليه غير موجود أو تمّ نقله أو حذفه.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        العودة إلى الصفحة الرئيسية
      </Link>
    </div>
  );
}
