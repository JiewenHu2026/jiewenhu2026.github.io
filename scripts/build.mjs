import { createHash } from 'node:crypto';
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

async function readVersionSource(path) {
  const text = await readFile(path, 'utf8');
  return text.replace(/\r\n/g, '\n');
}

function assetVersion(source) {
  return createHash('sha256').update(source).digest('hex').slice(0, 12);
}

const [daylightStyles, clockScript] = await Promise.all([
  readVersionSource(join(docs, 'assets', 'daylight.css')),
  readVersionSource(join(docs, 'assets', 'philadelphia-clock.js')),
]);
const daylightStylesVersion = assetVersion(daylightStyles);
const clockScriptVersion = assetVersion(clockScript);

const sharedArchiveSources = await Promise.all([
  readVersionSource(fileURLToPath(import.meta.url)),
  daylightStyles,
  clockScript,
  ...['site.css', 'portfolio.css', 'reference-type.css', 'archive-freshness.js', 'press.js']
    .map((file) => readVersionSource(join(docs, 'assets', file))),
]);

function archiveVersion(data) {
  const hash = createHash('sha256').update(JSON.stringify(data));
  for (const source of sharedArchiveSources) hash.update(source);
  return hash.digest('hex').slice(0, 16);
}

const archiveVersions = {
  press: archiveVersion(pressRecords),
  awards: archiveVersion([projects.map(({ slug, title, year, awards }) => ({ slug, title, year, awards })), honors]),
};

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
  const navigation = [
    [home ? '#work' : prefix + '#work', 'Projects', ''],
    [prefix + 'about/', 'About', 'about/'],
    [prefix + 'awards/', 'Awards', 'awards/'],
    ...(press.length ? [[prefix + 'press/', 'Press', 'press/']] : []),
  ];
  return [
    '<header class="site-header">',
    '  <a class="wordmark" href="' + prefix + '" aria-label="Jiewen Hu home">' + name + '</a>',
    '  <nav class="site-navigation" aria-label="Main navigation">',
    ...navigation.map(([href, label, path]) => {
      const current = path && route === path ? ' aria-current="page"' : '';
      return '    <a href="' + href + '"' + current + '>' + label + '</a>';
    }),
    '  </nav>',
    '</header>',
  ].join('\n');
}

function layout({ body, title, description, prefix, route, socialImage, home = false, gallery = false, notFound = false }) {
  const archive = route === 'press/' ? 'press' : route === 'awards/' ? 'awards' : '';
  const archiveAttributes = archive ? ' data-archive="' + archive + '" data-archive-version="' + archiveVersions[archive] + '"' : '';
  const tags = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>' + escape(title) + '</title>',
    '  <meta name="description" content="' + escape(description) + '">',
    '  <meta name="theme-color" content="#000000">',
    '  <script src="' + prefix + 'assets/philadelphia-clock.js?v=' + clockScriptVersion + '"></script>',
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
  tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/portfolio.css">');
  tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/reference-type.css">');
  tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/daylight.css?v=' + daylightStylesVersion + '">');
  tags.push('  <script defer src="' + prefix + 'assets/archive-freshness.js"></script>');
  if (route === 'press/') tags.push('  <script defer src="' + prefix + 'assets/press.js"></script>');
  if (gallery) tags.push('  <script defer src="' + prefix + 'assets/gallery.js"></script>');
  tags.push(
    '</head>',
    '<body' + (gallery ? ' class="project-body"' : '') + archiveAttributes + '>',
    '<a class="skip-link" href="#main-content">Skip to content</a>',
    siteHeader(prefix, home, route),
    body,
  );
  if (!gallery && !notFound) tags.push('<footer class="site-footer">' + name + '</footer>');
  tags.push(
    '<aside class="philadelphia-clock" id="philadelphia-clock" aria-label="Local time in Philadelphia" hidden>',
    '  <p>The time in Philadelphia is <time id="philadelphia-clock-time"></time>. <span id="philadelphia-clock-period"></span></p>',
    '  <p>The website theme is adjusted accordingly.</p>',
    '</aside>',
    '</body>', '</html>', ''
  );
  return tags.join('\n');
}

const introduction = 'Landscape design and research on how places hold memory and change over time.';

function projectCover(project) {
  const slide = project.slides[0];
  return {
    src: 'media/' + localPath(project.slug) + '/' + localPath(project.cover || slide.file),
    alt: project.coverAlt || slide.alt,
  };
}

