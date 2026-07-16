/**
 * نقطة استقبال RUM — استقبال بسيط + تسجيل. استبدل console/log بإرسال فعلي
 * لأي أداة تحليلات لديكم لاحقاً (Cloudflare Web Analytics، جدول DB،
 * أو حتى forward إلى Laravel Pulse عبر custom recorder). الأبسط أولاً:
 * اجمع القياسات في السجلات لأسبوع، ثم قرّر أين تُخزَّن بشكل دائم.
 *
 * ضع هذا الملف في: frontend/src/app/api/rum/route.ts
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface WebVitalPayload {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  id: string;
  navigationType: string;
  path: string;
  ts: number;
}

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as WebVitalPayload;

    // تسجيل منظَّم (structured log) — سهل التصفية لاحقاً بأي أداة سجلّات:
    console.log(
      JSON.stringify({
        event: "rum.web_vital",
        metric: data.name,
        value: Math.round(data.value * 100) / 100,
        rating: data.rating,
        path: data.path,
        navigationType: data.navigationType,
        ts: data.ts,
      })
    );

    // إشارة صريحة عند رصد قيمة "poor" على صفحة مقال — يربط مباشرة بادّعاء
    // "73 <img> خام يضعف LCP/CLS" من التقرير الأول؛ راقب هذا التحديداً
    // على مسارات /articles و/videos و/reels حيث تتركز الصور الخام:
    if (data.rating === "poor" && (data.name === "LCP" || data.name === "CLS")) {
      console.warn(
        JSON.stringify({
          event: "rum.poor_web_vital",
          metric: data.name,
          value: data.value,
          path: data.path,
        })
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    // فشل صامت متعمَّد — لا تُفشل تجربة المستخدم أبداً بسبب خطأ في القياس
    // نفسه (نفس فلسفة rescue() في ArticleCdnPurge بالـ Backend).
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
