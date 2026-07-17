import { NextResponse } from 'next/server';

// فحص صحّة مخصَّص لحاوية Docker — بلا أي استدعاء cookies()/backend/DB. لا يمسّ الصفحة الرئيسية
// أو أي مسار مُقيَّد بـ ISR إطلاقًا (كانت healthcheck القديمة تضرب `/` مباشرة كل 30 ثانية، وبما
// أنها كانت dynamic بالكامل بسبب cookies() في الهيدر، كانت تُطلق Render كاملاً + عشرات نداءات
// Laravel API في كل نبضة — راجع Root Cause تأخير الأقسام). هذا المسار لا يستخدم أي API ديناميكي
// فيبقى بلا أي عمل فعليّ لكل طلب — أرخص فحص ممكن، ولا يمكن أن يُبطئ أو يُسقِط شيئًا آخر.
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
