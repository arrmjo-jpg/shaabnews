import Link from 'next/link';

// Branded 404 scoped to the reels shell (dark/light via [data-reels-theme], no site header/footer —
// matches (reels)/layout.tsx's independent full-screen chrome).
export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center text-[var(--rl-fg)]">
      <p className="text-sm font-extrabold tracking-wide text-primary">404</p>
      <h1 className="text-2xl font-black sm:text-3xl">الريل غير موجود</h1>
      <p className="max-w-md text-sm text-[var(--rl-muted)]">
        الرابط الذي وصلت إليه غير موجود أو تمّ حذفه.
      </p>
      <Link
        href="/reels"
        className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        العودة إلى الريلز
      </Link>
    </div>
  );
}
