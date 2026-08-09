// Public Epaper reader — progressive-enhancement entry (Vanilla ESM, no framework).
// SSR renders the shell + a working "open PDF" fallback; this hydrates the custom
// PDF.js reader from the [data-epaper-reader] data-attributes. No-ops on the archive.
// Loaded via @vite(['.../epaper.js']); the archive page simply finds no mount.

import '../css/epaper.css';
import { PdfReader } from './epaper/reader.js';

function readJson(el) {
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || '{}');
  } catch {
    return {};
  }
}

function boot() {
  // قارئ العدد (صفحة العرض): البوّابة على نقطة التسليم الموقَّتة (المرحلة 3ب أزالت
  // رابط الـ PDF الخام). الأرشيف وحالة "لا وثيقة" لا يصكّان هذه السمة فلا يُركَّب القارئ.
  const reader = document.querySelector('[data-epaper-reader]');
  if (reader && reader.getAttribute('data-doc-endpoint')) {
    const labels = readJson(reader.querySelector('script[data-epaper-i18n]'));
    void new PdfReader(reader, labels).init();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
