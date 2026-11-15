import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = join(root, 'docs');
const siteUrl = 'https://jiewenhu2026.github.io/';
const name = 'Jiewen Hu';

async function readContent(name) {
  const text = await readFile(join(root, 'content', name), 'utf8');
  return JSON.parse(text.replace(/^\uFEFF/, ''));
}

function readOptionalContent(name) {
  return readContent(name).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
}

const [projects, pressRecords, honors] = await Promise.all([
  readContent('projects.json'),
  readOptionalContent('press.json'),
  readOptionalContent('honors.json'),
]);

const entities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

function localPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\')) {
    throw new Error('Invalid media path: ' + value);
  }
  return value.split('/').map((segment) => {
    if (!segment || segment === '.' || segment === '..') {
      throw new Error('Invalid media path: ' + value);
    }
    return encodeURIComponent(segment);
  }).join('/');
}

function safeUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Unsupported link protocol: ' + url.protocol);
  }
  return escape(url.href);
}

function paragraphs(items = []) {
  return items.map((item) => '<p>' + escape(item) + '</p>').join('\n');
}

function metadata(project) {
  return [project.year, project.type, project.location].filter(Boolean).map(escape).join(' / ');
}

function siteHeader(prefix, home, route) {
  const workHref = home ? '#work' : prefix + '#work';
  const awardsCurrent = route === 'awards/' ? ' aria-current="page"' : '';
  const pressCurrent = route === 'press/' ? ' aria-current="page"' : '';
  return [
    '<header class="site-header">',
    '  <a class="wordmark" href="' + prefix + '">' + name + '</a>',
    '  <nav class="site-navigation" aria-label="Main navigation">',
    '    <a href="' + workHref + '">Work</a>',
    '    <a href="' + prefix + 'awards/"' + awardsCurrent + '>Awards</a>',
    press.length ? '    <a href="' + prefix + 'press/"' + pressCurrent + '>Press</a>' : '',
    '  </nav>',
    '</header>',
  ].filter(Boolean).join('\n');
}

function layout({ body, title, description, prefix, route, socialImage, home = false, gallery = false, notFound = false }) {
  const tags = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>' + escape(title) + '</title>',
    '  <meta name="description" content="' + escape(description) + '">',
    '  <meta name="theme-color" content="#080909">',
    '  <link rel="icon" type="image/svg+xml" href="' + prefix + 'assets/mark.svg">',
  ];
  if (notFound) {
    tags.push('  <meta name="robots" content="noindex">');
  } else {
    const canonical = new URL(route, siteUrl).href;
    tags.push(
      '  <link rel="canonical" href="' + escape(canonical) + '">',
      '  <meta property="og:title" content="' + escape(title) + '">',
      '  <meta property="og:description" content="' + escape(description) + '">',
      '  <meta property="og:type" content="website">',
      '  <meta property="og:url" content="' + escape(canonical) + '">',
    );
    if (socialImage) {
      tags.push('  <meta property="og:image" content="' + escape(socialImage.url) + '">');
      if (socialImage.alt) tags.push('  <meta property="og:image:alt" content="' + escape(socialImage.alt) + '">');
    }
  }
  tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/site.css">');
  if (gallery) tags.push('  <script defer src="' + prefix + 'assets/gallery.js"></script>');
  tags.push(
    '</head>',
    '<body' + (gallery ? ' class="project-body"' : '') + '>',
    '<a class="skip-link" href="#main-content">Skip to content</a>',
    siteHeader(prefix, home, route),
    body,
  );
  if (!gallery && !notFound) tags.push('<footer class="site-footer">' + name + '</footer>');
  tags.push('</body>', '</html>', '');
  return tags.join('\n');
}

function workCard(project, index) {
  const firstSlide = project.slides[0];
  const cover = project.cover || firstSlide.file;
  const coverAlt = project.coverAlt || firstSlide.alt;
  const coverUrl = './media/' + localPath(project.slug) + '/' + localPath(cover);
  const loading = index > 1 ? ' loading="lazy"' : '';
  const priority = index === 0 ? ' fetchpriority="high"' : '';
  return [
    '<li class="work-card">',
    '  <a class="work-card-link" href="./work/' + localPath(project.slug) + '/">',
    '    <span class="work-card-number" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span>',
    '    <span class="work-card-image"><img src="' + coverUrl + '" alt="' + escape(coverAlt) + '" decoding="async"' + loading + priority + '></span>',
    '    <span class="work-card-caption">',
    '      <span class="work-card-title">' + escape(project.title) + '</span>',
    project.year ? '      <span class="work-card-year">' + escape(project.year) + '</span>' : '',
    '    </span>',
    '  </a>',
    '</li>',
  ].filter(Boolean).join('\n');
}

