import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Moon,
  Sun,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

// تحويل رمز أيقونة OpenWeather (مثل "01d"/"10n") إلى أيقونة lucide مطابقة للثيم (لا صور خارجيّة).
const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  '01d': Sun,
  '01n': Moon,
  '02d': CloudSun,
  '02n': CloudMoon,
  '03d': Cloud,
  '03n': Cloud,
  '04d': Cloudy,
  '04n': Cloudy,
  '09d': CloudDrizzle,
  '09n': CloudDrizzle,
  '10d': CloudRain,
  '10n': CloudRain,
  '11d': CloudLightning,
  '11n': CloudLightning,
  '13d': CloudSnow,
  '13n': CloudSnow,
  '50d': CloudFog,
  '50n': CloudFog,
};

export function WeatherIcon({ code, className }: { code: string; className?: string }) {
  const Icon = ICON_MAP[code] ?? Cloud;
  return <Icon className={className} aria-hidden />;
}
