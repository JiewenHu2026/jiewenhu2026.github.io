(() => {
  'use strict';

  function initialize() {
    const about = document.querySelector('.about-page');
    if (!about || !('IntersectionObserver' in window)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;
    const targets = [...about.querySelectorAll('[data-about-reveal]')];
    if (!targets.length) return;
    let observer;

    function reveal(target, immediate = false) {
      if (immediate) target.setAttribute('data-about-reveal-immediate', '');
      target.setAttribute('data-about-reveal-state', 'visible');
      observer?.unobserve(target);
    }

    function revealAncestors(element) {
      for (let target = element; target && about.contains(target); target = target.parentElement) {
        if (target.matches('[data-about-reveal]')) reveal(target, true);
      }
    }

    function revealHash() {
      if (!window.location.hash) return;
      let id;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      revealAncestors(document.getElementById(id));
    }

    try {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) reveal(entry.target);
        });
      }, { threshold: 0.01, rootMargin: '0px 0px -12px 0px' });
      targets.forEach((target) => {
        target.setAttribute('data-about-reveal-state', 'pending');
        observer.observe(target);
      });
      revealHash();
      revealAncestors(document.activeElement);
    } catch {
      targets.forEach((target) => reveal(target, true));
      observer?.disconnect();
      return;
    }

    about.addEventListener('focusin', (event) => revealAncestors(event.target));
    window.addEventListener('hashchange', revealHash);
    window.addEventListener('beforeprint', () => {
      targets.forEach((target) => reveal(target, true));
      observer.disconnect();
    });
    motion.addEventListener('change', () => {
      if (!motion.matches) return;
      targets.forEach((target) => reveal(target, true));
      observer.disconnect();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
