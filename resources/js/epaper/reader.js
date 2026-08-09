// PDF.js core custom reader — orchestrator (Phase 2b core + 2c modes/mobile/hardening).
// NOT the prebuilt pdf.js viewer. Modes: single | spread (desktop, RTL-aware) | continuous.
// Touch: swipe / pinch / double-tap. Fonts hardened via served cMaps + standard fonts.

import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PagedView } from './paged-view.js';
import { ContinuousView } from './continuous-view.js';
import { Thumbnails } from './thumbnails.js';
import { ReaderState } from './reader-state.js';
import { ReaderAnalytics } from './reader-analytics.js';
import { Highlighter } from './highlight.js';
import { attachGestures } from './gestures.js';
import { clamp, debounce, isNarrow } from './util.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Served from public/build/pdfjs (copied at build time). Hardens rendering of CID-keyed
// and non-embedded base-14 fonts — common safety net for Arabic/mixed PDFs.
const CMAP_URL = '/build/pdfjs/cmaps/';
const STANDARD_FONTS_URL = '/build/pdfjs/standard_fonts/';

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
const ZOOM_STEP = 1.25;
const DOUBLE_TAP_SCALE = 2.2;

const ICON = {
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  zoomIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5M11 8v6M8 11h6"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5M8 11h6"/></svg>',
  fitWidth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12h18M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
  fitPage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="3" width="14" height="18"/><path d="M9 7h6M9 12h6M9 17h6"/></svg>',
  single: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="7" y="4" width="10" height="16"/></svg>',
  spread: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="8" height="16"/><rect x="13" y="4" width="8" height="16"/></svg>',
  continuous: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="6" y="3" width="12" height="7"/><rect x="6" y="14" width="12" height="7"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  thumbs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>',
  bookmarks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3h11a1 1 0 0 1 1 1v15l-4-2.5L12 19V4a1 1 0 0 0-1-1z"/><path d="M8 3H5a1 1 0 0 0-1 1v15l4-2.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
};

export class PdfReader {
  constructor(root, labels) {
    this.root = root;
    this.t = labels || {};
    // لا روابط PDF خام: نصكّ رابطاً موقَّتاً من نقطة التسليم (بعد فحص الوصول) ونُجدّده.
    this.docEndpoint = root.getAttribute('data-doc-endpoint');
    this.downloadEndpoint = root.getAttribute('data-download-endpoint');
    this.canDownload = root.getAttribute('data-can-download') === '1';
    this.subscribeUrl = root.getAttribute('data-subscribe-url') || '';

    // احتفاظ القارئ + التحليلات (Phase 5). الكتابة على مسارات الويب (كوكي + X-CSRF-TOKEN).
    this.csrf = root.getAttribute('data-csrf') || '';
    this.authenticated = root.getAttribute('data-authenticated') === '1';
    this.state = new ReaderState({
      issueKey: root.getAttribute('data-epaper-id') || 'x',
      authenticated: this.authenticated,
      csrf: this.csrf,
      endpoints: {
        state: root.getAttribute('data-state-endpoint') || '',
        progress: root.getAttribute('data-progress-endpoint') || '',
        bookmarks: root.getAttribute('data-bookmarks-endpoint') || '',
      },
    });
    this.analytics = new ReaderAnalytics({
      endpoint: root.getAttribute('data-track-endpoint') || '',
      csrf: this.csrf,
    });
    this._drawer = null; // 'thumbs' | 'search' | 'bookmarks' | null (درج واحد مفتوح)

    this.refreshTimer = null;
    this._attached = false;
    this.canonical = root.getAttribute('data-canonical') || window.location.pathname;
    this.page = Math.max(1, parseInt(root.getAttribute('data-initial-page') || '1', 10) || 1);

    // تظليل البحث (Phase 6): القدوم من الأرشيف يحمل ?q=<عبارة> في الرابط؛ نلتقطها مرّة
    // عند التركيب فيبني العرض المُصفَّح طبقة تظليل فوق الصفحة. الحبّة بديلٌ لطيف دائماً.
    let term = '';
    try {
      term = (new URLSearchParams(window.location.search).get('q') || '').trim();
    } catch { /* ignore */ }
    this.searchTerm = term;
    this.highlighter = term ? new Highlighter(term) : null;
    this._pill = null;

    this.mode = 'single';
    this.fitMode = 'width'; // 'width' | 'page' | 'custom'
    this.manualScale = 1;
    this.appliedScale = 1;
    this.numPages = 0;
    this.pdfDoc = null;
    this.view = null;
    this.thumbs = null;
    this.pinchBase = 1;
    this.pinchRatio = 1;

    this.fallback = root.querySelector('[data-epaper-fallback]');
    this._pseudoFs = false; // ملء شاشة زائف (iPhone Safari: لا واجهة fullscreen أصليّة)
    this._onResize = debounce(() => this._handleResize(), 150);
    this._onKey = (e) => this._handleKey(e);
    this._onFs = () => this._syncFullscreenButton();
  }

