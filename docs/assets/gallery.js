(() => {
  'use strict';

  const gallery = document.querySelector('[data-gallery]');
  const viewport = gallery?.querySelector('.project-slides');
  const slides = [...(gallery?.querySelectorAll('[data-slide]') || [])];
  // Leave the complete, scrollable document intact when enhancement is unavailable.
  if (!viewport || !slides.length || typeof HTMLDialogElement === 'undefined' ||
      typeof HTMLDialogElement.prototype.showModal !== 'function') return;

  const nav = gallery.querySelector('.slide-navigation');
  const dots = [...(nav?.querySelectorAll('[data-slide-link]') || [])];
  const count = gallery.querySelector('[data-count]');
  const info = document.getElementById('project-info');
  const narrative = document.getElementById('project-narrative');
  const previousButtons = [...gallery.querySelectorAll('[data-prev]')];
  const nextButtons = [...gallery.querySelectorAll('[data-next]')];
  const drawingButtons = [...gallery.querySelectorAll('[data-open-drawing]')];
  let status = gallery.querySelector('[data-gallery-status]');
  if (!status) {
    status = document.createElement('p');
    status.setAttribute('data-gallery-status', '');
    status.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
    gallery.append(status);
  }
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  gallery.tabIndex = -1;
  viewport.setAttribute('aria-roledescription', 'carousel');
  nav?.style.setProperty('--dots', slides.length);

  const byId = new Map();
  slides.forEach((slide, index) => {
    [slide.id, ...(slide.dataset.slideAliases || '').split(/\s+/)].filter(Boolean)
      .forEach(id => byId.set(id.replace(/^#/, ''), index));
  });
  function hashId() {
    try { return decodeURIComponent(location.hash.slice(1)); }
    catch { return location.hash.slice(1); }
  }
  const dotIndex = dot => byId.get((dot.getAttribute('href') || '').replace(/^#/, '')) ?? dots.indexOf(dot);
  const number = value => String(value).padStart(2, '0');
  const modified = event => event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
  const blocked = () => Boolean(document.querySelector('dialog[open]'));
  const clamp = index => Math.max(0, Math.min(index, slides.length - 1));
  let active = -1;
  let suppressClickUntil = 0;

  function focusSafely(preferred) {
    const target = preferred?.isConnected && !preferred.closest('[hidden], [inert]') && !preferred.disabled
      ? preferred : gallery;
    target.focus({ preventScroll: true });
  }
  function drawingFor(slide) {
    const image = slide?.querySelector('img');
    if (!image) return null;
    const link = image.closest('a');
    return { image, link, url: link?.href || image.currentSrc || image.src };
  }
  function setUnavailable(control, unavailable) {
    control.setAttribute('aria-disabled', String(unavailable));
    if ('disabled' in control) control.disabled = unavailable;
  }
  function show(index, syncUrl = true, focus = false) {
    const next = clamp(index);
    const previous = slides[active];
    const hadFocus = previous?.contains(document.activeElement);
    if (next !== active) {
      slides.forEach((slide, i) => {
        const selected = i === next;
        slide.hidden = !selected;
        slide.inert = !selected;
        slide.classList.toggle('is-active', selected);
        if (selected) slide.removeAttribute('aria-hidden');
        else slide.setAttribute('aria-hidden', 'true');
      });
      active = next;
      dots.forEach(dot => {
        if (dotIndex(dot) === active) dot.setAttribute('aria-current', 'location');
        else dot.removeAttribute('aria-current');
      });
      if (count) count.textContent = number(active + 1) + ' / ' + number(slides.length);
      const caption = slides[active].getAttribute('aria-label') || slides[active].querySelector('figcaption, h2')?.textContent.trim() || 'Project page';
      status.textContent = (active + 1) + ' of ' + slides.length + ': ' + caption;
      previousButtons.forEach(button => setUnavailable(button, active === 0));
      nextButtons.forEach(button => setUnavailable(button, active === slides.length - 1));
      const drawing = drawingFor(slides[active]);
      drawingButtons.forEach(button => {
        setUnavailable(button, !drawing);
        if (button.tagName === 'A') {
          if (drawing) button.href = drawing.url;
          else button.removeAttribute('href');
        }
      });
      const dot = dots.find(item => dotIndex(item) === active);
      if (dot && nav) {
        if (dot.offsetTop < nav.scrollTop) nav.scrollTop = dot.offsetTop;
        else if (dot.offsetTop + dot.offsetHeight > nav.scrollTop + nav.clientHeight) {
          nav.scrollTop = dot.offsetTop + dot.offsetHeight - nav.clientHeight;
        }
      }
      [active - 1, active, active + 1].forEach(i => {
        const image = slides[i]?.querySelector('img');
        if (image) image.loading = 'eager';
      });
      if (focus || hadFocus) {
        slides[active].tabIndex = -1;
        focusSafely(slides[active]);
      }
    }
    if (syncUrl) history.replaceState(null, '', '#' + slides[active].id);
  }

  function bindDialog(dialog, triggers) {
    if (!dialog) return () => {};
    let trigger = null;
    const open = element => {
      if (dialog.open || blocked()) return;
      trigger = element;
      dialog.showModal();
      if (dialog === info) document.body.classList.add('info-open');
    };
    triggers.forEach(button => button.addEventListener('click', event => {
      if (modified(event) && button.tagName === 'A') return;
      event.preventDefault();
      open(button);
    }));
    dialog.addEventListener('click', event => {
      const close = event.target.closest?.('.dialog-close, [data-close-info], [data-info-close], [data-narrative-close]');
      if (event.target === dialog || close) {
        event.preventDefault();
        dialog.close();
      }
    });
    dialog.addEventListener('close', () => {
      if (dialog === info) document.body.classList.remove('info-open');
      focusSafely(trigger);
    });
    return open;
  }
  const openInfo = bindDialog(info, [...gallery.querySelectorAll('[data-info]')]);
  bindDialog(narrative, [...gallery.querySelectorAll('[data-narrative]')]);

  const viewer = document.createElement('dialog');
  viewer.className = 'drawing-viewer';
  viewer.setAttribute('aria-label', 'Drawing viewer');
  viewer.innerHTML = '<div class="viewer-toolbar"><p>Drawing</p><div class="viewer-actions"><button type="button" data-zoom aria-label="Show full size" aria-pressed="false">＋</button><button class="dialog-close" type="button" aria-label="Close drawing viewer" autofocus>×</button></div></div><div class="viewer-canvas"><img alt=""></div>';
  document.body.append(viewer);
  const canvas = viewer.querySelector('.viewer-canvas');
  const viewerImage = canvas.querySelector('img');
  const zoom = viewer.querySelector('[data-zoom]');
  let viewerTrigger = null;
  function setZoom(state) {
    canvas.classList.toggle('is-zoomed', state);
    zoom.setAttribute('aria-pressed', String(state));
    zoom.setAttribute('aria-label', state ? 'Fit drawing to window' : 'Show full size');
    zoom.textContent = state ? '−' : '＋';
    if (!state) canvas.scrollTo({ top: 0, left: 0 });
  }
  zoom.addEventListener('click', () => setZoom(!canvas.classList.contains('is-zoomed')));
  viewer.querySelector('.dialog-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => {
    setZoom(false);
    viewerImage.removeAttribute('src');
    focusSafely(viewerTrigger);
  });
  drawingButtons.forEach(button => button.addEventListener('click', event => {
    if (modified(event) && button.tagName === 'A') return;
    event.preventDefault();
    const drawing = drawingFor(slides[active]);
    if (!drawing || blocked()) return;
    viewerTrigger = button;
    viewer.querySelector('.viewer-toolbar p').textContent = slides[active].querySelector('figcaption')?.textContent.trim() || 'Drawing';
    viewerImage.alt = drawing.image.alt;
    viewerImage.src = drawing.url;
    viewer.showModal();
  }));

  gallery.classList.add('gallery-ready');
  show(byId.get(hashId()) ?? 0, false);
  if (!location.hash || hashId() === 'details-title') openInfo(null);
  addEventListener('hashchange', () => {
    const id = hashId();
    if (id === 'details-title') { openInfo(null); return; }
    if (byId.has(id) || !id) {
      if (info?.open) info.close();
      if (narrative?.open) narrative.close();
      if (viewer.open) viewer.close();
      show(byId.get(id) ?? 0, false);
    }
  });
  dots.forEach(dot => dot.addEventListener('click', event => {
    if (modified(event)) return;
    event.preventDefault();
    if (!blocked()) show(dotIndex(dot));
  }));
  previousButtons.forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    if (!blocked()) show(active - 1);
  }));
  nextButtons.forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    if (!blocked()) show(active + 1);
  }));

  function scrollable(target, direction, axis = 'y') {
    const slide = slides[active];
    let element = target instanceof Element && slide.contains(target) ? target : slide;
    while (element && element !== viewport) {
      const vertical = axis === 'y';
      const position = vertical ? element.scrollTop : element.scrollLeft;
      const maximum = vertical ? element.scrollHeight - element.clientHeight : element.scrollWidth - element.clientWidth;
      const overflow = getComputedStyle(element)[vertical ? 'overflowY' : 'overflowX'];
      if (maximum > 1 && /auto|scroll/.test(overflow) && (direction < 0 ? position > 1 : position < maximum - 1)) return element;
      if (element === slide) break;
      element = element.parentElement;
    }
    return null;
  }
  viewport.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  viewport.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || modified(event) || blocked()) return;
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (target.closest('button, input, textarea, select, summary, details, [contenteditable="true"]')) return;
    const link = target.closest('a');
    if (link && link !== drawingFor(slides[active])?.link) return;
    const selection = getSelection();
    if (selection && !selection.isCollapsed && gallery.contains(selection.anchorNode)) return;
    // Text remains a reading surface; only its empty background at the end advances.
    if (slides[active].classList.contains('story-slide') &&
        (target !== slides[active] || scrollable(target, 1))) return;
    event.preventDefault();
    show((active + 1) % slides.length);
  });

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || blocked()) return;
    const target = event.target;
    if (target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === ' ' && target.closest?.('button, a, summary')) return;
    const focusedDot = target.closest?.('[data-slide-link]');
    const from = focusedDot ? dotIndex(focusedDot) : active;
    let next;
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(event.key)) next = from + (event.key === ' ' && event.shiftKey ? -1 : 1);
    if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key)) next = from - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = slides.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    if (event.repeat) return;
    const reader = !focusedDot && !['Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key) && scrollable(target, next - from);
    if (reader) {
      reader.scrollTop += Math.sign(next - from) * (event.key.startsWith('Arrow') ? 48 : reader.clientHeight * .8);
      return;
    }
    show(next);
    if (focusedDot) focusSafely(dots.find(dot => dotIndex(dot) === active));
  });

  let wheelDistance = 0;
  let wheelDirection = 0;
  let wheelConsumed = false;
  let wheelIdle = 0;
  viewport.addEventListener('wheel', event => {
    if (blocked() || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { wheelDistance = 0; wheelDirection = 0; wheelConsumed = false; }, 240);
    if (scrollable(event.target, event.deltaY)) { wheelConsumed = true; return; }
    event.preventDefault();
    if (wheelConsumed) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
    if (!delta) return;
    const direction = Math.sign(delta);
    if (direction !== wheelDirection) wheelDistance = 0;
    wheelDirection = direction;
    wheelDistance += Math.abs(delta);
    if (wheelDistance >= 48) { wheelConsumed = true; show(active + direction); }
  }, { passive: false });

  let touch = null;
  const zoomed = () => window.visualViewport && window.visualViewport.scale > 1.01;
  function updateTouchAction() { viewport.style.touchAction = zoomed() ? 'auto' : 'pinch-zoom'; }
  updateTouchAction();
  window.visualViewport?.addEventListener('resize', updateTouchAction);
  viewport.addEventListener('touchstart', event => {
    if (blocked() || event.touches.length !== 1 || zoomed()) { touch = null; return; }
    const point = event.touches[0];
    touch = { x: point.clientX, y: point.clientY, lastX: point.clientX, lastY: point.clientY, target: event.target, scrolled: false };
  }, { passive: true });
  viewport.addEventListener('touchmove', event => {
    if (event.touches.length !== 1 || blocked() || zoomed()) { touch = null; return; }
    if (!touch) return;
    const point = event.touches[0];
    const dx = point.clientX - touch.x;
    const dy = point.clientY - touch.y;
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.2;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
    if (!vertical && !horizontal) return;
    const delta = vertical ? touch.lastY - point.clientY : touch.lastX - point.clientX;
    const reader = scrollable(touch.target, Math.sign(delta), vertical ? 'y' : 'x');
    if (reader) {
      if (vertical) reader.scrollTop += delta;
      else reader.scrollLeft += delta;
      touch.scrolled = true;
    }
    touch.lastX = point.clientX;
    touch.lastY = point.clientY;
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
  viewport.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
  viewport.addEventListener('touchend', event => {
    const start = touch;
    touch = null;
    if (!start || event.touches.length || !event.changedTouches.length || blocked()) return;
    if (start.scrolled) { suppressClickUntil = performance.now() + 650; return; }
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    const delta = Math.abs(dx) > Math.abs(dy) * 1.2 ? dx : Math.abs(dy) > Math.abs(dx) * 1.2 ? dy : 0;
    if (Math.abs(delta) < 48) return;
    if (event.cancelable) event.preventDefault();
    suppressClickUntil = performance.now() + 650;
    show(active + (delta < 0 ? 1 : -1));
  }, { passive: false });
})();
