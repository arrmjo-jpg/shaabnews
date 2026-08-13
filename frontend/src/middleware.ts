import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// نمط "النسخة الكاملة على الجوّال" — المكان الوحيد لمنطق التوجيه (بلا أي حالة، بلا أي منطق آخر
// هنا سوى القراءة والـrewrite). القرار المعماري الكامل موثَّق بـ docs/desktop-view.md.
//
// **الموقع (src/middleware.ts لا الجذر frontend/middleware.ts) مُتحقَّق منه تجريبيًّا**: مشروع
// بهيكل src/ — next@15.5.19 المُثبَّت هنا لا يكتشف middleware.ts إلا داخل src/ تحديدًا (تأكّدت
// عبر manifest فارغ بالجذر مقابل manifest يعمل صح داخل src/، باختبار حيّ مباشر لا افتراض).
//
// لماذا Middleware لا generateViewport()+cookies(): أي قراءة cookies() داخل مسار الـrender (بما
// فيه generateMetadata/generateViewport) تُخرِج الصفحة كاملة من الـISR الثابت (بلا Partial
// Prerendering، غير مفعَّلة بهذا المشروع) — حادثتان موثَّقتان سابقًا بهذا الكودبيس (site-header.tsx
// القديم كسر ISR للموقع كامل بنفس الطريقة). قراءة الكوكيز هنا بالـMiddleware مختلفة جوهريًّا:
// تصير *قبل* أي رندر React، قرار توجيه بحت — الصفحة الناتجة (تحت /__desktop/*) تبقى ثابتة تمامًا
// ومخزَّنة (ISR) بشكل مستقلّ، بصرف النظر عن كون القرار بالوصول إليها اعتمد على كوكيز.
const COOKIE_NAME = 'acm_site_view';
const DESKTOP_PREFIX = '/desktop-view';

// ROOT CAUSE FIX (قارئ الجريدة الرقمية على new.harer.store يفشل بحظر CORS، مؤكَّد حيًّا
// 2026-08-10): next.config.ts يمرِّر (rewrite) هذه المسارات إلى أصل الـAPI مباشرةً — طلب HTTP
// جديد كليًا من Next نفسه، فيضيع فيه Host الأصلي الذي رآه المتصفّح (new.harer.store). الباك-إند
// يبني كل الروابط المطلقة في صفحات القارئ (@vite، route()) بجذر ذلك الطلب الوارد؛ بلا حقن صريح
// هنا كانت تُبنى بجذر أصل الـAPI نفسه، فتفشل حزمة JS بحظر CORS. نفس أنماط المسارات المُعرَّفة في
// rewrites() بالضبط — لا نغيّر تلك، فقط نحقن الترويسة على الطلب *قبل* أن يصل إليها.
//
// ترويسة مخصَّصة X-Epaper-Frontend-Origin لا X-Forwarded-Host: تحقَّقتُ من إعدادات Traefik
// الفعليّة (قراءة فقط) أن forwardedHeaders في وضعها الافتراضي — يُعيد توليد X-Forwarded-Host
// بنفسه في كل قفزة يُنهيها (يستبدله بدومين تلك القفزة، api-new.harer.store هنا)، فلو استُخدم اسمها
// القياسي لضاعت قيمتنا في قفزة Traefik الثانية أمام الباك-إند. ترويسة عامّة لا يديرها Traefik تمر
// دون تعديل. القيمة نفسها Host/Proto الفعليان لهذا الطلب — كلاهما مؤكَّدان صحيحان عند وصولهما لهذا
// الـmiddleware (Traefik الأولى تحافظ على Host الأصليّ عند التمرير لخدمة frontend، وX-Forwarded-
// Proto مؤكَّد يعمل صح عبر هذه القفزة نفسها من إصلاح PDF السابق). الباك-إند لا يثق بالقيمة كما هي
// أبداً — يقارنها فقط بـFRONTEND_URL المُعدَّة لديه (انظر App\Http\Middleware\ForceReaderPublicRootUrl).
const EPAPER_PROXY_PATTERN = /^\/(ar|en)\/epaper(\/.*)?$|^\/epaper\/stream\/|^\/build\//;

// [تشخيص مؤقت — 2026-08-13، يُزال بعد تحديد المصدر] مسارا التعدّد العالي اللذان يُغرقان
// fetch-cache على القرص (405 ألف ملف / 12GB خلال 4 أيام، 91% منها بيانات لاعبي 365scores).
// ثبت إحصائيًّا زحفٌ منهجيّ على الأرشيف (81% من جلبات المقالات لمعرّفات فريدة)، لكن هوية
// العميل غير معروفة: Traefik access log معطَّل، وسجلّ الباك-إند لا يرى إلا نداءات SSR
// الداخلية (UA: "node"). هذا هو الموضع الوحيد الذي يرى ترويسات العميل الحقيقيّة.
// تسجيل بحت: لا حظر، لا تحويل، لا تعديل على الطلب — يسقط للمنطق القائم أدناه كما هو.
const UA_PROBE_PATTERN = /^\/sport\/player\/|^\/news\//;

