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

const [siteStyles, portfolioStyles, daylightStyles, clockScript, archiveFreshnessScript, aboutStyles, aboutRevealScript, pressScript] = await Promise.all([
  readVersionSource(join(docs, 'assets', 'site.css')),
  readVersionSource(join(docs, 'assets', 'portfolio.css')),
  readVersionSource(join(docs, 'assets', 'daylight.css')),
  readVersionSource(join(docs, 'assets', 'philadelphia-clock.js')),
  readVersionSource(join(docs, 'assets', 'archive-freshness.js')),
  readVersionSource(join(docs, 'assets', 'about.css')),
  readVersionSource(join(docs, 'assets', 'about-reveal.js')),
  readVersionSource(join(docs, 'assets', 'press.js')),
]);
const siteStylesVersion = assetVersion(siteStyles);
const portfolioStylesVersion = assetVersion(portfolioStyles);
const daylightStylesVersion = assetVersion(daylightStyles);
const clockScriptVersion = assetVersion(clockScript);
const archiveFreshnessVersion = assetVersion(archiveFreshnessScript);
const aboutStylesVersion = assetVersion(aboutStyles);
const aboutRevealVersion = assetVersion(aboutRevealScript);
const pressScriptVersion = assetVersion(pressScript);
const editorialStylesVersion = assetVersion(await readVersionSource(join(docs, 'assets', 'editorial.css')));
const projectGalleryStylesVersion = assetVersion(await readVersionSource(join(docs, 'assets', 'project-gallery.css')));
const galleryScriptVersion = assetVersion(await readVersionSource(join(docs, 'assets', 'gallery.js')));
const comicStylesVersion = assetVersion(await readVersionSource(join(docs, 'assets', 'comic-reader.css')));
const comicScriptVersion = assetVersion(await readVersionSource(join(docs, 'assets', 'comic-reader.js')));
const imageCursorScriptVersion = assetVersion(await readVersionSource(join(docs, 'assets', 'image-cursor.js')));
const homeIndexScriptVersion = assetVersion(await readVersionSource(join(docs, 'assets', 'home-index.js')));
const projectsPreviewScriptVersion = assetVersion(await readVersionSource(join(docs, 'assets', 'projects-preview.js')));
const cvPath = 'files/jiewen-hu-cv.pdf';
const cvVersion = assetVersion(await readFile(join(docs, cvPath)));

const sharedArchiveSources = await Promise.all([
  readVersionSource(fileURLToPath(import.meta.url)),
  siteStyles,
  portfolioStyles,
  daylightStyles,
  clockScript,
  archiveFreshnessScript,
  readVersionSource(join(docs, 'assets', 'reference-type.css')),
  pressScript,
]);

function archiveVersion(data) {
  const hash = createHash('sha256').update(JSON.stringify(data));
  for (const source of sharedArchiveSources) hash.update(source);
  return hash.digest('hex').slice(0, 16);
}

