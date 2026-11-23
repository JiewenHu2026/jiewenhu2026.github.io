(() => {
  'use strict';

  const index = document.querySelector('.home-work-index');
  const collage = document.querySelector('.home-artwork-display');
  if (!index || !collage) return;

  const preview = new Image();
  preview.alt = '';
  preview.className = 'home-index-preview';
  document.body.append(preview);
  let current = null;

  function hide() {
    current = null;
    preview.classList.remove('is-visible');
  }

  function show(link, x, y) {
    if (collage.open || !link) {
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
    if (current && !collage.open) preview.classList.add('is-visible');
  });
  index.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    show(event.target.closest('a[data-preview]'), event.clientX, event.clientY);
  }, { passive: true });
  index.addEventListener('pointerleave', hide);
  index.addEventListener('focusin', (event) => {
    const link = event.target.closest('a[data-preview]:focus-visible');
    if (!link) return;
    const bounds = link.getBoundingClientRect();
    show(link, bounds.left, bounds.bottom);
  });
  index.addEventListener('focusout', hide);
  collage.addEventListener('toggle', hide);
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
})();
