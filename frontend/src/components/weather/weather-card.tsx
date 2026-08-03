'use client';

import { ChevronLeft, ChevronRight, CloudOff, Droplets, Gauge, MapPin, Navigation, Wind } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { AnimatedWeatherIcon } from '@/components/weather/animated-weather-icon';
import { JORDAN_GOVERNORATES, nearestGovernorate } from '@/lib/governorates';
import { weatherGradient } from '@/lib/weather-theme';

interface Snapshot {
  govId: string;
  city: string;
  temp: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  windKmh: number;
  pressure: number;
  description: string;
  icon: string;
}
interface Hourly {
  time: string;
  temp: number;
  icon: string;
}
interface Daily {
  date: string;
  dayLabel: string;
  tempMin: number;
  tempMax: number;
  icon: string;
}
export interface WeatherFull {
  govId: string;
  city: string;
  current: Snapshot;
  // اختياريّان دفاعيّاً: قد تأتي بيانات مُكاشة من نسخة أقدم بلا هذه الحقول.
  hourly?: Hourly[];
  daily?: Daily[];
}

const RANGE_FILL = 'linear-gradient(90deg,#62b6ff 0%,#ffd166 55%,#ff7e5f 100%)';
const GLASS = 'rgba(255,255,255,0.12)';