// إنفاذ robots.txt على مسار صفحات اللاعبين. قِيس حيًّا (2026-08-13): 518 طلبًا خلال ١٠ دقائق على
// /sport/player من ٥١٤ معرّفًا فريدًا (99.2% تفرّد ⇒ تعداد آليّ لا تصفّح)، **١٠٠٪ بوتات وصفر
// متصفّح بشريّ**. منها ٣٦٩ طلبًا تنتحل Googlebot من خارج نطاقات جوجل (مزرعة وكلاء، ٤٤٥ عنوانًا
// فريدًا خلال ١٠ دقائق ⇒ أي تحديد معدّل لكل IP بلا أثر).
//
// المسار مُستثنى في robots.txt (app/robots.ts)، فأيّ عميل يصل هنا مُعرِّفًا نفسه كزاحف هو —
// بحكم التعريف — لا يحترم robots.txt. لذلك الفحص على الـUA وحده: لا تحقّق من نطاقات IP الخاصة
// بجوجل (قائمة متغيّرة، وخطأ فيها يحجب Googlebot الحقيقيّ ويضرّ الأرشفة). Googlebot الأصيل
// سيتوقّف عن زيارة المسار بنفسه عبر robots.txt، فلا يصله هذا الحظر أصلًا.
//
// جالبات معاينة الروابط الاجتماعية مستثناة: تحمل أسماء تطابق نمط الزواحف لكنها تُستدعى بفعل
// مستخدم حقيقيّ يُشارك رابطًا، وحظرها يكسر بطاقة المعاينة بلا أي مكسب.
const SPORT_PLAYER_PATTERN = /^\/sport\/player\//;
const CRAWLER_UA = /(bot|crawler|spider|scraper|crawl|slurp|preview)/i;
const SOCIAL_PREVIEW_UA = /(facebookexternalhit|Twitterbot|WhatsApp|Slackbot|LinkedInBot|Discordbot|TelegramBot)/i;

export function middleware(request: NextRequest) {
  if (SPORT_PLAYER_PATTERN.test(request.nextUrl.pathname)) {
    const ua = request.headers.get('user-agent') ?? '';
    // 429 لا 403: الرسالة المقصودة "لا نعالج هذا النمط الآليّ" لا "ممنوع عليك". أغلب ما يصل هنا
    // زواحف مشروعة لا عدائيّة (ClaudeBot/Amazonbot/ExaSearchBot)، و429 + Retry-After صيغة
    // تفهمها وتتراجع بها بأدب، بينما 403 قد تُفسَّر كحجب دائم.
    if (CRAWLER_UA.test(ua) && !SOCIAL_PREVIEW_UA.test(ua)) {
      return new NextResponse(null, {
        status: 429,
        headers: { 'Retry-After': '3600' },
      });
    }
  }

  if (UA_PROBE_PATTERN.test(request.nextUrl.pathname)) {
    console.log(
      '[ua-probe]',
      JSON.stringify({
        path: request.nextUrl.pathname,
        ua: request.headers.get('user-agent') ?? '-',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '-',
        at: new Date().toISOString(),
      }),
    );
  }

  if (EPAPER_PROXY_PATTERN.test(request.nextUrl.pathname)) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    const host = request.headers.get('host') ?? request.nextUrl.host;
    const headers = new Headers(request.headers);
    headers.set('x-epaper-frontend-origin', `${proto}://${host}`);
    return NextResponse.next({ request: { headers } });
  }

  if (request.cookies.get(COOKIE_NAME)?.value !== 'desktop') {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `${DESKTOP_PREFIX}${url.pathname}`;
  return NextResponse.rewrite(url);
}

// استثناءات: أصول Next الثابتة، مسارات الـAPI (بما فيها /api/revalidate ووسوم الإعلانات)، وملفات
// الميتاداتا (robots/sitemap/manifest) — لا معنى لـ"نسخة كاملة" لأيّ منها، ولا يجوز تحويل أيّ
// طلب API بالغلط. /desktop-view نفسها مستثناة أيضًا لمنع rewrite لا نهائي لو زارها أحد مباشرة.
//
// ملاحظة تسمية: الاسم الأصلي المقترَح كان `__desktop`، لكن تبيّن بالاختبار الحيّ المباشر (لا
// افتراضًا) أن Next.js يستثني أيّ مجلّد باسم يبدأ بـ`_` من التوجيه كليًّا (اصطلاح "Private Folders"
// الرسمي) — فكان المسار يعطي 404 دائمًا بصرف النظر عن الـcache. لذا استُبدل بـ`desktop-view` (بلا
// شرطة سفلية بادئة)، وهو اسم مسار غير محتمل التصادم مع أيّ slug تصنيف/مقال حقيقي بالموقع.
export const config = {
  matcher: [
    '/((?!_next/|api/|desktop-view/|robots\\.txt|manifest\\.webmanifest|sitemap|.*\\.xml$).*)',
  ],
};