function homePage() {
  const strapline = 'Landscape design, research, and the relationship between place and memory.';
  const body = [
    '<main id="main-content" class="portfolio-page">',
    '  <div class="portfolio-intro">',
    '    <p class="eyebrow">Landscape architecture</p>',
    '    <h1>' + name + '</h1>',
    '    <p class="portfolio-strapline">' + strapline + '</p>',
    '  </div>',
    '  <section class="work-index" id="work" aria-labelledby="work-title">',
    '    <div class="index-line">',
    '      <h2 id="work-title">Selected work</h2>',
    '      <span>' + projects.length + ' projects</span>',
    '    </div>',
    '    <ol class="work-grid">',
    projects.map(workCard).join('\n'),
    '    </ol>',
    '  </section>',
    '</main>',
  ].join('\n');
  return layout({
    title: name + ' | Landscape Architecture',
    description: strapline,
    prefix: './',
    route: '',
    home: true,
    body,
  });
}

function drawingSlide(project, slide, index) {
  const path = '../../media/' + localPath(project.slug) + '/' + localPath(slide.file);
  const loading = index === 0 ? ' fetchpriority="high"' : ' loading="lazy"';
  const caption = slide.caption || slide.label;
  return [
    '<figure class="drawing-slide" id="slide-' + (index + 1) + '" data-slide>',
    '  <a class="drawing-link" href="' + path + '">',
    '    <img src="' + path + '" alt="' + escape(slide.alt) + '" decoding="async"' + loading + '>',
    '  </a>',
    caption ? '  <figcaption class="image-caption">' + escape(caption) + '</figcaption>' : '',
    '</figure>',
  ].filter(Boolean).join('\n');
}

function storySlide(project) {
  const narrative = project.narrative;
  return [
    '<section class="story-slide" id="story" data-slide aria-labelledby="story-heading">',
    '  <div class="story-content">',
    '    <p class="eyebrow">Project story</p>',
    '    <h2 id="story-heading">' + escape(project.storyTitle || project.title) + '</h2>',
    paragraphs(project.story?.length ? project.story : [project.summary]),
    narrative?.paragraphs?.length ? [
      '    <details class="story-narrative">',
      '      <summary>' + escape(narrative.title || 'Read the full narrative') + '</summary>',
      paragraphs(narrative.paragraphs),
      '    </details>',
    ].join('\n') : '',
    '  </div>',
    '</section>',
  ].filter(Boolean).join('\n');
}

function projectInfo(project) {
  const credits = (project.credits ?? []).map(({ label, value }) => (
    '    <div><dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd></div>'
  )).join('\n');
  const awards = (project.awards ?? []).map(({ label, url }) => (
    '    <li>' + (url ? '<a href="' + safeUrl(url) + '">' + escape(label) + '</a>' : escape(label)) + '</li>'
  )).join('\n');
  const source = safeUrl(project.source);
  return [
    '  <p class="intro-meta">' + metadata(project) + '</p>',
    project.subtitle ? '  <p class="intro-subtitle">' + escape(project.subtitle) + '</p>' : '',
    '  <p class="intro-summary">' + escape(project.summary) + '</p>',
    credits ? '  <dl class="project-credits">\n' + credits + '\n  </dl>' : '',
    awards ? '  <div class="project-awards"><h3>Recognition</h3><ul>\n' + awards + '\n  </ul></div>' : '',
    source ? '  <p class="project-source"><a href="' + source + '">View the original project</a></p>' : '',
  ].filter(Boolean).join('\n');
}

function slideNav(id, label, index) {
  return '  <a class="slide-dot" href="#' + id + '" data-slide-link aria-label="Slide ' + (index + 1) + ': ' + escape(label) + '"><span aria-hidden="true"></span></a>';
}

