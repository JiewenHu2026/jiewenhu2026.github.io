const index = document.querySelector('[data-press-index]');
const filters = index?.querySelector('[data-press-filters]');

if (filters) {
  const year = filters.querySelector('#press-year');
  const publisher = filters.querySelector('#press-publisher');
  const empty = index.querySelector('[data-press-empty]');
  const status = index.querySelector('[data-press-status]');
  const groups = Array.from(index.querySelectorAll('[data-press-year]'), (section) => ({
    section,
    entries: section.querySelectorAll('[data-press-publisher]')
  }));

  function filterPress() {
    let count = 0;
    for (const { section, entries } of groups) {
      const matchesYear = !year.value || section.dataset.pressYear === year.value;
      let visible = false;
      for (const entry of entries) {
        const matchesPublisher = !publisher.value || entry.dataset.pressPublisher === publisher.value;
        entry.hidden = !(matchesYear && matchesPublisher);
        if (!entry.hidden) {
          visible = true;
          count += 1;
        }
      }
      section.hidden = !visible;
    }
    empty.hidden = count > 0;
    const message = count ? count + (count === 1 ? ' press entry' : ' press entries') : empty.textContent;
    if (status.textContent !== message) status.textContent = message;
  }

  filters.hidden = false;
  filters.addEventListener('change', filterPress);
  window.addEventListener('pageshow', filterPress);
  filterPress();
}
