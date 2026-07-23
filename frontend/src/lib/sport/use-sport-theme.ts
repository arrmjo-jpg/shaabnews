'use client';

import { useCallback, useEffect, useState } from 'react';

import { writeSportThemeCookie, type SportTheme } from './theme-cookie';

// Sprint 1.7 Phase T2 — لا Context/Provider هنا بقرار: المستهلك الوحيد فعليًّا هو زرّ التبديل
// (Phase T3)؛ تبديل الشعار/الألوان لبقيّة المكوّنات (SportLogo/SportFooter) يتمّ بالكامل عبر
// محدِّدات CSS على [data-sport-theme] (نفس أسلوب .reels-logo-light/dark، لا React). القاعدة
// المعماريّة المُقفَلة: [data-sport-theme] على <html> هو مصدر الحقيقة أثناء التشغيل؛ هذا الـHook
// **لا يملك حالة بمعزل عنه** — useState هنا مجرّد مرآة تُعاد مزامنتها من السمة، لا مصدر مستقلّ.
const ATTR = 'data-sport-theme';
const SYNC_EVENT = 'sport-theme-change';

function readAttr(): SportTheme {
  return document.documentElement.getAttribute(ATTR) === 'light' ? 'light' : 'dark';
}

export function useSportTheme(cookieName: string): {
  theme: SportTheme;
  ready: boolean;
  setTheme: (next: SportTheme) => void;
} {
  const [theme, setThemeState] = useState<SportTheme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setThemeState(readAttr());
    setReady(true);
    const sync = () => setThemeState(readAttr());
    window.addEventListener(SYNC_EVENT, sync);
    return () => window.removeEventListener(SYNC_EVENT, sync);
  }, []);

  // الترتيب مقصود: السمة أوّلاً (الحقيقة أثناء التشغيل)، ثمّ الكوكي (تخزين فقط)، ثمّ الحدث
  // (مزامنة أيّ مستهلك آخر حيّ لاحقًا) — لا تُقلَب هذه الخطوات.
  const setTheme = useCallback(
    (next: SportTheme) => {
      document.documentElement.setAttribute(ATTR, next);
      writeSportThemeCookie(cookieName, next);
      window.dispatchEvent(new Event(SYNC_EVENT));
    },
    [cookieName],
  );

  return { theme, ready, setTheme };
}
