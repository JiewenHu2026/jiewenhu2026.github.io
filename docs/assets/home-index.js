(() => {
  'use strict';

  const stage = document.querySelector('.home-reel');
  const index = stage?.querySelector('.home-work-index');
  const notice = document.querySelector('.home-status');

  function showNotice() {
    if (typeof notice?.showModal !== 'function') return;
    const key = 'portfolio-wip-dismissed';
    try {
      if (sessionStorage.getItem(key) === '1') return;
    } catch {
      // The notice can still be dismissed when storage is unavailable.
    }
    notice.addEventListener('close', () => {
      try { sessionStorage.setItem(key, '1'); }
      catch { /* The current page stays usable without storage. */ }
    }, { once: true });
    notice.showModal();
  }

  showNotice();
  if (!index) return;

  const preview = new Image();
  preview.alt = '';
  preview.className = 'home-index-preview';
  stage.append(preview);
  let current = null;

  function hide() {
    current = null;
    preview.classList.remove('is-visible');
  }

  function show(link, x, y) {
    if (!link || notice?.open) {
      hide();
      return;
    }
    if (current !== link) {
      current = link;
      preview.classList.remove('is-visible');
      preview.setAttribute('src', link.dataset.preview);
    }
    const gap = 18;
    const padding = 10;
    const { clientWidth, clientHeight } = document.documentElement;
    const width = preview.offsetWidth;
    const height = preview.offsetHeight;
    const left = x + width + gap < clientWidth - padding ? x + gap : x - width - gap;
    const top = y + height + gap < clientHeight - padding ? y + gap : y - height - gap;
    preview.style.left = Math.max(padding, left) + 'px';
    preview.style.top = Math.max(padding, top) + 'px';
    if (preview.complete && preview.naturalWidth) preview.classList.add('is-visible');
  }

  preview.addEventListener('load', () => {
    if (current && !notice?.open) preview.classList.add('is-visible');
  });
  function updatePreview(event) {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    show(event.target.closest('a[data-preview]'), event.clientX, event.clientY);
  }
  index.addEventListener('pointerover', updatePreview, { passive: true });
  index.addEventListener('pointermove', updatePreview, { passive: true });
  index.addEventListener('pointerleave', hide);
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
})();