function workCard(project, featured = false) {
  const cover = projectCover(project);
  const load = featured ? ' fetchpriority="high"' : ' loading="lazy"';
  return [
    '<li class="work-card' + (featured ? ' work-card-featured' : '') + '">',
    '  <a class="work-card-link" href="./work/' + localPath(project.slug) + '/">',
    '    <span class="work-card-image"><img src="./' + cover.src + '" alt="' + escape(cover.alt) + '" decoding="async"' + load + '></span>',
    '    <span class="work-card-caption">',
    '      <span class="work-card-title">' + escape(project.title) + '</span>',
    '      <span class="work-card-year">' + [featured ? project.type : '', project.year].filter(Boolean).map(escape).join(' / ') + '</span>',
    '    </span>',
    '  </a>',
    '</li>',
  ].join('\n');
}

function homePage() {
  const [featured, ...otherProjects] = projects;
  const cover = projectCover(featured);
  const body = [
    '<main id="main-content" class="portfolio-page">',
    '  <div class="portfolio-masthead portfolio-shell">',
    '    <h1>' + name + '</h1>',
    '    <p>' + introduction + '</p>',
    '  </div>',
    '  <section class="portfolio-shell portfolio-projects" id="work" aria-labelledby="work-title">',
    '    <h2 class="section-label" id="work-title">Selected projects</h2>',
    '    <ul class="work-grid portfolio-grid">',
    workCard(featured, true),
    ...otherProjects.map((project) => workCard(project)),
    '    </ul>',
    '  </section>',
    ...(press.length ? [
      '  <section class="portfolio-shell home-press" aria-labelledby="latest-press">',
      '    <div class="section-header"><h2 class="section-label" id="latest-press">Latest press</h2><a href="./press/">Press archive</a></div>',
      '    <ul class="press-list">',
      ...press.slice(0, 4).map((entry) => pressEntry(entry, 'h3', false)),
      '    </ul>',
      '  </section>',
    ] : []),
    '</main>',
  ].join('\n');
  return layout({
    title: name + ' | Landscape Architecture',
    description: introduction,
    prefix: './',
    route: '',
    home: true,
    socialImage: { url: new URL(cover.src, siteUrl).href, alt: cover.alt },
    body,
  });
}

