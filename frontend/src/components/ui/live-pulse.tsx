// أيقونة «بثّ مباشر» تنبض — **مصدر واحد** لكلّ شارات «تغطية خاصة/مباشر» في صفحات المقال.
// ثلاث طبقات: حلقة رادار تتمدّد وتتلاشى (animate-ping) + حلقة ساكنة دائمة + نقطة مركزيّة.
// الدوائر مدوّرة بـ inline borderRadius (تتجاوز قاعدة «حوافّ قائمة» العامّة في globals.css)؛ اللون أبيض افتراضيًّا.
// منقول بصريًّا كما هو من المشروع المرجعي (D:\gasem\frontend) — مكوّن عرض بحت بلا أي منطق بيانات.
export function LivePulse({ color = '#ffffff' }: { color?: string }) {
  return (
    <span className="relative flex size-3 shrink-0 items-center justify-center" aria-hidden>
      <span
        className="absolute inset-0 inline-flex animate-ping"
        style={{ borderRadius: '9999px', border: `1.5px solid ${color}`, opacity: 0.75 }}
      />
      <span
        className="absolute inset-0 inline-flex"
        style={{ borderRadius: '9999px', border: `1.5px solid ${color}`, opacity: 0.5 }}
      />
      <span className="relative inline-flex size-[6px]" style={{ borderRadius: '9999px', background: color }} />
    </span>
  );
}
