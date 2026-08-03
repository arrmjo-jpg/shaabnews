const bakedApiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080/api/v1';

/**
 * جسر تطبيق الموبايل (ADR-013): يُفتح admin-frontend داخل WebView على مضيف مختلف عن
 * الذي بُنيت الحزمة له (10.0.2.2 لمحاكي Android، أو IP الشبكة المحلية لجهاز حقيقي) —
 * فالقيمة المبنيّة في VITE_API_BASE_URL (مثلاً http://localhost:8080) لا تصل من داخل
 * WebView إطلاقاً (localhost هناك يعني المحاكي نفسه لا جهاز التطوير). نبدّل المضيف فقط
 * مع إبقاء المنفذ/البروتوكول المبنيَين عند اكتشاف أحد هذه الأنماط. النطاقات الحقيقية في
 * الإنتاج (admin.harer.store) لا تُطابق هذه الأنماط إطلاقاً فلا تأثير هناك.
 */
function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') return bakedApiBaseUrl;
  const currentHost = window.location.hostname;
  const isMobileBridgeHost =
    currentHost === '10.0.2.2' ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(currentHost) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(currentHost);
  if (!isMobileBridgeHost) return bakedApiBaseUrl;
  try {
    const url = new URL(bakedApiBaseUrl);
    if (url.hostname === currentHost) return bakedApiBaseUrl;
    url.hostname = currentHost;
    return url.toString();
  } catch {
    return bakedApiBaseUrl;
  }
}

const apiBaseUrl = resolveApiBaseUrl();

function fallbackPublicSiteUrl(apiUrl: string): string {
  try {
    const origin = new URL(apiUrl).origin;
    // إذا كان عنوان الـ API يحتوي على api. نقوم بإزالتها للوصول لنطاق الموقع الرئيسي
    if (origin.includes('://api.')) {
      return origin.replace('://api.', '://');
    }
    // في بيئة التطوير المحلية، نقوم بالتحويل لمنفذ الواجهة الأمامية 3000
    if (origin.includes('localhost:8000')) {
      return origin.replace('localhost:8000', 'localhost:3000');
    }
    if (origin.includes('127.0.0.1:8000')) {
      return origin.replace('127.0.0.1:8000', 'localhost:3000');
    }
    return origin;
  } catch {
    return '';
  }
}

export const env = {
  apiBaseUrl,
  /** Public site base URL for canonical/sharing links (defaults to the API origin, auto-detects site domain). */
  publicSiteUrl:
    (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ?? fallbackPublicSiteUrl(apiBaseUrl),
} as const;
