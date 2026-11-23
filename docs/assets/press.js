const index = document.querySelector('[data-press-index]');

if (index) {
  const search = index.querySelector('[data-press-search]');
  const input = search.querySelector('input');
  const empty = index.querySelector('[data-press-empty]');
  const normalize = (value) => value.normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US');
  const years = Array.from(index.querySelectorAll('[data-press-year]'), (section) => ({
    section,
    entries: Array.from(section.querySelectorAll('.coverage-row'), (entry) => ({
      entry,
      text: normalize(entry.textContent)
    }))
  }));

  function filterPress() {
    const words = normalize(input.value).trim().split(/\s+/).filter(Boolean);
    let found = false;
    for (const { section, entries } of years) {
      let visible = false;
      for (const { entry, text } of entries) {
        const match = words.every((word) => text.includes(word));
        entry.hidden = !match;
        visible ||= match;
      }
      section.hidden = !visible;
      found ||= visible;
    }
    empty.hidden = found;
  }

  search.hidden = false;
  input.addEventListener('input', filterPress);
  filterPress();
}