function todayLabel(): string {
  try {
    return new Intl.DateTimeFormat('ar', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  } catch {
    return '';
  }
}

// بطاقة حالة الطقس العصريّة — **بعرض الموقع الكامل** في الوضع الكامل (عمودان: الحالة الآن يميناً + الساعيّ
// والأسبوعيّ يساراً ⇒ تملأ العرض بلا فراغ)؛ والوضع `compact` عمود واحد (عمود الهوم الضيّق). تدرّج سماء حسب
// الحالة/الوقت + زجاجيّة + تحديد موقع تلقائيّ + تنقّل محافظات. المفتاح خادميّ (عبر ‎/api/weather‎).
export function WeatherCard({ initial = null, compact = false }: { initial?: WeatherFull | null; compact?: boolean }) {
  const [data, setData] = useState<WeatherFull | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [errored, setErrored] = useState(false);
  const dataRef = useRef<WeatherFull | null>(initial);
  dataRef.current = data;

  const load = useCallback(async (govId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weather?gov=${encodeURIComponent(govId)}`);
      if (!res.ok) throw new Error('bad');
      setData((await res.json()) as WeatherFull);
      setErrored(false);
    } catch {
      if (!dataRef.current) setErrored(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (!dataRef.current) load('amman');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => load(nearestGovernorate(pos.coords.latitude, pos.coords.longitude).id),
      () => {
        if (!dataRef.current) load('amman');
      },
      { timeout: 8000, maximumAge: 600_000 },
    );
  }, [load]);

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycle = (delta: number) => {
    const i = data ? JORDAN_GOVERNORATES.findIndex((g) => g.id === data.govId) : 0;
    const base = i < 0 ? 0 : i;
    const next = JORDAN_GOVERNORATES[(base + delta + JORDAN_GOVERNORATES.length) % JORDAN_GOVERNORATES.length];
    load(next.id);
  };

  const gradient = data ? weatherGradient(data.current.icon) : weatherGradient('01d');
  const shell: CSSProperties = {
    borderRadius: compact ? 18 : 28,
    backgroundImage: gradient,
    boxShadow: '0 24px 60px -20px rgba(8,30,60,0.55)',
  };

  if (errored && !data) {
    return (
      <div style={shell} dir="rtl" className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center text-white">
        <CloudOff className="size-12 opacity-90" aria-hidden />
        <p className="font-bold">تعذّر جلب حالة الطقس</p>
        <button type="button" onClick={() => load('amman')} className="bg-white/20 px-4 py-1.5 text-sm font-bold transition hover:bg-white/30" style={{ borderRadius: 999 }}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={shell} dir="rtl" className="flex h-full min-h-[240px] items-center justify-center p-6 text-white/90" aria-busy="true">
        <span className="text-sm font-bold">جارٍ تحميل حالة الطقس…</span>
      </div>
    );
  }

  const c = data.current;
  const hourly = data.hourly ?? [];
  const days = data.daily ?? []; // التوقّع الأسبوعيّ — الوضع الكامل فقط (غير مطلوب في بطاقة الهوم المضغوطة)

  return (
    <div style={shell} dir="rtl" className={`relative h-full overflow-hidden text-white transition-opacity ${loading ? 'opacity-80' : ''}`}>
      {/* وهج علويّ ناعم (عمق) */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 75% at 50% -15%, rgba(255,255,255,0.22), transparent 60%)' }} aria-hidden />

      <div className={`relative flex h-full flex-col ${compact ? 'p-4' : 'p-6 sm:p-8'}`}>
        {/* الترويسة: تنقّل + الموقع */}
        <div className="flex shrink-0 items-center justify-between gap-2">
          <NavBtn onClick={() => cycle(-1)} label="المحافظة السابقة">
            <ChevronRight className="size-5" aria-hidden />
          </NavBtn>
          <button type="button" onClick={locate} title="تحديد موقعي" className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 backdrop-blur-md transition hover:bg-white/25" style={{ borderRadius: 999 }}>
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate text-sm font-bold">{c.city}</span>
            <Navigation className="size-3 shrink-0 opacity-70" aria-hidden />
          </button>
          <NavBtn onClick={() => cycle(1)} label="المحافظة التالية">
            <ChevronLeft className="size-5" aria-hidden />
          </NavBtn>
        </div>

        {compact ? (
          // ── الوضع المضغوط (عمود الهوم): عمود واحد يملأ الارتفاع (يطابق عمودَي «أخبار الفن») ──
          <>
            <div className="flex flex-1 flex-col justify-center">
              <div className="mt-2">
                <Hero c={c} big={false} />
              </div>
              <DetailTiles c={c} />
            </div>
            <div className="mt-4 shrink-0 text-center">
              <Link href="/weather" className="text-xs font-bold text-white/90 transition hover:text-white">
                كل المحافظات والتفاصيل ←
              </Link>
            </div>
          </>
        ) : (
          // ── الوضع الكامل (عرض الموقع): عمودان ──
          <>
            <p className="mt-2 text-center text-sm text-white/80">{todayLabel()}</p>
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              {/* العمود 1 (يمين): الحالة الآن */}
              <div className="flex min-w-0 flex-col justify-center lg:border-e lg:border-white/15 lg:pe-8">
                <Hero c={c} big />
                <DetailTiles c={c} />
              </div>
              {/* العمود 2 (يسار): الساعيّ + الأسبوعيّ — min-w-0 إلزاميّ: صناديق Grid/Flex تُبقي
                  min-width:auto افتراضيًّا، فيمتدّ العمود ليطابق أقصى عرض محتوى HourlyStrip
                  (السحب الأفقيّ) بدل احترام overflow-x-auto الداخليّ — يكسر البطاقة على الموبايل
                  (تُقصّ بفعل overflow-hidden للأصل). */}
              <div className="flex min-w-0 flex-col justify-center gap-4">
                <HourlyStrip hourly={hourly} />
                <DailyList days={days} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NavBtn({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="shrink-0 bg-white/10 p-1.5 backdrop-blur-md transition hover:bg-white/25" style={{ borderRadius: 999 }}>
      {children}
    </button>
  );
}

function Hero({ c, big }: { c: Snapshot; big: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <AnimatedWeatherIcon code={c.icon} title={c.description} className={big ? 'size-28 sm:size-36' : 'size-20'} />
      <div className="flex items-start justify-center">
        <span className={`font-thin leading-none tabular-nums ${big ? 'text-7xl sm:text-8xl' : 'text-6xl'}`}>{c.temp}</span>
        <span className={`font-light ${big ? 'mt-2 text-3xl' : 'mt-1.5 text-2xl'}`}>°</span>
      </div>
      {c.description && <p className={`mt-1 font-medium ${big ? 'text-lg' : 'text-sm'}`}>{c.description}</p>}
      <p className="mt-1 text-xs text-white/80 sm:text-sm">
        العظمى {c.tempMax}° · الصغرى {c.tempMin}° · الإحساس {c.feelsLike}°
      </p>
    </div>
  );
}

function DetailTiles({ c }: { c: Snapshot }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      <DetailTile icon={<Gauge className="size-5 opacity-90" />} value={`${c.pressure}`} label="hPa" />
      <DetailTile icon={<Wind className="size-5 opacity-90" />} value={`${c.windKmh}`} label="كم/س" />
      <DetailTile icon={<Droplets className="size-5 opacity-90" />} value={`${c.humidity}%`} label="الرطوبة" />
    </div>
  );
}

function DetailTile({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-3 text-center backdrop-blur-md" style={{ background: GLASS, borderRadius: 16 }}>
      {icon}
      <span className="text-base font-bold tabular-nums leading-none">{value}</span>
      <span className="text-[11px] text-white/70">{label}</span>
    </div>
  );
}

function HourlyStrip({ hourly }: { hourly: Hourly[] }) {
  if (hourly.length === 0) return null;
  return (
    <div className="min-w-0 backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ background: GLASS, borderRadius: 18 }}>
      <div className="flex gap-5 overflow-x-auto px-4 py-3">
        {hourly.map((h, i) => (
          <div key={i} className="flex shrink-0 flex-col items-center gap-1">
            <span className="text-xs text-white/80">{h.time}</span>
            <AnimatedWeatherIcon code={h.icon} className="size-8" />
            <span className="text-sm font-bold tabular-nums">{h.temp}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyList({ days }: { days: Daily[] }) {
  if (days.length === 0) return null;
  const weekMin = Math.min(...days.map((d) => d.tempMin));
  const weekMax = Math.max(...days.map((d) => d.tempMax));
  const span = Math.max(1, weekMax - weekMin);
  return (
    <div className="px-1">
      {days.map((d) => {
        const lo = ((d.tempMin - weekMin) / span) * 100;
        const w = Math.max(8, ((d.tempMax - d.tempMin) / span) * 100);
        return (
          <div key={d.date} className="flex items-center gap-3 py-1.5">
            <span className="w-12 shrink-0 text-sm text-white/90">{d.dayLabel}</span>
            <AnimatedWeatherIcon code={d.icon} className="size-7 shrink-0" />
            <span className="w-7 shrink-0 text-center text-sm tabular-nums text-white/70">{d.tempMin}°</span>
            <div dir="ltr" className="relative h-1.5 flex-1" style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 999 }}>
              <div className="absolute inset-y-0" style={{ left: `${lo}%`, width: `${w}%`, background: RANGE_FILL, borderRadius: 999 }} />
            </div>
            <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums">{d.tempMax}°</span>
          </div>
        );
      })}
    </div>
  );
}
