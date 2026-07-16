import Link from 'next/link';

import { Container } from '@/components/layout/container';

// Branded 404 — renders inside (site)/layout.tsx, so header/nav/footer stay intact around it.
// Hit by every notFound() call in this route group (article/video/category/static-page/sport/etc.)
// plus any unmatched URL under the site chrome.
export default function NotFound() {
  return (
    <Container className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-24 text-center">
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
    </Container>
  );
}
