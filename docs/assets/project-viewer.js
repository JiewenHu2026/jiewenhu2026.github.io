(() => {
  'use strict';

  function initialize() {
    const story = document.querySelector('[data-project-story]');
    const viewer = document.querySelector('[data-project-viewer]');
    if (!story || !viewer || typeof viewer.showModal !== 'function'
      || typeof viewer.close !== 'function') return;

    const image = viewer.querySelector('[data-viewer-full]');
    const caption = viewer.querySelector('#viewer-caption');
    const close = viewer.querySelector('[data-viewer-close]');
    const previous = viewer.querySelector('[data-viewer-prev]');
    const next = viewer.querySelector('[data-viewer-next]');
    const links = Array.from(story.querySelectorAll('a[data-viewer-image]'))
      .filter((link) => link.getAttribute('href') && link.querySelector('img'));
    if (!image || !caption || !links.length) return;

    let active = -1;
    let trigger;
    let scrollPosition;

    const preserveScroll = () => {
      if (scrollPosition) window.scrollTo({ ...scrollPosition, behavior: 'instant' });
    };

    function show(index) {
      if (index < 0 || index >= links.length) return;
      active = index;
      const link = links[index];
      const thumbnail = link.querySelector('img');
      const label = link.dataset.viewerCaption?.trim() || thumbnail.alt
        || `Image ${index + 1} of ${links.length}`;
      // Captions are plain text, even when the source includes escaped markup.
      caption.textContent = label;
      image.alt = thumbnail.alt || label;
      image.src = link.href;

      if (previous) previous.disabled = index === 0;
      if (next) next.disabled = index === links.length - 1;
      // A control that becomes disabled should not strand keyboard focus.
      const focused = document.activeElement;
      if ((previous && focused === previous && previous.disabled)
        || (next && focused === next && next.disabled)) {
        const available = [previous, next, close].find((button) => button && !button.disabled);
        available?.focus({ preventScroll: true });
      }
    }

    story.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey
        || event.metaKey || event.altKey || event.shiftKey || viewer.open) return;
      const link = event.target.closest?.('a[data-viewer-image]');
      const index = links.indexOf(link);
      if (index < 0 || link.hasAttribute('download')
        || (link.target && link.target.toLowerCase() !== '_self')) return;

      trigger = link;
      scrollPosition = { left: window.scrollX, top: window.scrollY };
      show(index);
      try {
        viewer.showModal();
      } catch {
        // If a browser cannot open the dialog, follow the original image link.
        trigger = undefined;
        scrollPosition = undefined;
        return;
      }
      event.preventDefault();
      close?.focus({ preventScroll: true });
      preserveScroll();
    });

    close?.addEventListener('click', () => viewer.close());
    previous?.addEventListener('click', () => show(active - 1));
    next?.addEventListener('click', () => show(active + 1));
    viewer.addEventListener('keydown', (event) => {
      if (!viewer.open || event.defaultPrevented || event.ctrlKey || event.metaKey
        || event.altKey || event.shiftKey || event.target.isContentEditable
        || event.target.closest?.('input, textarea, select')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        show(active + (event.key === 'ArrowLeft' ? -1 : 1));
      }
      // Escape, focus trapping, and cancel behavior belong to the native dialog.
    });
    viewer.addEventListener('close', () => {
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      preserveScroll();
      trigger = undefined;
      scrollPosition = undefined;
      active = -1;
      image.removeAttribute('src');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