  async init() {
    this._buildUi();
    await this._load();
  }

  async _load() {
    try {
      const minted = await this._mint();
      await this._openDocument(minted.url);
      this._scheduleRefresh(minted.expires_at);

      await this._restoreState(); // استئناف + إشارات (قبل تركيب العرض)

      if (this.fallback) this.fallback.style.display = 'none';
      this.ui.style.display = '';

      this._buildThumbs();
      this._renderBookmarks();
      this._syncBookmarkButton();
      await this.setMode(this.mode);
      if (this.highlighter && this.highlighter.active) this._buildSearchPill();
      if (!this._attached) {
        this._attach();
        this._attached = true;
      }
      this.analytics.start();
      this.analytics.recordPage(this.page);
    } catch (e) {
      this._showState(e && e.status === 403 ? 'denied' : 'delivery');
    }
  }

  /** يحمّل حالة القارئ ويستأنف من آخر صفحة محفوظة ما لم يحدّد الرابط صفحةً صراحةً. */
  async _restoreState() {
    await this.state.load();
    const explicitDeepLink = this.page > 1; // /p/N في الرابط له الأولوية على الاستئناف
    const resume = this.state.resumePage();
    if (!explicitDeepLink && Number.isFinite(resume) && resume > 1 && resume <= this.numPages) {
      this.page = resume;
      this.analytics.recordResume();
      this._announce((this.t.resumed || '').replace(':page', String(resume)));
    }
  }

  /** يطلب رابطاً موقَّتاً من نقطة التسليم (الكوكي يُرسَل لتقييم اشتراك العضو). */
  async _mint() {
    const res = await fetch(this.docEndpoint, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const err = new Error('mint failed');
      err.status = res.status;
      throw err;
    }

    return res.json(); // { url, expires_at }
  }

  async _openDocument(url) {
    this.pdfDoc = await pdfjsLib.getDocument({
      url,
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: STANDARD_FONTS_URL,
    }).promise;
    this.numPages = this.pdfDoc.numPages;
    this.page = Math.min(this.page, this.numPages) || 1;
  }

  _buildThumbs() {
    this.thumbs = new Thumbnails(this.thumbPanel, this.pdfDoc, this.numPages, (n) => {
      this.goTo(n);
      if (isNarrow()) this.toggleThumbs(false);
    });
    this.thumbs.build();
  }

