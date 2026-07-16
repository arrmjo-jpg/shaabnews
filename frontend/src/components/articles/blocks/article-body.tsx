'use client';

import { useEffect, useState } from 'react';
import { Lightbox, type LightboxImage } from '@/components/ui/lightbox';
import { editorialTypography } from '@/lib/design-tokens';

// متن المقال: فقرة افتتاحية (Lead) بارزة + المتن (`.tiptap-content`) + معرض صور منبثق عند
// النقر على أي صورة داخل المتن. حجم الخط يُقرأ من `--article-font-size` (تكتبه FontSizeControls)
// عبر inline style مُقيَّد لهذا المكوّن وحده — لا تعديل على قاعدة `.tiptap-content` العامة
// المستخدمة في التعليقات/الصفحات الثابتة، فلا يتأثّر أي مكان آخر في الموقع.
interface ArticleBodyProps {
  contentHtml: string;
  excerpt: string | null;
}

export function ArticleBody({ contentHtml, excerpt }: ArticleBodyProps) {
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    currentIndex: number;
    images: LightboxImage[];
  }>({
    isOpen: false,
    currentIndex: 0,
    images: [],
  });

  useEffect(() => {
    const container = document.getElementById('article-content');
    if (!container) return;

    const handleImgClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        e.preventDefault();

        const allImgs = Array.from(container.querySelectorAll('img'));
        const index = allImgs.indexOf(target as HTMLImageElement);

        const list = allImgs.map((img) => {
          const figure = img.closest('figure');
          const figcaption = figure?.querySelector('figcaption');

          return {
            src: img.src,
            alt: img.alt || '',
            caption: figcaption?.textContent?.trim() || img.alt || '',
          };
        });

        setLightbox({
          isOpen: true,
          currentIndex: index >= 0 ? index : 0,
          images: list,
        });
      }
    };

    container.addEventListener('click', handleImgClick);
    return () => container.removeEventListener('click', handleImgClick);
  }, [contentHtml]);

  return (
    <div className="w-full">
      {excerpt && <span className={`${editorialTypography.lead} editorial-lead`}>{excerpt}</span>}

      <div
        id="article-content"
        className="tiptap-content text-fg"
        style={{ fontSize: 'var(--article-font-size, 1.0625rem)' }}
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      <Lightbox
        isOpen={lightbox.isOpen}
        images={lightbox.images}
        currentIndex={lightbox.currentIndex}
        onClose={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
        onNavigate={(index) => setLightbox((prev) => ({ ...prev, currentIndex: index }))}
      />
    </div>
  );
}
