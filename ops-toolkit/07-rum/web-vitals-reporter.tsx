"use client";

/**
 * WebVitalsReporter — يلتقط Core Web Vitals من كل زيارة حقيقية ويرسلها
 * لنقطة استقبال داخلية (/api/rum). راجع README.md في هذا المجلد لخطوات
 * التركيب — هذا الملف تسليم جاهز، لم يُدرَج بعد في التطبيق الحي.
 *
 * لماذا مكوّن عميل صغير منفصل بدل استخدام useReportWebVitals من Next.js
 * مباشرة في كل صفحة: نقطة تسجيل واحدة في layout.tsx الجذري تكفي لكل
 * الموقع، ولا تتكرر الحاجة لإضافتها يدوياً في كل صفحة جديدة مستقبلاً.
 */

import { useEffect } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

const ENDPOINT = "/api/rum";

function send(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // "good" | "needs-improvement" | "poor" — تصنيف Google الرسمي
    id: metric.id,
    navigationType: metric.navigationType,
    path: typeof window !== "undefined" ? window.location.pathname : "",
    ts: Date.now(),
  });

  // sendBeacon لا يحجب التنقّل ولا يُفقَد عند إغلاق التبويب — الطريقة
  // الموصى بها رسمياً لهذا النوع من التقارير غير الحرجة (fire-and-forget،
  // نفس فلسفة ArticleCdnPurge في الـ Backend).
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, body);
  } else {
    fetch(ENDPOINT, { body, method: "POST", keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  }
}

export function WebVitalsReporter() {
  useEffect(() => {
    onLCP(send);   // Largest Contentful Paint — الأكثر تأثراً المُتوقَّع بمشكلة <img> الخام
    onCLS(send);   // Cumulative Layout Shift — يتأثر إن كانت الصور بلا أبعاد محجوزة
    onINP(send);   // Interaction to Next Paint — يحل محل FID كمقياس رسمي حديث
    onFCP(send);
    onTTFB(send);  // Time to First Byte — يعكس زمن استجابة الـ Backend نفسه (مرتبط بالقسم 6 من التقرير)
  }, []);

  return null;
}