function aboutPage() {
  const body = [
    '<main id="main-content" class="portfolio-shell archive-page about-page">',
    '  <header class="archive-heading about-heading">',
    '    <h1>About</h1>',
    '    <div class="about-bio">',
    '      <p class="about-lead">Jiewen Hu is a landscape designer based in Philadelphia. Her work explores how landscapes hold memory and how ecological repair can support communities.</p>',
    '      <p>Across landscape design, drawing, and research, her projects examine the relationships between material change, histories of place, and collective stewardship.</p>',
    '    </div>',
    '  </header>',
    '  <section class="about-section" aria-labelledby="practice">',
    '    <h2 class="section-label" id="practice">Practice</h2>',
    '    <div class="about-row">',
    '      <p class="about-meta">Philadelphia, PA</p>',
    '      <div><h3><a href="https://theolinstudio.com/jiewen-hu/">OLIN</a></h3><p>Landscape Designer</p><p>Project team member on the <a href="https://theolinstudio.com/projects/la-park-needs-assessment/">Los Angeles Park Needs Assessment</a>.</p></div>',
    '    </div>',
    "    <div class=\"about-row additional-profile-row\"><p class=\"about-meta\">Previous experience</p><div><h3>Studio Outside, Jonathan Alderson Landscape Architects, and SWA Group</h3><p>Design practice and an internship at SWA Group.</p></div></div>",
    '  </section>',
    '  <section class="about-section" aria-labelledby="education">',
    '    <h2 class="section-label" id="education">Education</h2>',
    '    <div class="about-row">',
    '      <p class="about-meta"><time datetime="2024">2024</time><br>Philadelphia, PA</p>',
    '      <div><h3><a href="https://www.design.upenn.edu/yes2024/jiewen-hu">University of Pennsylvania</a></h3><p>Master of Landscape Architecture</p><p>Certificate in GIS and Spatial Analysis</p></div>',
    '    </div>',
    "    <div class=\"about-row additional-profile-row\"><p class=\"about-meta\">Hangzhou, China</p><div><h3>Zhejiang University</h3><p>Bachelor’s degree in Landscape Gardening</p></div></div>",
    '  </section>',
    '  <section class="about-section" aria-labelledby="recognition">',
    '    <h2 class="section-label" id="recognition">Recognition</h2>',
    '    <div class="about-row">',
    '      <div class="about-actions"><a href="../awards/">Awards and official announcements</a><a href="../press/">Press and publications</a></div>',
    '    </div>',
    '  </section>',
    '</main>',
  ].join('\n');
  return layout({
    title: 'About | ' + name,
    description: 'Practice and education of Jiewen Hu, a landscape designer based in Philadelphia.',
    prefix: '../',
    route: 'about/',
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
    '<main id="main-content" class="press-page archive-page awards-page">',
    '  <header class="archive-heading"><h1>Awards</h1></header>',
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
  if (/^\d{4}-\d{2}$/.test(date)) {
    const formatted = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' }).format(new Date(date + '-01'));
    return '<time datetime="' + escape(date) + '">' + escape(formatted) + '</time>';
  }
  return escape(date);
}

function pressEntry(entry, heading, includeDescription = true) {
  const date = pressDate(entry);
  const url = safeUrl(entry.url);
  if (!url) throw new Error('Press entries require a source URL: ' + entry.title);
  return [
    '      <li class="press-entry coverage-row">',
    '        <p class="coverage-date">' + date + '</p>',
    '        <div class="coverage-story">',
    '          <' + heading + ' class="press-title"><a href="' + url + '">' + escape(entry.title) + '</a></' + heading + '>',
    includeDescription && entry.description ? '          <p>' + escape(entry.description) + '</p>' : '',
    '        </div>',
    '        <p class="coverage-publisher">' + escape(entry.publisher) + '</p>',
    '      </li>',
  ].filter(Boolean).join('\n');
}

function pressPage() {
  const years = new Map();
  for (const entry of press) {
    const year = String(entry.date ?? entry.year ?? 'Undated').slice(0, 4);
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(entry);
  }
  const body = [
    '<main id="main-content" class="press-page archive-page" data-press-index>',
    '  <header class="archive-heading press-heading">',
    '    <h1>Press</h1>',
    '    <div class="press-search" data-press-search hidden>',
    '      <label for="press-query">Search the archive</label>',
    '      <input id="press-query" type="search" autocomplete="off" placeholder="Title, publisher, or year">',
    '    </div>',
    '  </header>',
    '  <p class="press-empty" data-press-empty role="status" hidden>No entries match your search.</p>',
    ...Array.from(years, ([year, entries]) => [
      '  <section class="press-group" data-press-year aria-labelledby="press-' + escape(year) + '">',
      '    <h2 class="section-label" id="press-' + escape(year) + '">' + escape(year) + '</h2>',
      '    <ul class="press-list">',
      ...entries.map((entry) => pressEntry(entry, 'h3')),
      '    </ul>',
      '  </section>',
    ].join('\n')),
    '</main>',
  ].join('\n');
  return layout({
    title: 'Press | ' + name,
    description: 'Press, publications, and official coverage featuring landscape work by ' + name + '.',
    prefix: '../',
    route: 'press/',
    body,
  });
}

function sitemap() {
  const paths = ['', 'about/', 'awards/', ...(press.length ? ['press/'] : []), ...projects.map(({ slug }) => 'work/' + slug + '/')];
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

function addAward(award, project) {
  if (!award.label?.trim() || award.label.trim() === '-') return;
  const year = [award.year, project?.year].map((value) => String(value ?? '').trim())
    .find((value) => /^\d{4}$/.test(value)) || 'Undated';
  if (!awardsByYear.has(year)) awardsByYear.set(year, []);
  awardsByYear.get(year).push({ award, project });
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
const press = [...pressRecords].sort((a, b) => (
  String(b.date ?? b.year ?? '').localeCompare(String(a.date ?? a.year ?? ''))
));

async function writePage(path, html) {
  const destination = join(docs, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html, 'utf8');
}

await Promise.all([
  writePage('index.html', homePage()),
  writePage('about/index.html', aboutPage()),
  writePage('awards/index.html', awardsPage()),
  ...(press.length ? [writePage('press/index.html', pressPage())] : []),
  ...projects.map((project) => writePage('work/' + project.slug + '/index.html', projectPage(project))),
  writePage('404.html', notFoundPage()),
  writePage('sitemap.xml', sitemap()),
  writePage('archive-version.json', JSON.stringify(archiveVersions, null, 2) + '\n'),
]);

console.log('Built ' + (projects.length + 4 + Number(press.length > 0)) + ' HTML pages and sitemap.');