const archiveVersions = {
  press: archiveVersion(pressRecords),
  awards: archiveVersion([
    projects.map(({ slug, title, year, awards }) => ({ slug, title, year, awards })),
    honors,
    aboutStylesVersion,
    aboutRevealVersion,
  ]),
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

function cvLink(prefix) {
  return '<a href="' + prefix + cvPath + '?v=' + cvVersion + '" target="_blank" rel="noopener">View CV <span aria-hidden="true">↗</span></a>';
}

function siteHeader(prefix, route) {
  const navigation = [
    [prefix, 'Home', ''],
    [prefix + 'projects/', 'Projects', 'projects/'],
    ...(press.length ? [[prefix + 'press/', 'Press', 'press/']] : []),
    [prefix + 'about/', 'About', 'about/'],
    [prefix + 'contact/', 'Contact', 'contact/'],
  ];
  return [
    '<header class="site-header">',
    '  <a class="wordmark" href="' + prefix + '" aria-label="Jiewen Hu home">' + name + '</a>',
    '  <nav class="site-navigation" aria-label="Main navigation">',
    ...navigation.map(([href, label, path]) => {
      let current = route === path ? ' aria-current="page"' : '';
      if (path === 'projects/' && route?.startsWith('work/')) current = ' aria-current="location"';
      return '    <a href="' + href + '"' + current + '>' + label + '</a>';
    }),
    '  </nav>',
    '</header>',
  ].join('\n');
}

function philadelphiaClock(indent = '') {
  return [
    '<aside class="philadelphia-clock" id="philadelphia-clock" aria-label="Local time in Philadelphia" hidden>',
    '  <p>Philadelphia · <time id="philadelphia-clock-time"></time></p>',
    '  <p>The site follows the city’s daylight.</p>',
    '</aside>',
  ].map((line) => indent + line).join('\n');
}

function layout({ body, title, description, prefix, route, socialImage, hasBook = false, notFound = false }) {
  const home = route === '';
  const about = route === 'about/';
  const project = route?.startsWith('work/');
  const projectIndex = route === 'projects/';
  const editorial = home || project || projectIndex || route === 'contact/';
  const archive = route === 'press/' ? 'press' : about ? 'awards' : '';
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
  tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/site.css?v=' + siteStylesVersion + '">');
  tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/portfolio.css?v=' + portfolioStylesVersion + '">');
  tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/reference-type.css">');
  tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/daylight.css?v=' + daylightStylesVersion + '">');
  tags.push('  <script defer src="' + prefix + 'assets/archive-freshness.js?v=' + archiveFreshnessVersion + '"></script>');
  tags.push('  <script defer src="' + prefix + 'assets/image-cursor.js?v=' + imageCursorScriptVersion + '"></script>');
  if (home) tags.push('  <script defer src="' + prefix + 'assets/home-index.js?v=' + homeIndexScriptVersion + '"></script>');
  if (projectIndex) tags.push('  <script defer src="' + prefix + 'assets/projects-preview.js?v=' + projectsPreviewScriptVersion + '"></script>');
  if (about) tags.push(
    '  <link rel="stylesheet" href="' + prefix + 'assets/about.css?v=' + aboutStylesVersion + '">',
    '  <script defer src="' + prefix + 'assets/about-reveal.js?v=' + aboutRevealVersion + '"></script>',
  );
  if (route === 'press/') tags.push('  <script defer src="' + prefix + 'assets/press.js?v=' + pressScriptVersion + '"></script>');
  if (editorial) tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/editorial.css?v=' + editorialStylesVersion + '">');
  if (project) tags.push(
    '  <link rel="stylesheet" href="' + prefix + 'assets/project-gallery.css?v=' + projectGalleryStylesVersion + '">',
    '  <script defer src="' + prefix + 'assets/gallery.js?v=' + galleryScriptVersion + '"></script>',
  );
  if (hasBook) tags.push(
    '  <link rel="stylesheet" href="' + prefix + 'assets/comic-reader.css?v=' + comicStylesVersion + '">',
    '  <script defer src="' + prefix + 'assets/vendor/page-flip-2.0.7.browser.js"></script>',
    '  <script defer src="' + prefix + 'assets/comic-reader.js?v=' + comicScriptVersion + '"></script>',
  );
  tags.push(
    '</head>',
    '<body' + (project ? ' class="project-body"' : '') + archiveAttributes + '>',
    '<a class="skip-link" href="#main-content">Skip to content</a>',
    siteHeader(prefix, route),
    body,
  );
  if (home || projectIndex) tags.push(philadelphiaClock());
  tags.push('</body>', '</html>', '');
  return tags.join('\n');
}

const introduction = 'Landscape design and research on how places hold memory and change over time.';
const biography = 'Jiewen Hu is a landscape designer based in Philadelphia. Her work explores how landscapes hold memory and how ecological repair can support communities.';
const featuredSlugs = ['leaving-traces', 'back-to-roots', 'from-ruins-to-roots', 'ground-in-friction'];
const lastProjectSlugs = ['the-latent-ground', 'not-quite-order', 'whispers-beyond-the-looking-glass'];

function projectMedia(project, file) {
  return 'media/' + localPath(project.slug) + '/' + localPath(file);
}

function projectCover(project) {
  const slide = project.slides[0];
  return { src: projectMedia(project, project.cover || slide.file), alt: project.coverAlt || slide.alt };
}

function orderedProjects() {
  const featured = featuredSlugs.map((slug) => projects.find((project) => project.slug === slug)).filter(Boolean);
  const last = lastProjectSlugs.map((slug) => projects.find((project) => project.slug === slug)).filter(Boolean);
  const entries = [...projects].sort((a, b) => Number(b.year) - Number(a.year));
  return [
    ...featured,
    ...entries.filter(({ slug }) => !featuredSlugs.includes(slug) && !lastProjectSlugs.includes(slug)),
    ...last,
  ];
}

function homePage() {
  const index = orderedProjects().map((project) =>
    '      <a href="./work/' + localPath(project.slug) + '/" data-project="' + project.slug + '" data-preview="./' + projectCover(project).src + '">' + escape(project.title) + '</a>'
  ).join('\n      <span aria-hidden="true">·</span>\n');
  const body = [
    '<main id="main-content" class="portfolio-home">',
    '  <h1 class="sr-only">' + name + ' | Landscape Architecture</h1>',
    ...(index ? [
      '  <section class="home-reel" id="work" aria-label="Selected projects">',
      '    <nav class="home-work-index" aria-label="Projects by title">',
      index,
      '    </nav>',
      '  </section>',
    ] : []),
    '  <section class="portfolio-shell home-bio" id="about" aria-labelledby="home-about-title">',
    '    <div class="home-bio-inner">',
    '      <h2 id="home-about-title" class="section-label">About</h2>',
    '      <p>' + biography + '</p>',
    '      <p>She practices at OLIN and holds a Master of Landscape Architecture from the University of Pennsylvania.</p>',
    '      <p class="home-bio-links">',
    '        ' + cvLink('./'),
    '        <a href="./about/">About Jiewen <span aria-hidden="true">↗</span></a>',
    '        <a href="./projects/">View projects <span aria-hidden="true">↗</span></a>',
    '      </p>',
    '    </div>',
    '  </section>',
    '  <dialog class="home-status" aria-labelledby="home-status-message">',
    '    <p id="home-status-message">This website is a work in progress.</p>',
    '    <form method="dialog"><button type="submit" autofocus>Close</button></form>',
    '  </dialog>',
    '</main>',
  ].filter(Boolean).join('\n');
  return layout({
    title: name + ' | Landscape Architecture',
    description: introduction,
    prefix: './',
    route: '',
    socialImage: {
      url: new URL('media/home/wax-heat-and-light.jpg', siteUrl).href,
      alt: 'Four backlit wax samples from Leaving Traces, held by hand to show their textures and translucency.',
    },
    body,
  });
}

function projectIndexCard(project, index) {
  const cover = projectCover(project);
  const { width, height } = project.coverSize ?? {};
  const dimensions = width && height ? ' width="' + escape(width) + '" height="' + escape(height) + '"' : '';
  const loading = index >= 4 ? ' loading="lazy"' : '';
  return [
    '      <li>',
    '        <a class="selected-project-card" href="../work/' + localPath(project.slug) + '/">',
    '          <span class="selected-project-image"><img src="../' + cover.src + '" alt=""' + dimensions + loading + ' decoding="async"></span>',
    '          <span class="selected-project-caption">',
    '            <span class="selected-project-title" data-project="' + project.slug + '">' + escape(project.title) + '</span>',
    '            <span class="selected-project-location">' + escape(project.location) + '</span>',
    '          </span>',
    '        </a>',
    '      </li>',
  ].join('\n');
}

function projectsPage() {
  const body = [
    '<main id="main-content" class="project-index">',
    '  <section class="editorial-shell project-index-selected" id="project-archive" aria-labelledby="selected-projects">',
    '    <h1 class="sr-only" id="selected-projects">Projects</h1>',
    '    <ul class="selected-projects">',
    ...orderedProjects().map(projectIndexCard),
    '    </ul>',
    '  </section>',
    '</main>',
  ].join('\n');
  return layout({
    title: 'Projects | ' + name,
    description: 'An index of landscape design and research projects by ' + name + '.',
    prefix: '../',
    route: 'projects/',
    body,
  });
}

function aboutPage() {
  const body = [
    '<main id="main-content" class="portfolio-shell archive-page about-page">',
    '  <header class="archive-heading about-heading">',
    '    <h1 data-about-reveal>About</h1>',
    '    <div class="about-bio" data-about-reveal data-about-reveal-delay="intro">',
    '      <p class="about-lead">Jiewen Hu is an internationally recognized landscape designer and researcher working across cultural landscapes, collective memory, and material expression. She explores how public spaces can give form to complex histories and foster healing, belonging, and shared experience.</p>',
    '      <p>Based in Philadelphia, Jiewen is a Landscape Designer II at OLIN. She holds a Master of Landscape Architecture from the University of Pennsylvania.</p>',
    '      <p>Her honors include two ASLA National Student Honor Awards, first place in the ASLA Emerging Professionals Design Competition, and a category win in the professional division of the IFLA Global Landscape Architecture Awards. Her projects have also earned first place in World Landscape Architecture’s Design the World You Want competition, the Karl Foerster Commendation at the Peter Joseph Lenné Prize, and a win in the professional Conceptual Landscape category at the BLT Built Design Awards.</p>',
    '      <p>Her work has been <a href="../press/" aria-label="Press and publications">featured by</a> <em>Landscape Architecture Magazine</em>, ASLA LAND, World Landscape Architecture, Landezine, Penn Weitzman, Archinect, Urbanize LA, and Secret Los Angeles. Her projects have been exhibited in Berlin and Hong Kong, and as part of Melbourne Design Week.</p>',
    '      <div class="about-actions">',
    '        <a href="#awards">Recognition <span aria-hidden="true">↓</span></a>',
    '        ' + cvLink('../'),
    '      </div>',
    '    </div>',
    '  </header>',
    '  <section class="about-section" aria-labelledby="education">',
    '    <h2 class="section-label" id="education" data-about-reveal data-about-reveal-delay="section">Education</h2>',
    '    <div class="about-row" data-about-reveal data-about-reveal-delay="section">',
    '      <p class="about-meta"><time datetime="2024">2024</time><br>Philadelphia, PA</p>',
    '      <div><h3><a href="https://www.design.upenn.edu/yes2024/jiewen-hu">University of Pennsylvania</a></h3><p>Master of Landscape Architecture</p><p>Certificate in GIS and Spatial Analysis</p></div>',
    '    </div>',
    "    <div class=\"about-row additional-profile-row\" data-about-reveal><p class=\"about-meta\"><time datetime=\"2021\">2021</time><br>Hangzhou, China</p><div><h3>Zhejiang University</h3><p>Bachelor’s degree in Landscape Gardening</p></div></div>",
    '  </section>',
    '  <section class="about-section" aria-labelledby="practice">',
    '    <h2 class="section-label" id="practice" data-about-reveal>Practice</h2>',
    '    <div class="about-row" data-about-reveal>',
    '      <p class="about-meta">Philadelphia, PA</p>',
    '      <div><h3><a href="https://theolinstudio.com/jiewen-hu/">OLIN</a></h3><p>Landscape Designer II</p></div>',
    '    </div>',
    '    <div class="about-row additional-profile-row" data-about-reveal><p class="about-meta">Previous experience</p><div><h3>SWA Group, Studio Outside, and Jonathan Alderson Landscape Architects</h3></div></div>',
    '  </section>',
    aboutAwards(),
    '</main>',
  ].join('\n');
  return layout({
    title: 'About | ' + name,
    description: 'Biography, practice, education, awards, and official announcements for Jiewen Hu, a landscape designer based in Philadelphia.',
    prefix: '../',
    route: 'about/',
    body,
  });
}

const leavingTracesImageAnchors = {
  'signal-valley.webp': 'image-1',
  'cheslen-preserve.webp': 'image-2',
  'choreography-study.webp': 'image-3',
  'sheltering-woodland.webp': 'image-4',
  'sheltering-woodland-section.webp': 'section-2',
  'shadowed-ditch.webp': 'image-5',
  'shadowed-ditch-section.webp': 'section-3',
  'wax-heat-and-light.webp': 'material-study',
  'storytelling-center.webp': 'storytelling-center',
};

function projectDrawing(project, slide, index) {
  const id = 'slide-' + (index === 0 ? 1 : index + 2);
  const path = '../../' + projectMedia(project, slide.file);
  const label = slide.label && slide.label !== 'Project overview' ? slide.label : slide.alt;
  const caption = slide.caption === 'Project overview' ? '' : slide.caption ?? label;
  const imageLoading = index === 0 ? ' fetchpriority="high"' : ' loading="lazy"';
  const aliases = [
    index === 1 ? 'drawings-title' : '',
    project.slug === 'leaving-traces' ? leavingTracesImageAnchors[slide.file] : '',
  ].filter(Boolean).join(' ');
  const narrative = index === project.slides.length - 1 && project.narrative?.paragraphs?.length
    ? ' <button type="button" class="narrative-trigger requires-js" data-narrative aria-haspopup="dialog" aria-controls="project-narrative">Read narrative</button>'
    : '';
  return {
    id,
    label,
    html: [
      '    <figure class="drawing-slide" id="' + id + '" data-slide' + (aliases ? ' data-slide-aliases="' + aliases + '"' : '') + '>',
      '      <a class="drawing-link" href="' + path + '">',
      '        <img src="' + path + '" alt="' + escape(slide.alt) + '" decoding="async"' + imageLoading + '>',
      '      </a>',
      caption || narrative ? '      <figcaption class="image-caption">' + escape(caption) + narrative + '</figcaption>' : '',
      '    </figure>',
    ].filter(Boolean).join('\n'),
  };
}

function detailRow(label, value) {
  return '        <div><dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd></div>';
}

function projectInformation(project) {
  const basicDetails = [
    { label: 'Location', value: project.location },
    { label: 'Year', value: project.year },
  ].filter(({ value }) => value);
  const credits = (project.credits ?? []).filter(({ label }) => (
    !basicDetails.some((detail) => detail.label.toLowerCase() === label.toLowerCase())
  ));
  const awards = (project.awards ?? []).map(({ label, distinction, url }) => {
    const display = escape(distinction ? label + ' — ' + distinction : label);
    return '        <li>' + (url ? '<a href="' + safeUrl(url) + '">' + display + '</a>' : display) + '</li>';
  });
  return [
    '      <p class="project-description">' + escape(project.summary) + '</p>',
    '      <dl class="project-credits">',
    ...[...basicDetails, ...credits].map(({ label, value }) => detailRow(label, value)),
    '      </dl>',
    awards.length ? '      <div class="project-awards"><h3>Recognition</h3><ul>\n' + awards.join('\n') + '\n      </ul></div>' : '',
  ].filter(Boolean).join('\n');
}

function projectStorySlide(project) {
  const narrative = project.narrative;
  const aliases = 'slide-2 statement-title' + (project.slug === 'leaving-traces' ? ' project-introduction' : '');
  return {
    id: 'story',
    label: 'Project statement',
    html: [
      '    <section class="story-slide" id="story" data-slide data-slide-aliases="' + aliases + '" aria-labelledby="statement-title">',
      '      <div class="story-content">',
      '        <h2 id="statement-title">' + escape(project.storyTitle || project.title) + '</h2>',
      paragraphs(project.story?.length ? project.story : [project.summary]),
      narrative?.paragraphs?.length ? [
        '        <details class="story-narrative">',
        '          <summary>' + escape(narrative.title || 'Read the full narrative') + '</summary>',
        paragraphs(narrative.paragraphs),
        '        </details>',
      ].join('\n') : '',
      '      </div>',
      '    </section>',
    ].filter(Boolean).join('\n'),
  };
}

function projectNarrativeDialog(narrative) {
  if (!narrative?.paragraphs?.length) return '';
  return [
    '  <dialog class="narrative-dialog" id="project-narrative" aria-labelledby="narrative-title">',
    '    <div class="narrative-panel">',
    '      <form method="dialog" class="info-close"><button type="submit" aria-label="Close narrative">×</button></form>',
    '      <article class="story-content">',
    '        <h2 id="narrative-title">' + escape(narrative.title || 'Project narrative') + '</h2>',
    paragraphs(narrative.paragraphs),
    '      </article>',
    '    </div>',
    '  </dialog>',
  ].join('\n');
}

function projectBookSlide(project, drawings) {
  const { book } = project;
  const start = project.slides.findIndex(({ file }) => file === book.front);
  const end = project.slides.findIndex(({ file }) => file === book.back);
  if (start < 0 || end <= start) throw new Error('Invalid book page order for ' + project.slug);
  const pages = project.slides.slice(start, end + 1);
  const aliases = drawings.slice(start, end + 1).map(({ id }) => id);
  if (start <= 1 && end >= 1) aliases.push('drawings-title');
  const slide = {
    id: 'project-book',
    label: book.label,
    html: [
      '    <section class="project-book-slide" id="project-book" data-slide data-project-book data-book-title="' + escape(project.title) + '" data-slide-aliases="' + aliases.join(' ') + '" aria-labelledby="project-book-title">',
      '      <h2 class="sr-only" id="project-book-title">' + escape(book.label) + '</h2>',
      '      <div data-book-reader></div>',
      '      <ol class="project-book-pages" data-book-pages>',
      ...pages.map(({ file, label, alt }, index) => {
        const kind = index === 0 ? 'cover' : index === pages.length - 1 ? 'backcover' : 'spread';
        const width = kind === 'spread' ? book.spreadWidth : book.pageWidth;
        return '        <li><a href="../../' + projectMedia(project, file) + '" data-book-kind="' + kind +
          '" data-book-width="' + width + '" data-book-height="' + book.height + '" data-book-alt="' + escape(alt) + '">' + escape(label || alt) + '</a></li>';
      }),
      '      </ol>',
      '    </section>',
    ].join('\n'),
  };
  return [slide, ...drawings.slice(0, start), ...drawings.slice(end + 1)];
}

function projectPage(project) {
  const illustrations = project.slides.map((slide, index) => projectDrawing(project, slide, index));
  const [lead, ...drawings] = project.book ? projectBookSlide(project, illustrations) : illustrations;
  const slides = [lead, projectStorySlide(project), ...drawings];
  const info = projectInformation(project);
  const cover = projectCover(project);
  const body = [
    '<main id="main-content" class="project-page" data-gallery>',
    '  <h1 class="sr-only" id="gallery-title" tabindex="-1">' + escape(project.title) + '</h1>',
    '  <p class="sr-only" data-gallery-status aria-live="polite" aria-atomic="true"></p>',
    '  <section id="details-title" class="project-info-fallback editorial-shell" aria-labelledby="fallback-info-title">',
    '    <h2 id="fallback-info-title">' + escape(project.title) + '</h2>',
    project.subtitle ? '    <p>' + escape(project.subtitle) + '</p>' : '',
    info,
    '  </section>',
    '  <div class="project-slides">',
    ...slides.map(({ html }) => html),
    '    <div class="gallery-arrows requires-js" data-gallery-arrows role="group" aria-label="Slide controls">',
    '      <button type="button" data-prev aria-label="Previous slide"><svg viewBox="0 0 16 20" aria-hidden="true"><path d="m11 3-7 7 7 7"/></svg></button>',
    '      <button type="button" data-next aria-label="Next slide"><svg viewBox="0 0 16 20" aria-hidden="true"><path d="m5 3 7 7-7 7"/></svg></button>',
    '    </div>',
    '  </div>',
    '  <nav class="slide-navigation" aria-label="Project slides">',
    ...slides.map(({ id, label }, index) => (
      '    <a class="slide-dot" href="#' + id + '" data-slide-link aria-label="Slide ' + (index + 1) + ' of ' +
      slides.length + ': ' + escape(label) + '"><span aria-hidden="true"></span></a>'
    )),
    '  </nav>',
    '  <footer class="project-footer requires-js">',
    '    <div class="project-caption">',
    '      <p class="project-caption-title">' + escape(project.title) + '</p>',
    project.location ? '      <p class="project-caption-meta">' + escape(project.location) + '</p>' : '',
    '    </div>',
    '  </footer>',
    '  <dialog id="project-info" class="project-info" aria-labelledby="project-info-title">',
    '    <div class="intro-panel">',
    '      <form method="dialog" class="info-close"><button type="submit" aria-label="Close introduction" autofocus>×</button></form>',
    '      <div class="intro-inner">',
    '        <div class="intro-heading">',
    '          <h2 id="project-info-title">' + escape(project.title) + '</h2>',
    project.subtitle ? '          <p class="project-discipline">' + escape(project.subtitle) + '</p>' : '',
    '        </div>',
    info,
    '        <form method="dialog" class="enter-project"><button type="submit">View project <span aria-hidden="true">↓</span></button></form>',
    '      </div>',
    '    </div>',
    '  </dialog>',
    projectNarrativeDialog(project.narrative),
    '</main>',
  ].filter(Boolean).join('\n');
  return layout({
    title: project.title + ' | ' + name,
    description: project.summary,
    prefix: '../../',
    route: 'work/' + project.slug + '/',
    socialImage: { url: new URL(cover.src, siteUrl).href, alt: cover.alt },
    hasBook: Boolean(project.book),
    body,
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
      '    <p><a href="/projects/">Return to projects</a></p>',
      '  </div>',
      '</main>',
    ].join('\n'),
  });
}

