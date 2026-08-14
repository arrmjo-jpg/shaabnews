'use client';

import { useEffect, useState } from 'react';

import { LeagueMatchesTicker } from '@/components/sport/league-matches-ticker';
import type { SportMatch } from '@/lib/sport/games';

// غلاف رقيق حول LeagueMatchesTicker — لا يغيّر تصميمه ولا يمرّر إليه شيئًا سوى البيانات نفسها.
// سبب وجوده معماريّ بحت: الشريط يعيش في (site)/layout.tsx المشترك، وجلبته الخادميّة
// ‎revalidate: 60‎ كانت تستبدل revalidate المسار (patch-fetch.js:775) فتصير سقفًا لكاش كلّ صفحات
// المجموعة. جلبه من العميل يفكّ الارتباط: الصفحة تستعيد أعلى قيمة تسمح بها بقيّة جلباتها،
// والشريط يبقى طازجًا ≤60ث عبر كاش /api/match-bar.
//
// جلبة واحدة عند التركيب — لا polling ولا setInterval. والـlayout لا يُعاد تركيبه عبر التنقّل
// الداخليّ في (site)، فهي مرّة واحدة لكلّ تحميل كامل للصفحة لا مع كلّ تنقّل.
//
// فشل أو إجهاض ⇒ [] ⇒ لا شريط: نفس عزل الفشل المتّبع في getMatchBar (enabled:false أو أيّ
// خطأ ⇒ []). و[] هي أيضًا حالة الإنتاج الحاليّة (match-bar معطَّل من الـCMS)، فلا فرق بصريّ.
export function LeagueMatchesTickerLive() {
  const [matches, setMatches] = useState<SportMatch[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/match-bar', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { matches?: unknown } | null) => {
        if (Array.isArray(d?.matches)) setMatches(d.matches as SportMatch[]);
      })
      .catch(() => {
        // تجاهل: الحالة الابتدائيّة [] هي بالفعل «لا شريط».
      });
    return () => controller.abort();
  }, []);

  // [] ⇒ LeagueMatchesTicker يرجع null بنفسه (السطر 29 هناك) ⇒ صفر DOM وصفر ارتفاع، وهو
  // سلوكه القائم اليوم حين لا مباريات. لا حاجز مساحة هنا: الشريط معطَّل حاليًّا فحجز ارتفاع
  // ثمّ طيّه عند وصول [] كان سيُدخل إزاحة تخطيط في 100% من التحميلات بدل أن يمنعها.
  return <LeagueMatchesTicker matches={matches} />;
}
