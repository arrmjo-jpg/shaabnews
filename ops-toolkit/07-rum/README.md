# RUM (Real User Monitoring) — قياس Core Web Vitals من زوّار حقيقيين

كلا التقريرين اعتمدا على استدلال ثابت (فحص next.config.js، next/font،
generateMetadata) لتقييم LCP/CLS/INP — لا رقماً واحداً من متصفح مستخدم
حقيقي. Lighthouse نفسه يقيس صفحة واحدة في بيئة معملية، لا التوزيع الفعلي
عبر آلاف الأجهزة/الشبكات الحقيقية. هذان الملفان يسدّان هذه الفجوة تحديداً
لادّعاء "73 استخدام <img> خام يضعف Core Web Vitals" — حوّله لرقم حقيقي.

## الملفات

- `web-vitals-reporter.tsx` — مكوّن عميل صغير يُسجَّل مرة واحدة في
  `app/layout.tsx` الجذري، يستخدم مكتبة `web-vitals` الرسمية (من فريق
  Chrome) لالتقاط LCP/CLS/INP/TTFB/FCP من كل زيارة حقيقية.
- `rum-route.ts` — نقطة استقبال API بسيطة (ضعها في
  `frontend/src/app/api/rum/route.ts`) تستقبل القياسات وتسجّلها — بأبسط
  صورة ممكنة (سجلّ نصي) قابلة للاستبدال لاحقاً بإرسالها إلى أي أداة
  تحليلات موجودة فعلاً (Cloudflare Web Analytics، Vercel Analytics، أو
  حتى جدول DB بسيط).

## التركيب (لا يُطبَّق تلقائياً — قرار تعديل الكود الحي يعود لفريقكم)

```bash
cd frontend
npm install web-vitals
```

1. انسخ `web-vitals-reporter.tsx` إلى `frontend/src/components/rum/`.
2. انسخ `rum-route.ts` إلى `frontend/src/app/api/rum/route.ts`.
3. أضف سطراً واحداً في `frontend/src/app/layout.tsx` (داخل `<body>`،
   بجانب أي مكوّنات عميل أخرى موجودة أصلاً مثل resource-hints):

```tsx
import { WebVitalsReporter } from '@/components/rum/web-vitals-reporter';
// ...
<WebVitalsReporter />
```

## لماذا هذا يحسم السؤال بدل Lighthouse وحده

Lighthouse يقيس جهازاً افتراضياً واحداً بشبكة محاكاة واحدة. RUM يجمع من
كل زائر حقيقي فعلياً — يكشف مثلاً إن كان ضعف LCP يظهر فقط على الجوال في
مناطق شبكة بطيئة (حيث تأثير عدم استخدام next/image الأكبر فعلياً) أم
موزّعاً بالتساوي. اجمع بيانات أسبوع واحد على الأقل قبل الحكم — يوم واحد
غير كافٍ إحصائياً.