function projectPage(project) {
  const [first, ...rest] = project.slides;
  const slides = [
    drawingSlide(project, first, 0),
    storySlide(project),
    ...rest.map((slide, index) => drawingSlide(project, slide, index + 2)),
  ];
  const nav = [
    ['slide-1', first.label || first.alt],
    ['story', 'Project story'],
    ...rest.map((slide, index) => ['slide-' + (index + 3), slide.label || slide.alt]),
  ].map(([id, label], index) => slideNav(id, label, index));
  const count = '01 / ' + String(slides.length).padStart(2, '0');
  const info = projectInfo(project);
  const body = [
    '<main id="main-content" class="project-page" data-gallery>',
    '  <div class="project-slides">',
    slides.join('\n'),
    '  </div>',
    '  <nav class="slide-navigation" aria-label="Project slides">',
    nav.join('\n'),
    '  </nav>',
    '  <footer class="project-footer">',
    '    <div class="project-caption">',
    '      <h1>' + escape(project.title) + '</h1>',
    '      <p>' + metadata(project) + '</p>',
    '    </div>',
    '    <div class="project-controls requires-js" data-gallery-controls>',
    '      <button type="button" data-prev aria-label="Previous slide"><span aria-hidden="true">←</span></button>',
    '      <output data-count aria-label="Slide number" aria-live="polite">' + count + '</output>',
    '      <button type="button" data-next aria-label="Next slide"><span aria-hidden="true">→</span></button>',
    '    </div>',
    '    <button class="project-info-button requires-js" type="button" data-info aria-haspopup="dialog" aria-controls="project-info">Project info</button>',
    '  </footer>',
    '  <dialog id="project-info" class="project-dialog" aria-labelledby="project-info-title">',
    '    <div class="intro-panel">',
    '      <div class="intro-heading">',
    '        <h2 id="project-info-title">' + escape(project.title) + '</h2>',
    '        <form method="dialog"><button class="dialog-close" type="submit" aria-label="Close project info"><span aria-hidden="true">×</span></button></form>',
    '      </div>',
    info,
    '    </div>',
    '  </dialog>',
    '  <noscript><section class="project-info-fallback"><h2>Project info</h2>',
    info,
    '  </section></noscript>',
    '</main>',
  ].join('\n');
  return layout({
    title: project.title + ' | ' + name,
    description: project.summary,
    prefix: '../../',
    route: 'work/' + project.slug + '/',
    socialImage: {
      url: new URL('media/' + localPath(project.slug) + '/' + localPath(project.cover || first.file), siteUrl).href,
      alt: project.coverAlt || first.alt,
    },
    body,
    gallery: true,
  });
}

function notFoundPage() {
  return layout({
    title: 'Page not found | ' + name,
    description: 'This page could not be found.',
    prefix: '/',
    notFound: true,
    body: [
      '<main id="main-content" class="press-page not-found">',
      '  <div class="press-intro">',
      '    <h1>Page not found</h1>',
      '    <p><a href="/#work">Return to work</a></p>',
      '  </div>',
      '</main>',
    ].join('\n'),
  });
}

function awardRow({ award, project }) {
  const url = safeUrl(award.url);
  const distinction = award.distinction && award.distinction !== '-' && award.distinction !== award.label
    ? '<p class="award-distinction">' + escape(award.distinction) + '</p>' : '';
  const official = url
    ? '<a class="award-organization" href="' + url + '">' +
      escape(award.organization || 'Official award page') + ' <span aria-hidden="true">↗</span></a>'
    : award.organization ? '<span class="award-organization">' + escape(award.organization) + '</span>' : '';
  const announcements = (award.announcements ?? []).map(({ label, url }) => (
    '<li><a href="' + safeUrl(url) + '">' + escape(label) + ' <span aria-hidden="true">↗</span></a></li>'
  ));
  return [
    '      <li class="press-entry award-row">',
    '        <div class="award-details">',
    '          <h3 class="press-title award-name">' + escape(award.label) + '</h3>',
    distinction,
    official,
    announcements.length ? '          <ul class="award-announcements">\n' + announcements.join('\n') + '\n          </ul>' : '',
    '        </div>',
    project
      ? '        <a class="project-link" href="../work/' + localPath(project.slug) + '/">' + escape(project.title) + ' <span aria-hidden="true">↗</span></a>'
      : '        <span class="project-link personal-recognition">Personal recognition</span>',
    '      </li>',
  ].filter(Boolean).join('\n');
}

function awardsPage() {
  const sections = [...awardsByYear.entries()].sort(([a], [b]) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return Number(b) - Number(a);
  }).map(([year, entries]) => [
    '  <section class="press-group award-year-group" aria-labelledby="awards-' + year + '">',
    '    <h2 class="eyebrow award-year" id="awards-' + year + '">' + year + '</h2>',
    '    <ul class="press-list award-entries">',
    entries.map(awardRow).join('\n'),
    '    </ul>',
    '  </section>',
  ].join('\n'));
  const body = [
    '<main id="main-content" class="press-page awards-page">',
    '  <header class="press-intro awards-heading"><h1>Awards</h1></header>',
    '  <div class="awards-list">',
    sections.length ? sections.join('\n') : '    <p class="awards-status">No project awards are listed.</p>',
    '  </div>',
    '</main>',
  ].join('\n');
  return layout({
    title: 'Awards | ' + name,
    description: 'Awards and recognition for landscape architecture projects by ' + name + '.',
    prefix: '../',
    route: 'awards/',
    body,
  });
}