function awardRow({ award, project }, year) {
  const url = safeUrl(award.url);
  const summary = award.summary ?? award.distinction ?? '';
  const projectPath = project ? '../work/' + localPath(project.slug) + '/' : '';
  const linkedTitle = project && [project.title, project.title.split(':')[0]]
    .find((title) => summary.startsWith(title + ' '));
  const description = linkedTitle
    ? '<a class="project-link" href="' + projectPath + '">' + escape(linkedTitle) + '</a>' +
      escape(summary.slice(linkedTitle.length))
    : escape(summary);
  const yearLabel = year === 'Undated'
    ? '<span class="about-meta">Undated</span>'
    : '<time class="about-meta" datetime="' + year + '">' + year + '</time>';
  const official = url
    ? '<a class="award-organization" href="' + url + '">' +
      escape(award.organization || 'Official award page') + '</a>'
    : award.organization ? '<span class="award-organization">' + escape(award.organization) + '</span>' : '';
  const links = (award.announcements ?? []).map(({ label, url }) => (
    '              <li><a href="' + safeUrl(url) + '">' + escape(label) + '</a></li>'
  ));
  if (project && !linkedTitle) {
    links.push('              <li><a class="project-link" href="' + projectPath + '">' + escape(project.title) + '</a></li>');
  }
  return [
    '        <li class="about-row award-row" data-about-reveal>',
    '          ' + yearLabel,
    '          <div class="award-details">',
    '            <h3 class="award-name">' + escape(award.headline ?? award.label) + '</h3>',
    official ? '            <p class="award-organizer">' + official + '</p>' : '',
    summary && summary !== '-' && summary !== award.label ? '            <p class="award-distinction">' + description + '</p>' : '',
    ...(links.length ? ['            <ul class="award-announcements">', ...links, '            </ul>'] : []),
    '          </div>',
    '        </li>',
  ].filter(Boolean).join('\n');
}

