'use client';

import { Check, Share2 } from 'lucide-react';
import { useState } from 'react';

// زرّ مشاركة — Web Share API (الجوّال) ثمّ نسخ الرابط (سطح المكتب). يقرأ رابط الصفحة الحاليّ وقت النقر (عميل).
// لا بيانات وهمية؛ يشارك الرابط الفعليّ.
export function VideoShare({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url = window.location.href;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* ألغى المستخدم المشاركة */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* لا حافظة متاحة */
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      className="inline-flex items-center gap-2 bg-surface-2 px-4 py-2 text-sm font-bold text-fg transition-colors hover:bg-surface-3"
    >
      {copied ? <Check className="size-4 text-success" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      {copied ? 'تمّ نسخ الرابط' : 'مشاركة'}
    </button>
  );
}
