import type { SVGProps } from 'react';

// Social / brand glyphs as inline SVG components (lucide-react ships no brand marks).
// Rules: inherit color via `currentColor` (brand-icon exception to the no-fill rule),
// official sizes only (default 20 = md), decorative by default (`aria-hidden`).
export type SocialIconProps = SVGProps<SVGSVGElement> & { size?: number };

export function FacebookIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function XIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function InstagramIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YoutubeIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12z" />
    </svg>
  );
}

// Official Google "G" mark (brand colors — brand-icon exception to the currentColor rule).
export function GoogleIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function WhatsappIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.2 4.74 1.2 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2m5.48 13.99c-.21.58-1.2 1.11-1.68 1.18-.43.06-.97.09-1.56-.1-.36-.11-.82-.26-1.41-.52-2.48-1.07-4.11-3.57-4.23-3.74-.12-.16-1.01-1.34-1.01-2.56 0-1.22.64-1.82.86-2.07.23-.25.49-.31.66-.31h.48c.16.01.36-.05.56.43.2.5.7 1.72.76 1.84.06.12.1.26.02.43-.08.16-.12.26-.25.41-.12.14-.26.32-.37.43-.12.12-.25.25-.11.5.15.25.64 1.06 1.38 1.72.94.84 1.74 1.11 1.99 1.23.25.13.4.11.54-.06.15-.16.63-.72.79-.97.17-.24.33-.2.56-.12.22.09 1.44.69 1.69.81.25.12.41.18.47.28.07.11.07.6-.14 1.18" />
    </svg>
  );
}

export function TelegramIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M21.426 2.094 2.717 9.92c-1.07.43-1.06 1.946.013 2.36l4.27 1.65 1.65 5.31c.27.86 1.36 1.11 1.97.44l2.39-2.6 4.59 3.37c.66.49 1.6.13 1.78-.67l3.32-15.6c.2-.94-.72-1.74-1.6-1.39M8.86 13.91l9.04-5.67c.43-.27.83.32.46.65l-7.3 6.6-.28 3.07z" />
    </svg>
  );
}

export function LinkedinIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.34 9.67H5.67V18h2.67zM7 6.34a1.55 1.55 0 1 0 0 3.1 1.55 1.55 0 0 0 0-3.1M18.33 18v-4.57c0-2.4-1.28-3.52-2.99-3.52-1.38 0-2 .76-2.34 1.29v-1.1h-2.67V18h2.67v-4.36c0-.23.02-.46.08-.62.18-.46.6-.94 1.31-.94.92 0 1.29.7 1.29 1.73V18z" />
    </svg>
  );
}

export function TikTokIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M16.6 5.82c-.9-.9-1.4-2.12-1.4-3.4V2h-3.45v13.4a2.59 2.59 0 0 1-4.65 1.56 2.59 2.59 0 0 1 2.17-4.04c.24 0 .48.03.7.1V9.4a5.9 5.9 0 0 0-.7-.04A6.05 6.05 0 0 0 3.22 15.4 6.05 6.05 0 0 0 9.28 21.46a6.05 6.05 0 0 0 6.05-6.05V9.1a8.35 8.35 0 0 0 4.87 1.56V7.2a4.9 4.9 0 0 1-3.6-1.38z" />
    </svg>
  );
}

// أيقونة موقع إلكتروني عامّة (website) — كرة أرضية بسيطة، بنمط أيقونة إنستغرام (خطّ لا تعبئة).
export function WebsiteIcon({ size = 20, ...props }: SocialIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