function aboutAwards() {
  const sections = [...awardsByYear.entries()].sort(([a], [b]) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return Number(b) - Number(a);
  }).map(([year, entries]) => [
    '    <section class="about-award-year" id="awards-' + year + '" aria-label="' + year + ' recognition">',
    '      <ul class="award-entries">',
    ...entries.map((entry) => awardRow(entry, year)),
    '      </ul>',
    '    </section>',
  ].join('\n'));
  return [
    '  <section class="about-section about-awards" id="recognition" aria-labelledby="awards">',
    '    <h2 class="section-label" id="awards" data-about-reveal>Recognition</h2>',
    '    <div class="about-award-years">',
    sections.length ? sections.join('\n') : '      <p>No awards are listed.</p>',
    '    </div>',
    '  </section>',
  ].join('\n');
}

function awardsRedirectPage() {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <meta name="robots" content="noindex">',
    '  <link rel="canonical" href="' + new URL('about/', siteUrl).href + '">',
    '  <title>Awards | ' + name + '</title>',
    '  <script>',
    '    const awardYear = /^#awards-(?:[0-9]{4}|Undated)$/.test(location.hash);',
    '    location.replace("../about/" + (awardYear ? location.hash : "#awards"));',
    '  </script>',
    '  <noscript><meta http-equiv="refresh" content="0;url=../about/#awards"></noscript>',
    '</head>',
    '<body><p><a href="../about/#awards">Awards &amp; Official Announcements</a></p></body>',
    '</html>',
    '',
  ].join('\n');
}

