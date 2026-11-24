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
  const arrows = viewport.querySelector('[data-gallery-arrows]');
  const previousButton = arrows?.querySelector('[data-prev]');
  const nextButton = arrows?.querySelector('[data-next]');
  const info = document.getElementById('project-info');
  const narrative = document.getElementById('project-narrative');
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
  const modified = event => event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
  const blocked = () => Boolean(document.querySelector('dialog[open]'));
  const clamp = index => Math.max(0, Math.min(index, slides.length - 1));
  let active = -1;
  let suppressClickUntil = 0;
  const bookTarget = target => target instanceof Element && target.closest('[data-project-book]');
  const zoomed = () => window.visualViewport && window.visualViewport.scale > 1.01;

  function updateTouchAction() {
    viewport.style.touchAction = zoomed() || bookTarget(slides[active]) ? 'auto' : 'pinch-zoom';
  }

  function focusSafely(preferred) {
    const target = preferred?.isConnected && !preferred.closest('[hidden], [inert]') && !preferred.disabled
      ? preferred : gallery;
    target.focus({ preventScroll: true });
  }
  function positionArrows() {
    if (!arrows || arrows.hidden) return;
    const image = slides[active]?.querySelector('img');
    if (!image?.naturalWidth) {
      for (const property of ['--previous-x', '--next-x', '--arrow-y']) arrows.style.removeProperty(property);
      return;
    }
    const stage = viewport.getBoundingClientRect();
    const box = image.getBoundingClientRect();
    const displayedWidth = Math.min(box.width, box.height * image.naturalWidth / image.naturalHeight);
    const center = box.left - stage.left + box.width / 2;
    const gap = stage.width <= 680 ? 18 : 26;
    const railLeft = (nav?.getBoundingClientRect().left ?? stage.right) - stage.left;
    const nextLimit = railLeft - (nextButton?.offsetWidth ?? 0) / 2;
    arrows.style.setProperty('--previous-x', Math.max(gap, center - displayedWidth / 2 - gap) + 'px');
    arrows.style.setProperty('--next-x', Math.min(nextLimit, center + displayedWidth / 2 + gap) + 'px');
    arrows.style.setProperty('--arrow-y', box.top - stage.top + box.height / 2 + 'px');
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
      if (arrows) arrows.hidden = Boolean(bookTarget(slides[active]));
      updateTouchAction();
      if (previousButton) previousButton.disabled = active === 0;
      if (nextButton) nextButton.disabled = active === slides.length - 1;
      positionArrows();
      dots.forEach(dot => {
        if (dotIndex(dot) === active) dot.setAttribute('aria-current', 'location');
        else dot.removeAttribute('aria-current');
      });
      const caption = slides[active].getAttribute('aria-label') ||
        slides[active].querySelector('figcaption, h2')?.textContent.trim() ||
        slides[active].querySelector('img')?.alt || 'Project page';
      status.textContent = (active + 1) + ' of ' + slides.length + ': ' + caption;
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

  function bindDialog(dialog, triggers = []) {
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
  const openInfo = bindDialog(info);
  bindDialog(narrative, [...gallery.querySelectorAll('[data-narrative]')]);

  gallery.classList.add('gallery-ready');
  show(byId.get(hashId()) ?? 0, false);
  if (!location.hash || hashId() === 'details-title') openInfo(null);
  if (previousButton && nextButton) {
    previousButton.addEventListener('click', () => { if (!blocked()) show(active - 1); });
    nextButton.addEventListener('click', () => { if (!blocked()) show(active + 1); });
    viewport.addEventListener('load', (event) => {
      if (slides[active].contains(event.target)) positionArrows();
    }, true);
    addEventListener('resize', positionArrows);
  }
  addEventListener('hashchange', () => {
    const id = hashId();
    if (id === 'details-title') { openInfo(null); return; }
    if (byId.has(id) || !id) {
      if (info?.open) info.close();
      if (narrative?.open) narrative.close();
      show(byId.get(id) ?? 0, false);
    }
  });
  dots.forEach(dot => dot.addEventListener('click', event => {
    if (modified(event)) return;
    event.preventDefault();
    if (!blocked()) show(dotIndex(dot));
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
    if (!bookTarget(event.target) && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  viewport.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || modified(event) || blocked() || bookTarget(event.target)) return;
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (target.closest('button, input, textarea, select, summary, details, [contenteditable="true"]')) return;
    const link = target.closest('a');
    if (link && link !== slides[active].querySelector('img')?.closest('a')) return;
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
    if (bookTarget(target)) return;
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
    if (blocked() || event.ctrlKey || bookTarget(event.target) || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
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
  window.visualViewport?.addEventListener('resize', updateTouchAction);
  viewport.addEventListener('touchstart', event => {
    if (blocked() || event.touches.length !== 1 || zoomed() || bookTarget(event.target)) { touch = null; return; }
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
