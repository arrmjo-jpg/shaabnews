'use client';

import { useState } from 'react';
import { Check, Link2, Printer, Bookmark, Share2 } from 'lucide-react';
import { useEngagement } from '@/lib/use-engagement';
import type { EngagementMetrics } from '@/lib/engagement';
import { FacebookIcon, TelegramIcon, WhatsappIcon, XIcon } from '@/components/icons/social';
import { AudioReader } from '@/components/reading/audio-reader';

// شريط أدوات القراءة (نسخة الجوال) + شريط المشاركة الجانبي اللاصق (نسخة سطح المكتب). كلاهما
// عرض فقط فوق `useEngagement` المركزي الموجود — صفر منطق إعجاب/حفظ هنا.
//
// ملاحظة تكيّف: النسخة المرجعية (D:\gasem\frontend) تستدعي `trackEvent(...)` من `lib/analytics`
// عند كل تفاعل — هذا الملف غير موجود في هذا المشروع. بدل إنشاء مكتبة تحليلات جديدة (خارج نطاق
// «تعديلات بصرية فقط»)، حُذفت استدعاءات trackEvent والاحتفاظ بالسلوك البصري والوظيفي كاملاً
// (مشاركة/نسخ رابط/طباعة/حفظ تعمل جميعًا كما هي).
type Network = { key: string; label: string; href: string; Icon: React.ElementType };

function getNetworks(url: string, title: string): Network[] {
  const enc = encodeURIComponent;
  const u = enc(url);
  const t = enc(title);
  const tu = enc(`${title} ${url}`);
  return [
    { key: 'whatsapp', label: 'واتساب', href: `https://wa.me/?text=${tu}`, Icon: WhatsappIcon },
    { key: 'facebook', label: 'فيسبوك', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, Icon: FacebookIcon },
    { key: 'x', label: 'إكس', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, Icon: XIcon },
    { key: 'telegram', label: 'تيليجرام', href: `https://t.me/share/url?url=${u}&text=${t}`, Icon: TelegramIcon },
  ];
}

interface ReadingToolsProps {
  articleId: number;
  url: string;
  title: string;
  initialMetrics: EngagementMetrics;
  ttsEnabled?: boolean;
}

export function ReadingToolsBar({ articleId, url, title, initialMetrics, ttsEnabled = false }: ReadingToolsProps) {
  const [copied, setCopied] = useState(false);

  const { favorited, toggleFavorite } = useEngagement({
    type: 'article',
    id: articleId,
    initialMetrics,
    hydrate: true,
  });

  const handleShareClick = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer,width=620,height=560');
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
      } catch {
        /* ألغى المستخدم */
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard fail */
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="flex flex-col gap-3 pb-0 mb-1 print:hidden">
      {ttsEnabled && (
        <div className="flex items-center">
          <AudioReader targetId="article-content" />
        </div>
      )}

      <div className="flex flex-nowrap items-center justify-between gap-2 border-t border-border pt-3 lg:hidden">
        <div className="flex items-center gap-1.5">
          {getNetworks(url, title).map(({ key, label, href, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleShareClick(href)}
              aria-label={`مشاركة عبر ${label}`}
              title={label}
              className="flex size-8 shrink-0 items-center justify-center bg-primary text-white transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Icon size={16} />
            </button>
          ))}

          <button
            type="button"
            onClick={() => void handleNativeShare()}
            aria-label="مشاركة عبر النظام"
            title="مشاركة"
            className="flex size-8 shrink-0 items-center justify-center bg-surface-2 text-fg transition-all hover:-translate-y-0.5 hover:bg-surface-3 sm:hidden"
          >
            <Share2 className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            aria-label="نسخ الرابط"
            title={copied ? 'تم النسخ' : 'نسخ الرابط'}
            className="flex size-8 shrink-0 items-center justify-center bg-primary text-white transition-all hover:bg-primary/90"
          >
            {copied ? <Check className="size-3.5 animate-pulse" /> : <Link2 className="size-3.5" />}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            aria-label="طباعة الخبر"
            title="طباعة"
            className="flex size-8 shrink-0 items-center justify-center bg-primary text-white transition-all hover:bg-primary/90"
          >
            <Printer className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => void toggleFavorite()}
            aria-label={favorited ? 'إزالة من المفضّلة' : 'حفظ في المفضّلة'}
            title={favorited ? 'محفوظ' : 'حفظ'}
            className="flex size-8 shrink-0 items-center justify-center bg-primary text-white transition-all hover:bg-primary/90"
          >
            <Bookmark className={`size-3.5 ${favorited ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface StickyShareSidebarProps {
  articleId: number;
  url: string;
  title: string;
  initialMetrics: EngagementMetrics;
}

export function StickyShareSidebar({ articleId, url, title, initialMetrics }: StickyShareSidebarProps) {
  const [copied, setCopied] = useState(false);
  const { favorited, toggleFavorite } = useEngagement({
    type: 'article',
    id: articleId,
    initialMetrics,
    hydrate: true,
  });

  const handleShareClick = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer,width=620,height=560');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard fail */
    }
  };

  const handlePrint = () => window.print();

  return (
    <aside className="sticky top-24 flex flex-col items-center gap-3.5" aria-label="أدوات مشاركة جانبية">
      <span className="text-[10px] font-extrabold text-muted uppercase tracking-wider select-none leading-none mb-1">
        مشاركة
      </span>

      {getNetworks(url, title).map(({ key, label, href, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => handleShareClick(href)}
          aria-label={`مشاركة عبر ${label}`}
          title={label}
          className="flex size-10 items-center justify-center bg-primary text-white transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Icon size={18} />
        </button>
      ))}

      <span className="h-px w-6 bg-border my-1 select-none" />

      <button
        type="button"
        onClick={() => void handleCopyLink()}
        aria-label="نسخ رابط المقال"
        title="نسخ الرابط"
        className={`flex size-10 items-center justify-center transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary ${
          copied ? 'bg-primary border-primary text-white font-bold animate-pulse' : 'bg-primary text-white border-primary/20'
        }`}
      >
        <Link2 size={18} />
      </button>

      <button
        type="button"
        onClick={handlePrint}
        aria-label="طباعة الخبر"
        title="طباعة الخبر"
        className="flex size-10 items-center justify-center bg-primary text-white border border-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Printer size={18} />
      </button>

      <button
        type="button"
        onClick={() => void toggleFavorite()}
        aria-label={favorited ? 'إزالة من المفضّلة' : 'حفظ في المفضّلة'}
        title={favorited ? 'إزالة من المفضّلة' : 'حفظ في المفضّلة'}
        className="flex size-10 items-center justify-center bg-primary text-white border border-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Bookmark size={18} className={favorited ? 'fill-current' : ''} />
      </button>
    </aside>
  );
}