function pressDate(entry) {
  const date = entry.date || entry.year;
  if (!date) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (entry.endDate) return escape(formatter.formatRange(new Date(date), new Date(entry.endDate)));
    return '<time datetime="' + escape(date) + '">' + escape(formatter.format(new Date(date))) + '</time>';
  }
  if (/^\d{4}-\d{2}$/.test(date)) {
    const formatted = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' }).format(new Date(date + '-01'));
    return '<time datetime="' + escape(date) + '">' + escape(formatted) + '</time>';
  }
  return escape(date);
}

function pressEntry(entry) {
  const date = pressDate(entry);
  const dateNote = entry.dateNote ? '<span class="coverage-date-note">' + escape(entry.dateNote) + '</span>' : '';
  const url = safeUrl(entry.url);
  if (!url) throw new Error('Press entries require a source URL: ' + entry.title);
  return [
    '      <li class="press-entry coverage-row" data-press-publisher="' + escape(entry.publisher) + '">',
    '        <p class="coverage-date">' + date + dateNote + '</p>',
    '        <div class="coverage-story">',
    '          <h3 class="press-title"><a href="' + url + '">' + escape(entry.title) + '</a></h3>',
    entry.description ? '          <p>' + escape(entry.description) + '</p>' : '',
    '        </div>',
    '        <p class="coverage-publisher">' + escape(entry.publisher) + '</p>',
    '      </li>',
  ].filter(Boolean).join('\n');
}

