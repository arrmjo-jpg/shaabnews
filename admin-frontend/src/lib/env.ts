const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api/v1';

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
