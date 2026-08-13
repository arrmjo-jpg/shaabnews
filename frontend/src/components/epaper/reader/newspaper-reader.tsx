'use client';

import { ArrowRight, Download } from 'lucide-react';
import Link from 'next/link';

// ROOT CAUSE FIX 2026-08-11: كان هذا المكوّن يُصيِّر الـPDF عبر pdf.js (Canvas) —
// ReaderCanvasPage/usePdfDocument (pdfjs-dist 5.7.284). أثبتنا حيًّا (نفس الملف، نفس
// SHA-256، نفس العدد 914-4186) أن pdf.js نفسه يرسم الحروف العربية بأشكالها المعزولة بدل
// السياقية المتّصلة — عطل داخل محرّك الرسم، لا في الملف ولا في cMaps/الخطوط/الـworker (كلها
// كانت سليمة ومُقدَّمة محليًّا بنجاح). عارض PDF الأصلي بالمتصفح (الذي يستخدمه Admin عبر رابط
// خام) يعرض نفس الملف بعربية سليمة تمامًا — مؤكَّد أيضًا بمُصيِّر PDF مستقل (PyMuPDF).
//
// الإصلاح: استبدال Canvas/pdf.js بـ<iframe> عبر عارض المتصفح الأصلي.
//
// تحديث 2026-08-13 (إصلاح أداء): src يشير الآن مباشرة إلى Laravel
// (EpaperDocumentController::document)، لا عبر وكيل Next.js. اكتُشِف أن ذلك الوكيل
// كان يمرّر ReadableStream خامًا من fetch() مباشرة كجسم Response — نمط تسبّب بخطأ
// متكرّر ("controller[kState].transformAlgorithm is not a function") استهلك 150-260%
// CPU باستمرار على حاوية frontend وأدّى لانقطاع فعلي (503). تبيّن أن الوكيل لم يكن
// ضروريًا أصلًا: EpaperDocumentController::document() لا يبثّ PDF بنفسه — يفحص canView
// ثم يُعيد 302 لرابط R2/S3 موقَّت (أصل مختلف). التحويل عبر <iframe> (تنقّل متصفّح) لا
// يخضع لقيد CORS إطلاقًا (خلافًا لـfetch()/XHR) — فلا حاجة لأي وكيل خادميّ من الأساس.
// الحماية (canView/newspaper.enabled/throttle) تبقى مفروضة بالكامل من Laravel كما هي.
//
// ملفات pdf.js القديمة (reader-canvas-page.tsx، use-pdf-document.ts، reader-thumbnails.tsx،
// reader-toolbar.tsx، reader-mobile-bar.tsx، use-reading-memory.ts، lib/pdf/pdfjs.ts) أُبقيت
// على القرص بلا حذف — فقط توقّف استدعاؤها من هنا. الميزات المخصَّصة (تكبير، تقليب صفحات،
// دوران، مصغّرات، ملء شاشة مخصَّص، استئناف محليّ) غير متاحة في هذا الإصلاح المرحلي —
// الأولوية: عربية سليمة + فتح PDF + حماية سليمة، لا تكافؤ ميزات كامل.
interface NewspaperReaderProps {
  src: string; // رابط Laravel المباشر: {apiBaseUrl}/ar/epaper/{id}-doc/document
  storageId: string;
  title: string;
  backHref: string;
  downloadUrl: string | null;
}

const btn =
  'inline-flex size-9 items-center justify-center rounded-sm text-neutral-200 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40';

export function NewspaperReader({ src, title, backHref, downloadUrl }: NewspaperReaderProps) {
  return (
    <div className="flex h-dvh flex-col bg-[#111111]">
      <header
        dir="rtl"
        className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#1a1a1a] px-3 text-neutral-200"
      >
        <Link href={backHref} aria-label="رجوع إلى الأعداد" className={btn}>
          <ArrowRight className="size-5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">{title}</h1>
        {downloadUrl ? (
          <a href={downloadUrl} aria-label="تنزيل" title="تنزيل" className={btn}>
            <Download className="size-5" aria-hidden />
          </a>
        ) : null}
      </header>

      <iframe src={src} title={title} className="w-full min-h-0 flex-1 border-0 bg-white" />
    </div>
  );
}