function pressFilter(id, label, fallback, options) {
  return [
    '      <label class="press-filter" for="' + id + '">',
    '        ' + label,
    '        <span class="press-filter-control">',
    '          <select id="' + id + '">',
    '            <option value="">' + fallback + '</option>',
    ...options.map((option) => '            <option value="' + escape(option) + '">' + escape(option) + '</option>'),
    '          </select>',
    '        </span>',
    '      </label>',
  ];
}

function pressPage() {
  const years = new Map();
  const publishers = new Set();
  for (const entry of press) {
    const year = String(entry.date ?? entry.year ?? '').match(/^\d{4}(?=-|$)/)?.[0] ?? 'Undated';
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(entry);
    if (entry.publisher) publishers.add(entry.publisher);
  }
  const body = [
    '<main id="main-content" class="press-page archive-page" data-press-index>',
    '  <header class="archive-heading press-heading">',
    '    <h1>Press</h1>',
    '    <div class="press-filters" data-press-filters role="group" aria-label="Filter the press archive" hidden>',
    ...pressFilter('press-year', 'Year', 'All years', [...years.keys()]),
    ...pressFilter('press-publisher', 'Publisher', 'All publishers', [...publishers].sort((a, b) => a.localeCompare(b, 'en'))),
    '    </div>',
    '  </header>',
    '  <p class="sr-only" data-press-status role="status"></p>',
    '  <p class="press-empty" data-press-empty hidden>No press entries match these filters.</p>',
    ...Array.from(years, ([year, entries]) => [
      '  <section class="press-group" data-press-year="' + escape(year) + '" aria-labelledby="press-' + escape(year) + '">',
      '    <h2 class="section-label" id="press-' + escape(year) + '">' + escape(year) + '</h2>',
      '    <ul class="press-list">',
      ...entries.map(pressEntry),
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

function contactPage() {
  const email = 'jiewen.hu@hotmail.com';
  const instagram = 'jiewenhu59';
  const linkedIn = safeUrl('https://www.linkedin.com/in/jiewen-hu-3b416222b/');
  const body = [
    '<main id="main-content" class="contact-page editorial-shell">',
    '  <h1>Contact</h1>',
    '  <dl class="contact-links">',
    '    <div><dt>Email</dt><dd><a href="mailto:' + escape(email) + '">' + escape(email) + '</a></dd></div>',
    '    <div><dt>Instagram</dt><dd><a href="' + safeUrl('https://www.instagram.com/' + instagram + '/') + '">@' + escape(instagram) + '</a></dd></div>',
    '    <div><dt>LinkedIn</dt><dd><a href="' + linkedIn + '">' + name + '</a></dd></div>',
    '  </dl>',
    philadelphiaClock('  '),
    '</main>',
  ].join('\n');
  return layout({
    title: 'Contact | ' + name,
    description: 'Professional contact and profile links for ' + name + ', a landscape designer based in Philadelphia.',
    prefix: '../',
    route: 'contact/',
    body,
  });
}

function sitemap() {
  const paths = ['', 'projects/', 'about/', 'contact/', ...(press.length ? ['press/'] : []), ...projects.map(({ slug }) => 'work/' + slug + '/')];
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
const press = pressRecords
  .map((entry) => ({ ...entry, publisher: String(entry.publisher ?? '').trim() }))
  .sort((a, b) => String(b.date ?? b.year ?? '').localeCompare(String(a.date ?? a.year ?? '')));

async function writePage(path, html) {
  const destination = join(docs, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html, 'utf8');
}

await Promise.all([
  writePage('index.html', homePage()),
  writePage('projects/index.html', projectsPage()),
  writePage('about/index.html', aboutPage()),
  writePage('contact/index.html', contactPage()),
  writePage('awards/index.html', awardsRedirectPage()),
  ...(press.length ? [writePage('press/index.html', pressPage())] : []),
  ...projects.map((project) => writePage('work/' + project.slug + '/index.html', projectPage(project))),
  writePage('404.html', notFoundPage()),
  writePage('sitemap.xml', sitemap()),
  writePage('archive-version.json', JSON.stringify(archiveVersions, null, 2) + '\n'),
]);

console.log('Built ' + (projects.length + 6 + Number(press.length > 0)) + ' HTML pages and sitemap.');
