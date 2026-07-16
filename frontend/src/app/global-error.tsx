'use client';

import { useEffect } from 'react';

// Last-resort error boundary — only fires when the ROOT layout itself throws (page/segment errors
// are caught by (site)/error.tsx or (reels) equivalents first). Must render its own <html>/<body>
// since it replaces the root layout entirely; deliberately has no fonts/providers so it can render
// even if those failed.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ display: 'flex', minHeight: '100dvh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900 }}>حدث خطأ غير متوقّع</h1>
        <p style={{ maxWidth: '28rem', fontSize: '0.875rem', opacity: 0.7 }}>
          تعذّر تحميل الموقع. حاول مرّة أخرى بعد قليل.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ borderRadius: '0.375rem', padding: '0.625rem 1.25rem', fontSize: '0.875rem', fontWeight: 700, background: '#b91c1c', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
