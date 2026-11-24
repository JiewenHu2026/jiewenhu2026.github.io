(() => {
  'use strict';

  function initialize() {
    const cards = [...document.querySelectorAll('.selected-project-card')]
      .map((card) => ({
        card,
        image: card.querySelector('.selected-project-image'),
        caption: card.querySelector('.selected-project-caption')
      }))
      .filter(({ image, caption }) => image && caption);
    if (!cards.length) return;

    const desktop = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
    const property = '--project-preview-offset-y';
    let frame = 0;

    function align() {
      frame = 0;
      if (!desktop.matches) {
        cards.forEach(({ card }) => card.style.removeProperty(property));
        return;
      }

      const measurements = cards.map(({ card, image, caption }) => {
        const artwork = image.getBoundingClientRect();
        const text = caption.getBoundingClientRect();
        const previous = Number.parseFloat(card.style.getPropertyValue(property)) || 0;
        // Remove the previous visual translation from the measured image center.
        const offset = text.top + text.height / 2 - artwork.top - artwork.height / 2 + previous;
        return { card, previous, offset: Math.round(offset * 1000) / 1000 };
      });
      measurements.forEach(({ card, previous, offset }) => {
        if (Number.isFinite(offset) && Math.abs(offset - previous) > 0.01) {
          card.style.setProperty(property, offset + 'px');
        }
      });
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(align);
    }

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(schedule);
      cards.forEach(({ image, caption }) => {
        observer.observe(image);
        observer.observe(caption);
      });
    }
    cards.forEach(({ image }) => image.querySelector('img')?.addEventListener('load', schedule));
    desktop.addEventListener('change', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    document.fonts?.ready.then(schedule);
    document.fonts?.addEventListener('loadingdone', schedule);
    align();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