  /** يُعيد الصكّ قبل انتهاء الصلاحية (~60ث) فيستردّ القارئ بسلاسة دون انقطاع. */
  _scheduleRefresh(expiresAt) {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(ms)) return;
    const delay = Math.max(5000, ms - 60000);
    this.refreshTimer = window.setTimeout(() => void this._refresh(), delay);
  }

  async _refresh() {
    try {
      const minted = await this._mint();
      await this._reloadDocument(minted.url);
      this._scheduleRefresh(minted.expires_at);
    } catch (e) {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this._showState(e && e.status === 403 ? 'denied' : 'delivery');
    }
  }

  /** نفس الوثيقة برابط جديد — يُبدِّل المستند ويعيد تركيب العرض الحاليّ من المصدر الجديد. */
  async _reloadDocument(url) {
    await this._openDocument(url);
    this._buildThumbs();
    await this._mountView(this.mode);
  }

  // ─── ctx surface used by views ───────────────────────────────────────────
  availWidth() {
    const cs = getComputedStyle(this.stage);
    return this.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  availHeight() {
    const cs = getComputedStyle(this.stage);
    return this.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  }

  // ─── UI ──────────────────────────────────────────────────────────────────
  _buildUi() {
    const ui = document.createElement('div');
    ui.className = 'ep-reader';
    ui.style.display = 'none';

    const bar = document.createElement('div');
    bar.className = 'ep-toolbar';

    this.thumbsBtn = this._btn(ICON.thumbs, this.t.thumbnails, () => this.toggleThumbs());
    this.bookmarksBtn = this._btn(ICON.bookmarks, this.t.bookmarks, () => this.toggleBookmarks());
    this.bookmarkBtn = this._btn(ICON.bookmark, this.t.bookmarkAdd, () => void this._toggleCurrentBookmark());
    this.prevBtn = this._btn(ICON.prev, this.t.prev, () => this.prev());
    this.nextBtn = this._btn(ICON.next, this.t.next, () => this.next());

    const form = document.createElement('form');
    form.className = 'ep-pageform';
    this.pageInput = document.createElement('input');
    this.pageInput.type = 'text';
    this.pageInput.inputMode = 'numeric';
    this.pageInput.className = 'ep-pageinput';
    this.pageInput.setAttribute('aria-label', this.t.goToPage || 'Go to page');
    this.totalLabel = document.createElement('span');
    form.append(this.pageInput, document.createTextNode(' / '), this.totalLabel);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = parseInt(this.pageInput.value, 10);
      if (!Number.isNaN(n)) this.goTo(n);
      this.pageInput.blur();
    });

    this.zoomOutBtn = this._btn(ICON.zoomOut, this.t.zoomOut, () => this.zoom(1 / ZOOM_STEP));
    this.zoomInBtn = this._btn(ICON.zoomIn, this.t.zoomIn, () => this.zoom(ZOOM_STEP));
    this.fitWidthBtn = this._btn(ICON.fitWidth, this.t.fitWidth, () => this.setFit('width'));
    this.fitPageBtn = this._btn(ICON.fitPage, this.t.fitPage, () => this.setFit('page'));

    this.singleBtn = this._btn(ICON.single, this.t.single, () => this.setMode('single'));
    this.spreadBtn = this._btn(ICON.spread, this.t.spread, () => this.setMode('spread'));
    this.spreadBtn.classList.add('ep-desktop-only');
    this.continuousBtn = this._btn(ICON.continuous, this.t.continuous, () => this.setMode('continuous'));

    this.fsBtn = this._btn(ICON.fullscreen, this.t.fullscreen, () => this.toggleFullscreen());

    const spacer = () => {
      const s = document.createElement('span');
      s.className = 'ep-spacer';
      return s;
    };

    // مجموعة فتح الأدراج (مصغّرات/إشارات) في الصدر.
    const drawerBtns = [this.thumbsBtn, this.bookmarksBtn];

    bar.append(
      ...drawerBtns, this.prevBtn, form, this.nextBtn,
      spacer(),
      this.zoomOutBtn, this.zoomInBtn, this.fitWidthBtn, this.fitPageBtn,
      spacer(),
      this.singleBtn, this.spreadBtn, this.continuousBtn,
      this.bookmarkBtn, this.fsBtn,
    );

    // التنزيل مفروض خادمياً؛ الزرّ يظهر فقط عند الاستحقاق لكن النقطة تفرضه بأي حال.
    if (this.canDownload && this.downloadEndpoint) {
      bar.append(this._btn(ICON.download, this.t.download, () => {
        window.location.href = this.downloadEndpoint;
      }));
    }

    const body = document.createElement('div');
    body.className = 'ep-body';
    this.body = body;
    this.thumbPanel = document.createElement('div');
    this.thumbPanel.className = 'ep-thumbs';
    this.bookmarkPanel = document.createElement('div');
    this.bookmarkPanel.className = 'ep-bookmarks';
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ep-backdrop';
    this.backdrop.addEventListener('click', () => this._closeDrawers());
    this.stage = document.createElement('div');
    this.stage.className = 'ep-stage';
    body.append(this.thumbPanel, this.bookmarkPanel, this.backdrop, this.stage);

    // منطقة إعلان للقارئات الشاشية (استئناف القراءة) — مخفيّة بصرياً.
    this.live = document.createElement('div');
    this.live.className = 'ep-sr-only';
    this.live.setAttribute('aria-live', 'polite');

    // شريط تقدّم رفيع تحت الشريط — إضافيّ بحت (يعكس الصفحة/الإجماليّ، لا يغيّر أي سلوك).
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'ep-progress';
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'ep-progress-fill';
    this.progressBar.append(this.progressFill);

    ui.append(bar, this.progressBar, body, this.live);
    this.ui = ui;
    this.root.append(ui);

    this._syncBookmarkButton();
  }

  _btn(icon, label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ep-btn';
    b.innerHTML = icon;
    if (label) {
      b.setAttribute('aria-label', label);
      b.title = label;
    }
    b.addEventListener('click', onClick);
    return b;
  }

  _attach() {
    window.addEventListener('resize', this._onResize);
    document.addEventListener('keydown', this._onKey);
    document.addEventListener('fullscreenchange', this._onFs);
    document.addEventListener('webkitfullscreenchange', this._onFs); // Safari/iPadOS
    attachGestures(this.stage, {
      onNext: () => this.next(),
      onPrev: () => this.prev(),
      onDoubleTap: () => this._doubleTapZoom(),
      onPinchStart: () => { this.pinchBase = this.appliedScale; this.pinchRatio = 1; },
      onPinchMove: (ratio) => {
        this.pinchRatio = ratio; // tracked for all modes (continuous has no live transform)
        if (this.mode !== 'continuous' && this.view && this.view.wrap) {
          this.view.wrap.style.transform = `scale(${ratio})`;
        }
      },
      onPinchEnd: () => {
        if (this.view && this.view.wrap) this.view.wrap.style.transform = '';
        this.fitMode = 'custom';
        this.manualScale = clamp(this.pinchBase * this.pinchRatio, MIN_SCALE, MAX_SCALE);
        this._relayout();
      },
      onPinchCancel: () => {
        if (this.view && this.view.wrap) this.view.wrap.style.transform = ''; // امسح تحويلاً عالقاً
      },
    });
  }

  // ─── Mode switching ────────────────────────────────────────────────────────
  async setMode(mode) {
    if (mode === 'spread' && isNarrow()) mode = 'single';
    if (this.view && mode === this.mode) return;
    await this._mountView(mode);
  }

  async _mountView(mode) {
    if (this.view) this.view.destroy();
    this.mode = mode;
    this.view = mode === 'continuous' ? new ContinuousView(this) : new PagedView(this, mode === 'spread');
    this.view.onPage = (n) => this._reportPage(n);

    const mounted = this.view.mount();
    if (mounted && typeof mounted.then === 'function') await mounted; // continuous self-anchors
    if (mode !== 'continuous') await this.view.goTo(this.page);

    this._updateToolbar();
  }

  // ─── Navigation / zoom ─────────────────────────────────────────────────────
  _step() {
    return this.mode === 'spread' ? 2 : 1;
  }

  goTo(n) {
    if (this.view) this.view.goTo(n);
  }

  next() {
    this.goTo(this.page + this._step());
  }

  prev() {
    this.goTo(this.page - this._step());
  }

  zoom(factor) {
    this.fitMode = 'custom';
    this.manualScale = clamp(this.appliedScale * factor, MIN_SCALE, MAX_SCALE);
    this._relayout();
  }

  setFit(mode) {
    this.fitMode = mode;
    this._relayout();
  }

  _doubleTapZoom() {
    if (this.fitMode === 'custom') {
      this.setFit('width');
    } else {
      this.fitMode = 'custom';
      this.manualScale = clamp(this.appliedScale * DOUBLE_TAP_SCALE, MIN_SCALE, MAX_SCALE);
      this._relayout();
    }
  }

  _relayout() {
    if (this.view) this.view.relayout();
    this._updateToolbar();
  }

  // ─── Drawers (thumbs | search | bookmarks) — درج واحد مفتوح حصراً ─────────
  toggleThumbs(force) {
    this._toggleDrawer('thumbs', force);
  }

  toggleBookmarks(force) {
    this._toggleDrawer('bookmarks', force);
  }

  _toggleDrawer(name, force) {
    const open = typeof force === 'boolean' ? force : this._drawer !== name;
    this._drawer = open ? name : (this._drawer === name ? null : this._drawer);

    this.thumbPanel.classList.toggle('is-open', this._drawer === 'thumbs');
    if (this.bookmarkPanel) this.bookmarkPanel.classList.toggle('is-open', this._drawer === 'bookmarks');

    this.thumbsBtn.setAttribute('aria-pressed', this._drawer === 'thumbs' ? 'true' : 'false');
    if (this.bookmarksBtn) this.bookmarksBtn.setAttribute('aria-pressed', this._drawer === 'bookmarks' ? 'true' : 'false');

    this.backdrop.classList.toggle('is-open', this._drawer !== null && isNarrow());
    if (!isNarrow() && this.fitMode !== 'custom') this._relayout(); // stage width changed

    if (this._drawer === 'thumbs' && this.thumbs) this.thumbs.refresh();
  }

  _closeDrawers() {
    if (this._drawer) this._toggleDrawer(this._drawer, false);
  }

  // ─── Bookmarks (Phase 5) — توافق مع localStorage للزوّار + خادم للمُصادَقين ──
  async _toggleCurrentBookmark() {
    await this.state.toggleBookmark(this.page);
    this.analytics.recordBookmark();
    this._syncBookmarkButton();
    this._renderBookmarks();
  }

  _syncBookmarkButton() {
    if (!this.bookmarkBtn) return;
    const on = this.state.isBookmarked(this.page);
    this.bookmarkBtn.classList.toggle('is-active', on);
    this.bookmarkBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = on ? (this.t.bookmarkRemove || '') : (this.t.bookmarkAdd || '');
    if (label) {
      this.bookmarkBtn.setAttribute('aria-label', label);
      this.bookmarkBtn.title = label;
    }
  }

  _renderBookmarks() {
    if (!this.bookmarkPanel) return;
    this.bookmarkPanel.replaceChildren();

    const title = document.createElement('div');
    title.className = 'ep-bookmarks-title';
    title.textContent = this.t.bookmarks || '';
    this.bookmarkPanel.append(title);

    const pages = this.state.bookmarks();
    if (pages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ep-bookmarks-empty';
      empty.textContent = this.t.bookmarksEmpty || '';
      this.bookmarkPanel.append(empty);

      return;
    }

    const list = document.createElement('div');
    list.className = 'ep-bookmarks-list';
    for (const p of pages) {
      const row = document.createElement('div');
      row.className = 'ep-bookmark-row';

      const jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'ep-bookmark-jump';
      jump.textContent = (this.t.searchPageLabel || 'Page :page').replace(':page', String(p));
      jump.addEventListener('click', () => {
        this.goTo(p);
        if (isNarrow()) this.toggleBookmarks(false);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ep-bookmark-remove';
      remove.textContent = '×';
      if (this.t.bookmarkRemove) {
        remove.setAttribute('aria-label', this.t.bookmarkRemove);
        remove.title = this.t.bookmarkRemove;
      }
      remove.addEventListener('click', async () => {
        await this.state.toggleBookmark(p);
        this.analytics.recordBookmark();
        this._renderBookmarks();
        this._syncBookmarkButton();
      });

      row.append(jump, remove);
      list.append(row);
    }
    this.bookmarkPanel.append(list);
  }

  _announce(text) {
    if (this.live && text) this.live.textContent = text;
  }

  // ─── Search highlight pill (Phase 6) — context + dismiss; works in all modes ─
  _buildSearchPill() {
    if (this._pill || !this.body) return;

    const pill = document.createElement('div');
    pill.className = 'ep-searchpill';

    const text = document.createElement('span');
    text.className = 'ep-searchpill-text';
    text.dir = 'auto';
    text.textContent = (this.t.searchOrigin || ':q').replace(':q', this.searchTerm);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ep-searchpill-close';
    close.textContent = '×';
    const label = this.t.clearHighlight || '';
    if (label) {
      close.setAttribute('aria-label', label);
      close.title = label;
    }
    close.addEventListener('click', () => this._clearHighlight());

    pill.append(text, close);
    this.body.append(pill);
    this._pill = pill;
  }

  /** يلغي التظليل: يوقف الباني، يزيل الطبقات القائمة والحبّة، وينظّف ?q من الرابط. */
  _clearHighlight() {
    if (this.highlighter) this.highlighter.active = false;
    this.stage.querySelectorAll('.ep-textlayer').forEach((el) => el.remove());
    if (this._pill) {
      this._pill.remove();
      this._pill = null;
    }
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('q');
      window.history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch { /* ignore */ }
  }

  /** عنصر ملء الشاشة الحاليّ (قياسيّ أو webkit) — null إن لا شيء. */
  _fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  /** أهو في ملء الشاشة؟ (أصليّ أو الزائف على iPhone). */
  _isFs() {
    return this._fsElement() !== null || this._pseudoFs;
  }

  toggleFullscreen() {
    const el = this.root;
    if (this._fsElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    if (this._pseudoFs) {
      this._togglePseudoFs(false);
      return;
    }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      req.call(el);
      return;
    }
    // لا واجهة ملء شاشة أصليّة (iPhone Safari) ⇒ ملء شاشة زائف عبر CSS.
    this._togglePseudoFs(true);
  }

  /** ملء شاشة زائف (position:fixed) — بديل iPhone حيث تغيب الواجهة الأصليّة. */
  _togglePseudoFs(on) {
    this._pseudoFs = on;
    this.root.classList.toggle('ep-pseudo-fs', on);
    document.body.classList.toggle('ep-pseudo-fs-lock', on);
    this._syncFullscreenButton();
    if (this.fitMode !== 'custom') this._relayout();
  }

  // ─── Updates ────────────────────────────────────────────────────────────────
  _reportPage(n) {
    this.page = n;
    this.prevBtn.disabled = n <= 1;
    this.nextBtn.disabled = n >= this.numPages;
    if (document.activeElement !== this.pageInput) this.pageInput.value = String(n);
    if (this.thumbs) this.thumbs.setActive(n);
    this._syncBookmarkButton();
    this.state.saveProgress(n);     // متابعة القراءة (مؤجَّلة خادمياً / localStorage)
    this.analytics.recordPage(n);   // مشاهدة صفحة (بعتبة مكوث)
    this._syncUrl(n);
    this._updateProgress();
  }

  /** يحدّث عرض شريط التقدّم (الصفحة الحاليّة / الإجماليّ) — إضافيّ، آمن عند غياب العنصر. */
  _updateProgress() {
    if (!this.progressFill || !this.numPages) return;
    const pct = Math.max(0, Math.min(100, (this.page / this.numPages) * 100));
    this.progressFill.style.width = `${pct}%`;
  }

  _updateToolbar() {
    this.totalLabel.textContent = String(this.numPages);
    this.pageInput.value = String(this.page);
    this.prevBtn.disabled = this.page <= 1;
    this.nextBtn.disabled = this.page >= this.numPages;
    this.fitWidthBtn.setAttribute('aria-pressed', this.fitMode === 'width' ? 'true' : 'false');
    this.fitPageBtn.setAttribute('aria-pressed', this.fitMode === 'page' ? 'true' : 'false');
    this.fitPageBtn.disabled = this.mode === 'continuous';
    this.singleBtn.setAttribute('aria-pressed', this.mode === 'single' ? 'true' : 'false');
    this.spreadBtn.setAttribute('aria-pressed', this.mode === 'spread' ? 'true' : 'false');
    this.continuousBtn.setAttribute('aria-pressed', this.mode === 'continuous' ? 'true' : 'false');
    this._updateProgress();
  }

  _syncFullscreenButton() {
    this.fsBtn.setAttribute('aria-pressed', this._isFs() ? 'true' : 'false');
    if (this.fitMode !== 'custom') this._relayout();
  }

  _handleResize() {
    if (this.mode === 'spread' && isNarrow()) {
      void this.setMode('single');
      return;
    }
    if (this.fitMode !== 'custom') this._relayout();
  }

  /** Path deep-link: base for page 1 (canonical stays clean), base/p/N otherwise. */
  _syncUrl(n) {
    const url = n <= 1 ? this.canonical : `${this.canonical}/p/${n}`;
    try { window.history.replaceState(null, '', url); } catch { /* ignore */ }
  }

  _handleKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
    const rtl = document.documentElement.dir === 'rtl';
    switch (e.key) {
      case 'ArrowRight': rtl ? this.prev() : this.next(); break;
      case 'ArrowLeft': rtl ? this.next() : this.prev(); break;
      case 'ArrowDown': case 'PageDown': case ' ': this.next(); break;
      case 'ArrowUp': case 'PageUp': this.prev(); break;
      case 'Home': this.goTo(1); break;
      case 'End': this.goTo(this.numPages); break;
      case '+': case '=': this.zoom(ZOOM_STEP); break;
      case '-': case '_': this.zoom(1 / ZOOM_STEP); break;
      default: return;
    }
    e.preventDefault();
  }

  /**
   * حالة فشل دفاعية داخل الحاوية:
   *  - denied: انتهى الاستحقاق ⇒ رسالة + زرّ اشتراك (إن توفّر رابط).
   *  - delivery: تعذّر التحميل مؤقتاً ⇒ رسالة + إعادة محاولة (تحميل الصفحة).
   */
  _showState(kind) {
    if (this.ui) this.ui.style.display = 'none';
    if (!this.fallback) return;
    this.fallback.style.display = '';
    this.fallback.replaceChildren();

    const msg = document.createElement('p');
    msg.className = 'ep-statemsg';
    msg.textContent = kind === 'denied' ? this.t.denied || '' : this.t.deliveryError || '';
    this.fallback.append(msg);

    if (kind === 'denied' && this.subscribeUrl) {
      const a = document.createElement('a');
      a.href = this.subscribeUrl;
      a.className = 'ep-statebtn';
      a.textContent = this.t.subscribe || '';
      this.fallback.append(a);
    } else if (kind === 'delivery') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ep-statebtn';
      b.textContent = this.t.retry || '';
      b.addEventListener('click', () => window.location.reload());
      this.fallback.append(b);
    }
  }
}