function pressDate(entry) {
  const date = entry.date || entry.year;
  if (!date) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
    return '<time datetime="' + escape(date) + '">' + escape(formatted) + '</time>';
  }
  return escape(date);
}

function pressEntry(entry, heading) {
  const date = pressDate(entry);
  const url = safeUrl(entry.url);
  if (!url) throw new Error('Press entries require a source URL: ' + entry.title);
  return [
    '      <li class="press-entry">',
    '        <p class="press-meta">' + [escape(entry.publisher), date].filter(Boolean).join(' / ') + '</p>',
    '        <' + heading + ' class="press-title"><a href="' + url + '">' + escape(entry.title) + '</a></' + heading + '>',
    entry.description ? '        <p>' + escape(entry.description) + '</p>' : '',
    '      </li>',
  ].filter(Boolean).join('\n');
}

function pressGroup(title, entries) {
  if (!entries.length) return '';
  return [
    '  <section class="press-group">',
    title ? '    <h2 class="eyebrow">' + title + '</h2>' : '',
    '    <ul class="press-list">',
    entries.map((entry) => pressEntry(entry, title ? 'h3' : 'h2')).join('\n'),
    '    </ul>',
    '  </section>',
  ].filter(Boolean).join('\n');
}

function pressPage() {
  const reporting = press.filter((entry) => entry.kind !== 'Award / exhibition');
  const otherRecords = press.filter((entry) => entry.kind === 'Award / exhibition');
  const body = [
    '<main id="main-content" class="press-page">',
    '  <header class="press-intro"><h1>Press</h1></header>',
    pressGroup(otherRecords.length ? 'Coverage' : '', reporting),
    pressGroup('Other awards &amp; exhibitions', otherRecords),
    '</main>',
  ].filter(Boolean).join('\n');
  return layout({
    title: 'Press | ' + name,
    description: 'Publisher and institutional coverage featuring landscape work by ' + name + '.',
    prefix: '../',
    route: 'press/',
    body,
  });
}

function sitemap() {
  const paths = ['', 'awards/', ...(press.length ? ['press/'] : []), ...projects.map(({ slug }) => 'work/' + slug + '/')];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => '  <url><loc>' + escape(new URL(path, siteUrl).href) + '</loc></url>'),
    '</urlset>',
    '',
  ].join('\n');
}

const slugs = new Set();
const awardsByYear = new Map();
const awardUrls = new Set();

function addAward(award, project) {
  if (!award.label?.trim() || award.label.trim() === '-') return;
  const year = [award.year, project?.year].map((value) => String(value ?? '').trim())
    .find((value) => /^\d{4}$/.test(value)) || 'Undated';
  if (!awardsByYear.has(year)) awardsByYear.set(year, []);
  awardsByYear.get(year).push({ award, project });
  if (award.url) awardUrls.add(safeUrl(award.url));
  for (const announcement of award.announcements ?? []) {
    awardUrls.add(safeUrl(announcement.url));
  }
}

for (const project of projects) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug) || slugs.has(project.slug)) {
    throw new Error('Missing, invalid or duplicate project slug: ' + project.slug);
  }
  if (!project.title || !project.slides?.length) {
    throw new Error('Expected a title and at least one slide for ' + project.slug);
  }
  slugs.add(project.slug);
  for (const award of project.awards ?? []) addAward(award, project);
}
for (const honor of honors) addAward(honor);
const press = pressRecords.filter((entry) => (
  entry.kind !== 'Award / exhibition' || !awardUrls.has(safeUrl(entry.url))
));

async function writePage(path, html) {
  const destination = join(docs, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html, 'utf8');
}

await Promise.all([
  writePage('index.html', homePage()),
  writePage('awards/index.html', awardsPage()),
  ...(press.length ? [writePage('press/index.html', pressPage())] : []),
  ...projects.map((project) => writePage('work/' + project.slug + '/index.html', projectPage(project))),
  writePage('404.html', notFoundPage()),
  writePage('sitemap.xml', sitemap()),
]);

console.log('Built ' + (projects.length + 3 + Number(press.length > 0)) + ' HTML pages and sitemap.');
