'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getClientId } from '@/lib/client-id';

interface Props {
  /** card = صندوق رأسيّ داخل الخبر · bar = شريط أفقيّ بعرض الموقع (الرئيسية). */
  variant?: 'card' | 'bar';
  termsHref?: string | null;
  termsLabel?: string | null;
  privacyHref?: string | null;
  privacyLabel?: string | null;
}

// صندوق الاشتراك في واتساب — منطق واحد (state + تحقّق + إرسال BFF /api/whatsapp/subscribe)
// بتخطيطين: card رأسيّ داخل الخبر، bar أفقيّ بعرض الموقع أسفل «آخر المستجدات» بالرئيسية.
// النطاق: الاسم + phone فقط. الألوان توكنات الموقع (ثيم/داكن/white-label). التحقّق محلّيّ أردنيّ
// (7XXXXXXXX) ثمّ يُبنى +962؛ الخادم يطبّع/يتحقّق E.164 نهائيًّا.
export function SubscribeBox({ variant = 'card', termsHref, termsLabel, privacyHref, privacyLabel }: Props) {
  const nameId = useId();
  const phoneId = useId();

  const [closed, setClosed] = useState(false);
  const [name, setName] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (closed) return null;

  function validate(): boolean {
    if (!name.trim()) {
      setErrorMsg('يرجى إدخال الاسم الكريم');
      return false;
    }
    const digits = localPhone.replace(/\D/g, '');
    if (!/^7\d{8}$/.test(digits)) {
      setErrorMsg('يرجى إدخال رقم واتساب صحيح');
      return false;
    }
    setErrorMsg('');
    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() },
        body: JSON.stringify({ name: name.trim(), phone: '+962' + localPhone.replace(/\D/g, '') }),
      });
      const data: { success?: boolean; message?: string } = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setErrorMsg(data.message || 'تعذّر الاشتراك. تحقّق من البيانات المُدخلة.');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    } catch {
      setErrorMsg('حدث خطأ في الاتصال، يرجى المحاولة لاحقاً.');
      setLoading(false);
    }
  }

  const fieldClass =
    'h-14 w-full border border-border bg-surface px-4 font-bold text-fg outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary';

  // حقول مشتركة بين التخطيطين (مربوطة بنفس الـ state — لا تكرار منطق).
  const nameField = (
    <>
      <label htmlFor={nameId} className="sr-only">الاسم</label>
      <input
        id={nameId}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="أدخل الاسم الكريم *"
        maxLength={150}
        autoComplete="name"
        className={fieldClass}
      />
    </>
  );

  const phoneField = (
    <div className="flex h-14 overflow-hidden border border-border bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <div className="flex items-center border-s border-border bg-surface-2 px-4 text-lg font-black text-fg" dir="ltr">
        +962
      </div>
      <label htmlFor={phoneId} className="sr-only">رقم الواتساب</label>
      <input
        id={phoneId}
        type="tel"
        inputMode="numeric"
        value={localPhone}
        onChange={(e) => setLocalPhone(e.target.value)}
        placeholder="* أدخل رقم الواتساب"
        maxLength={9}
        autoComplete="tel-national"
        className="w-full bg-transparent px-4 text-end font-bold text-fg outline-none placeholder:text-muted"
      />
    </div>
  );

  const closeButton = (
    <button
      type="button"
      onClick={() => setClosed(true)}
      aria-label="إغلاق"
      className="absolute end-4 top-4 text-muted transition-colors hover:text-fg"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );

  const successCard = (
    <div role="status" className="border border-success/30 bg-success/10 px-4 py-4 text-center font-black text-success">
      تم الاشتراك بنجاح ✅
    </div>
  );

  // ── النسخة الأفقيّة (bar) — بعرض الموقع، أسفل «آخر المستجدات» بالرئيسية ──────────
  if (variant === 'bar') {
    return (
      <section dir="rtl" className="mt-8" aria-labelledby="wa-bar-heading">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="relative border border-border bg-surface-2 p-5 md:p-6">
            {closeButton}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
              <div className="pe-6 lg:flex-1 lg:pe-0">
                <h2 id="wa-bar-heading" className="text-xl font-black text-fg sm:text-2xl">
                  اشترك بخدمة الأخبار العاجلة على واتساب
                </h2>
                <p className="mt-1 text-sm font-bold text-muted">
                  تصلك أبرز الأخبار فور نشرها مباشرة على واتساب.
                </p>
              </div>

              {success ? (
                <div className="lg:flex-[1.4]">{successCard}</div>
              ) : (
                <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-stretch lg:flex-[1.4]">
                  <div className="sm:flex-1">{nameField}</div>
                  <div className="sm:flex-1">{phoneField}</div>
                  <Button type="submit" variant="primary" size="lg" disabled={loading} aria-busy={loading} className="h-14 shrink-0 rounded-none px-8 text-lg font-black">
                    {loading ? 'جارٍ المعالجة…' : 'اشترك الآن'}
                  </Button>
                </form>
              )}
            </div>
            {!success && errorMsg ? <p role="alert" className="mt-3 text-sm font-bold text-danger">{errorMsg}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  // ── النسخة الرأسيّة (card) — داخل الخبر ───────────────────────────────────────
  return (
    <section dir="rtl" className="relative mt-8 border border-border bg-surface-2 p-6 md:p-10">
      {closeButton}

      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-2 text-3xl font-black text-fg">الأخبار العاجلة</h2>
        <h3 className="mb-4 text-xl font-black text-fg/90">كن الأول في معرفة آخر المستجدات فور حدوثها</h3>
        <p className="mb-6 text-sm font-bold leading-relaxed text-muted">
          ابقَ على اطّلاع على آخر الأخبار، واشترك في خدمة الأخبار العاجلة التي تصل إلى واتساب مباشرة فور النشر.
        </p>

        {(termsHref || privacyHref) ? (
          <div className="mb-6 text-[11px] font-bold text-muted">
            بتسجيلك، فأنت توافق على{' '}
            {termsHref ? (
              <a href={termsHref} className="underline hover:text-fg">{termsLabel || 'الشروط والأحكام'}</a>
            ) : null}
            {termsHref && privacyHref ? <> و </> : null}
            {privacyHref ? (
              <a href={privacyHref} className="underline hover:text-fg">{privacyLabel || 'سياسة الخصوصية'}</a>
            ) : null}
            .
          </div>
        ) : null}

        {success ? (
          <div className="mb-2">{successCard}</div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-col gap-4 text-start">
              <div>{nameField}</div>
              {phoneField}
            </div>

            <Button type="submit" variant="primary" size="lg" disabled={loading} aria-busy={loading} className="h-14 w-full rounded-none text-lg font-black">
              {loading ? 'جارٍ المعالجة…' : 'اشترك الآن'}
            </Button>

            {errorMsg ? <p role="alert" className="mt-2 text-sm font-bold text-danger">{errorMsg}</p> : null}
          </form>
        )}
      </div>
    </section>
  );
}
