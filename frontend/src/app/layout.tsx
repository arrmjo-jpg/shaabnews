import type { Metadata } from 'next';
import localFont from 'next/font/local';

import './globals.css';
import { SiteLogo } from '@/components/branding/site-logo';
import { RouteLoadingOverlay } from '@/components/layout/route-loading-overlay';
import { Analytics } from '@/components/seo/analytics';
import { JsonLd } from '@/components/seo/json-ld';
import { ResourceHints } from '@/components/seo/resource-hints';
import { buildMetadata } from '@/lib/seo';

// Platform typeface — Al-Jazeera Arabic (Regular 400 + Bold 700), self-hosted via next/font/local.
const aljazeera = localFont({
  src: [
    { path: './fonts/Al-Jazeera-Arabic-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Al-Jazeera-Arabic-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-aljazeera',
  display: 'swap',
});

// All metadata derived from Site Settings (no hardcoded SEO content).
export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata();
}

// Root shell only — global head/SEO/perf. Site chrome lives in (site)/layout; the dashboard
// (/account) ships its own shell. So route groups decide their own chrome.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning على <html>: إضافات المتصفّح (مثل crxlauncher) تحقن سمات قبل ترطيب React ⇒ عدم تطابق
  // زائف؛ يُسكِت سمات <html> نفسه فقط، لا الأبناء (فلا يُخفي عدم تطابق حقيقيّ في التطبيق).
  return (
    <html lang="ar" dir="rtl" className={`${aljazeera.variable} antialiased`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col bg-bg text-fg">
        <ResourceHints />
        {children}
        <JsonLd />
        <Analytics />
        {/* شعار Server Component (يجيب إعدادات الموقع) يُمرَّر children لمكوّن عميليّ — لا يقدر
            RouteLoadingOverlay ('use client') يستدعي SiteLogo غير المتزامن بنفسه. */}
        <RouteLoadingOverlay logo={<SiteLogo variant="light" priority />} />
      </body>
    </html>
  );
}
