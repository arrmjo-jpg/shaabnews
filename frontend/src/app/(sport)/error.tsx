'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Container } from '@/components/layout/container';

// Phase 2.2 Commit 1 — Sport's own error boundary, added in the same commit as the route-group
// move (not a follow-up), per the ADR's flagged risk: (site)/error.tsx is scoped to that group
// and does not cover routes outside it. Renders inside (sport)/layout.tsx, so SportHeader/Footer
// stay intact around it, same pattern as the News boundary this mirrors.
export default function SportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-sm font-extrabold tracking-wide text-primary">حدث خطأ</p>
      <h1 className="text-2xl font-black text-fg sm:text-3xl">تعذّر تحميل الصفحة</h1>
      <p className="max-w-md text-sm text-muted">
        حدث خطأ غير متوقّع أثناء تحميل هذه الصفحة. حاول مرّة أخرى، وإن استمرّت المشكلة عد لاحقًا.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          إعادة المحاولة
        </button>
        <Link
          href="/sport"
          className="inline-flex items-center justify-center rounded-md border border-border px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:bg-surface-2"
        >
          الرياضة
        </Link>
      </div>
    </Container>
  );
}
