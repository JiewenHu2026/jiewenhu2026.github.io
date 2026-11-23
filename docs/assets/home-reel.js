(() => {
  'use strict';

  function initialize(reel, reelIndex) {
    const slides = [...reel.querySelectorAll('[data-reel-slide]')];
    if (!slides.length) return;
    const previous = reel.querySelector('[data-reel-prev]');
    const next = reel.querySelector('[data-reel-next]');
    const toggle = reel.querySelector('[data-reel-toggle]');
    const current = reel.querySelector('[data-reel-current]');
    const total = reel.querySelector('[data-reel-total]');
    const choices = [...reel.querySelectorAll('[data-reel-choice]')];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = Math.max(0, slides.findIndex((slide) => !slide.hidden));
    let paused = false;
    let hovered = false;
    let pageVisible = true;
    let inView = !('IntersectionObserver' in window);
    let timer = null;
    let fade = null;

    if (!reel.hasAttribute('role')) reel.setAttribute('role', 'region');
    if (!reel.hasAttribute('aria-label') && !reel.hasAttribute('aria-labelledby')) {
      reel.setAttribute('aria-label', 'Selected projects');
    }
    reel.setAttribute('aria-roledescription', 'carousel');
    if (!reel.hasAttribute('tabindex')) reel.tabIndex = 0;
    slides.forEach((slide, index) => {
      if (!slide.id) slide.id = 'home-reel-' + (reelIndex + 1) + '-slide-' + (index + 1);
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      if (!slide.hasAttribute('aria-label') && !slide.hasAttribute('aria-labelledby')) {
        slide.setAttribute('aria-label', (index + 1) + ' of ' + slides.length);
      }
    });

    function stopTimer() {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    }

    function schedule() {
      stopTimer();
      if (slides.length < 2 || paused || motion.matches || hovered || !inView ||
        !pageVisible || document.visibilityState === 'hidden' || reel.contains(document.activeElement)) return;
      timer = window.setTimeout(() => show(active + 1), 5000);
    }

    function choiceIndex(choice, index) {
      const value = choice.getAttribute('data-reel-choice');
      return value === '' ? index : Number(value);
    }

    function updateControls() {
      if (current) current.textContent = String(active + 1).padStart(2, '0');
      if (total) total.textContent = String(slides.length).padStart(2, '0');
      choices.forEach((choice, index) => {
        const slideIndex = choiceIndex(choice, index);
        if (slideIndex === active) choice.setAttribute('aria-current', 'true');
        else choice.removeAttribute('aria-current');
      });
      if (!toggle) return;
      const enabled = slides.length > 1 && !paused && !motion.matches;
      toggle.textContent = enabled ? 'Pause' : 'Play';
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.setAttribute('aria-label', motion.matches
        ? 'Automatic slideshow disabled by reduced motion preference'
        : enabled ? 'Pause slideshow' : 'Play slideshow');
      toggle.disabled = slides.length < 2 || motion.matches;
    }

    function show(index, animate = true) {
      const target = (index + slides.length) % slides.length;
      if (target === active && animate) {
        schedule();
        return;
      }
      const oldSlide = slides[active];
      const moveFocus = oldSlide.contains(document.activeElement);
      fade?.cancel();
      slides.forEach((slide, slideIndex) => {
        slide.hidden = slideIndex !== target;
        slide.setAttribute('aria-hidden', String(slideIndex !== target));
      });
      active = target;
      if (animate && !motion.matches && typeof slides[active].animate === 'function') {
        fade = slides[active].animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 280,
          easing: 'ease-out',
        });
      }
      if (moveFocus) {
        const focusTarget = slides[active].querySelector('a[href], button:not(:disabled), [tabindex="0"]');
        (focusTarget || reel).focus({ preventScroll: true });
      }
      updateControls();
      schedule();
    }

    previous?.addEventListener('click', (event) => {
      event.preventDefault();
      show(active - 1);
    });
    next?.addEventListener('click', (event) => {
      event.preventDefault();
      show(active + 1);
    });
    toggle?.addEventListener('click', (event) => {
      event.preventDefault();
      if (motion.matches) return;
      paused = !paused;
      updateControls();
      schedule();
    });
    choices.forEach((choice, index) => {
      const target = choiceIndex(choice, index);
      if (!Number.isInteger(target) || target < 0 || target >= slides.length) return;
      choice.setAttribute('aria-controls', slides[target].id);
      if (!choice.hasAttribute('aria-label')) {
        choice.setAttribute('aria-label', 'Show project ' + (target + 1) + ' of ' + slides.length);
      }
      choice.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        show(target);
      });
    });
    reel.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        event.target.closest('input, textarea, select, [contenteditable], [role="slider"]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        show(active + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    reel.addEventListener('focusin', stopTimer);
    reel.addEventListener('focusout', () => queueMicrotask(schedule));
    reel.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      hovered = true;
      stopTimer();
    });
    reel.addEventListener('pointerleave', () => {
      hovered = false;
      schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('pagehide', () => {
      pageVisible = false;
      hovered = false;
      fade?.cancel();
      stopTimer();
    });
    window.addEventListener('pageshow', () => {
      pageVisible = true;
      schedule();
    });
    motion.addEventListener('change', () => {
      fade?.cancel();
      updateControls();
      schedule();
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        schedule();
      }, { threshold: [0, 0.2] });
      observer.observe(reel);
    }
    if (slides.length < 2) {
      if (previous) previous.disabled = true;
      if (next) next.disabled = true;
    }
    show(active, false);
    reel.setAttribute('data-reel-ready', '');
  }

  function initializeReels() {
    document.querySelectorAll('[data-home-reel]').forEach(initialize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReels, { once: true });
  } else {
    initializeReels();
  }
})();
