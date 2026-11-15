(() => {
  'use strict';
  const gallery = document.querySelector('[data-gallery]');
  if (!gallery || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;

  const viewport = gallery.querySelector('.project-slides');
  const slides = [...gallery.querySelectorAll('[data-slide]')];
  const nav = gallery.querySelector('.slide-navigation');
  const dots = [...nav.querySelectorAll('[data-slide-link]')];
  const count = gallery.querySelector('[data-count]');
  const info = gallery.querySelector('#project-info');
  if (slides.length < 2 || slides.length !== dots.length || !info) return;

  gallery.tabIndex = -1;
  nav.style.setProperty('--dots', slides.length);
  const indexById = new Map(slides.map((slide, index) => ['#' + slide.id, index]));
  const number = (value) => String(value).padStart(2, '0');
  let active = -1;

  function show(index, syncUrl = true, focus = false) {
    const next = (index + slides.length) % slides.length;
    if (next !== active) {
      const previous = slides[active];
      const hadFocus = previous && previous.contains(document.activeElement);
      if (previous) previous.hidden = true;
      slides[next].hidden = false;
      dots[active]?.removeAttribute('aria-current');
      dots[next].setAttribute('aria-current', 'location');
      count.textContent = number(next + 1) + ' / ' + number(slides.length);
      active = next;
      const dot = dots[next];
      if (dot.offsetTop < nav.scrollTop) nav.scrollTop = dot.offsetTop;
      else if (dot.offsetTop + dot.offsetHeight > nav.scrollTop + nav.clientHeight) {
        nav.scrollTop = dot.offsetTop + dot.offsetHeight - nav.clientHeight;
      }
      if (focus || hadFocus) {
        slides[next].tabIndex = -1;
        slides[next].focus({ preventScroll: true });
      }
    }
    if (syncUrl) history.replaceState(null, '', '#' + slides[next].id);
  }

  const go = (direction) => show(active + direction);
  slides.forEach((slide) => { slide.hidden = true; });
  gallery.classList.add('gallery-ready');
  show(indexById.get(location.hash) ?? 0, false);

  dots.forEach((dot, i) => dot.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    show(i);
  }));
  addEventListener('hashchange', () => {
    if (indexById.has(location.hash)) show(indexById.get(location.hash), false);
    else if (!location.hash) show(0, false);
  });
  gallery.querySelector('[data-prev]').addEventListener('click', () => go(-1));
  gallery.querySelector('[data-next]').addEventListener('click', () => go(1));
  gallery.querySelector('[data-info]').addEventListener('click', () => info.showModal());
  info.addEventListener('click', (event) => { if (event.target === info) info.close(); });

  const viewer = document.createElement('dialog');
  viewer.className = 'drawing-viewer';
  viewer.setAttribute('aria-label', 'Drawing viewer');
  viewer.innerHTML = '<div class="viewer-toolbar"><p>Drawing</p><div class="viewer-actions"><button type="button" data-zoom aria-label="Show full size" aria-pressed="false">＋</button><button class="dialog-close" type="button" aria-label="Close drawing viewer" autofocus>×</button></div></div><div class="viewer-canvas"><img alt=""></div>';
  document.body.append(viewer);
  const canvas = viewer.querySelector('.viewer-canvas');
  const viewerImage = canvas.querySelector('img');
  const zoom = viewer.querySelector('[data-zoom]');
  const viewerTitle = viewer.querySelector('p');
  let viewerTrigger;
  function setZoom(state) {
    canvas.classList.toggle('is-zoomed', state);
    zoom.setAttribute('aria-pressed', String(state));
    zoom.setAttribute('aria-label', state ? 'Fit drawing to window' : 'Show full size');
    zoom.textContent = state ? '−' : '＋';
    if (!state) canvas.scrollTo({ top: 0, left: 0 });
  }
  zoom.addEventListener('click', () => setZoom(!canvas.classList.contains('is-zoomed')));
  viewer.querySelector('.dialog-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => {
    setZoom(false);
    viewerImage.removeAttribute('src');
    viewerTrigger?.focus({ preventScroll: true });
  });
  viewport.addEventListener('click', (event) => {
    const link = event.target.closest('.drawing-link');
    if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    const image = link.querySelector('img');
    viewerTitle.textContent = link.closest('figure').querySelector('figcaption')?.textContent ?? 'Drawing';
    viewerImage.alt = image.alt;
    viewerImage.src = link.href;
    viewerTrigger = link;
    viewer.showModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.metaKey || event.ctrlKey || event.defaultPrevented || info.open || viewer.open) return;
    const inStory = slides[active].classList.contains('story-slide');
    switch (event.key) {
      case 'ArrowLeft': event.preventDefault(); go(-1); break;
      case 'ArrowRight': event.preventDefault(); go(1); break;
      case 'Home': if (!inStory) { event.preventDefault(); show(0); } break;
      case 'End': if (!inStory) { event.preventDefault(); show(slides.length - 1); } break;
      case 'PageUp':
      case 'ArrowUp': if (!inStory) { event.preventDefault(); go(-1); } break;
      case 'PageDown':
      case 'ArrowDown': if (!inStory) { event.preventDefault(); go(1); } break;
    }
  });

  let touch;
  let swiped = 0;
  viewport.addEventListener('touchstart', (event) => {
    touch = event.touches.length === 1 ? [event.touches[0].clientX, event.touches[0].clientY] : null;
  }, { passive: true });
  viewport.addEventListener('touchend', (event) => {
    if (!touch || event.touches.length || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touch[0];
    const dy = event.changedTouches[0].clientY - touch[1];
    touch = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.4 * Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
      swiped = performance.now();
    }
  }, { passive: true });
  viewport.addEventListener('click', (event) => {
    if (swiped && performance.now() - swiped < 300) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  let lastWheel = 0;
  let wheelTotal = 0;
  viewport.addEventListener('wheel', (event) => {
    if (event.ctrlKey || slides[active].classList.contains('story-slide')) return;
    const now = performance.now();
    const idle = now - lastWheel;
    lastWheel = now;
    if (idle > 220) wheelTotal = 0;
    if (wheelTotal === Infinity) return;
    wheelTotal += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(wheelTotal) < 38 && event.deltaMode === 0) return;
    go(wheelTotal < 0 ? -1 : 1);
    wheelTotal = Infinity;
  }, { passive: true });
})();
