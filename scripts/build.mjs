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

const [daylightStyles, clockScript, archiveFreshnessScript, aboutStyles, aboutRevealScript] = await Promise.all([
  readVersionSource(join(docs, 'assets', 'daylight.css')),
  readVersionSource(join(docs, 'assets', 'philadelphia-clock.js')),
  readVersionSource(join(docs, 'assets', 'archive-freshness.js')),
  readVersionSource(join(docs, 'assets', 'about.css')),
  readVersionSource(join(docs, 'assets', 'about-reveal.js')),
]);
const daylightStylesVersion = assetVersion(daylightStyles);
const clockScriptVersion = assetVersion(clockScript);
const archiveFreshnessVersion = assetVersion(archiveFreshnessScript);
const aboutStylesVersion = assetVersion(aboutStyles);
const aboutRevealVersion = assetVersion(aboutRevealScript);
const editorialStylesVersion = assetVersion(await readVersionSource(join(docs, 'assets', 'editorial.css')));
const cvPath = 'files/jiewen-hu-cv.pdf';
const cvVersion = assetVersion(await readFile(join(docs, cvPath)));

const sharedArchiveSources = await Promise.all([
  readVersionSource(fileURLToPath(import.meta.url)),
  daylightStyles,
  clockScript,
  archiveFreshnessScript,
  ...['site.css', 'portfolio.css', 'reference-type.css', 'press.js']
    .map((file) => readVersionSource(join(docs, 'assets', file))),
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

function siteHeader(prefix, route) {
  const navigation = [
    [prefix, 'Home', ''],
    [prefix + 'projects/', 'Projects', 'projects/'],
    ...(press.length ? [[prefix + 'press/', 'Press', 'press/']] : []),
    [prefix + 'about/', 'About', 'about/'],
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

function layout({ body, title, description, prefix, route, socialImage, fixedTheme, notFound = false }) {
  const home = route === '';
  const about = route === 'about/';
  const project = route?.startsWith('work/');
  const editorial = home || project || route === 'projects/';
  const themeAttributes = fixedTheme ? ' data-theme="' + fixedTheme + '" data-theme-lock="' + fixedTheme + '"' : '';
  const archive = route === 'press/' ? 'press' : about ? 'awards' : '';
  const archiveAttributes = archive ? ' data-archive="' + archive + '" data-archive-version="' + archiveVersions[archive] + '"' : '';
  const tags = [
    '<!doctype html>',
    '<html lang="en"' + themeAttributes + '>',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>' + escape(title) + '</title>',
    '  <meta name="description" content="' + escape(description) + '">',
    '  <meta name="theme-color" content="' + (fixedTheme === 'day' ? '#ffffff' : '#000000') + '">',
    ...(!fixedTheme ? ['  <script src="' + prefix + 'assets/philadelphia-clock.js?v=' + clockScriptVersion + '"></script>'] : []),
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
  tags.push('  <script defer src="' + prefix + 'assets/archive-freshness.js?v=' + archiveFreshnessVersion + '"></script>');
  if (about) tags.push(
    '  <link rel="stylesheet" href="' + prefix + 'assets/about.css?v=' + aboutStylesVersion + '">',
    '  <script defer src="' + prefix + 'assets/about-reveal.js?v=' + aboutRevealVersion + '"></script>',
  );
  if (route === 'press/') tags.push('  <script defer src="' + prefix + 'assets/press.js"></script>');
  if (editorial) tags.push('  <link rel="stylesheet" href="' + prefix + 'assets/editorial.css?v=' + editorialStylesVersion + '">');
  if (project) tags.push('  <script defer src="' + prefix + 'assets/project-viewer.js"></script>');
  tags.push(
    '</head>',
    '<body' + archiveAttributes + '>',
    '<a class="skip-link" href="#main-content">Skip to content</a>',
    siteHeader(prefix, route),
    body,
  );
  if (!notFound) tags.push('<footer class="site-footer">' + name + '</footer>');
  if (home) tags.push(
    '<aside class="philadelphia-clock" id="philadelphia-clock" aria-label="Local time in Philadelphia" hidden>',
    '  <p>The time in Philadelphia is <time id="philadelphia-clock-time"></time>. <span id="philadelphia-clock-period"></span></p>',
    '  <p>The website theme is adjusted accordingly.</p>',
    '</aside>'
  );
  tags.push('</body>', '</html>', '');
  return tags.join('\n');
}

const introduction = 'Landscape design and research on how places hold memory and change over time.';
const biography = 'Jiewen Hu is a landscape designer based in Philadelphia. Her work explores how landscapes hold memory and how ecological repair can support communities.';
const featuredSlugs = ['leaving-traces', 'from-ruins-to-roots', 'ground-in-friction'];
const homeReelSequence = [
  ['leaving-traces', 'signal-valley.webp', '45% 35%'],
  ['ground-in-friction', 'web/perspective-6.webp', '50% 46%'],
  ['from-separation-to-ambiguity', 'web/01-perspective-1.webp', '50% 50%'],
  ['not-quite-order', 'web/perspective.webp', '50% 54%'],
  ['soil-holds', 'web/04-working-ground.webp', '50% 51%'],
  ['the-latent-ground', 'perspective.jpg', '50% 50%'],
  ['leaving-traces', 'sheltering-woodland.webp', '50% 38%'],
];

function projectMedia(project, file) {
  return 'media/' + localPath(project.slug) + '/' + localPath(file);
}

function projectCover(project) {
  const slide = project.slides[0];
  return { src: projectMedia(project, project.cover || slide.file), alt: project.coverAlt || slide.alt };
}

function homeHeroImage() {
  for (const [slug, file, position] of homeReelSequence) {
    const project = projects.find((entry) => entry.slug === slug);
    const slide = project?.slides.find((entry) => entry.file === file);
    if (slide) return { project, slide, position };
  }
  const [project] = projects;
  return project && { project, slide: project.slides[0], position: '50% 50%' };
}

function reelFrame({ project, slide, position }) {
  return [
    '    <figure class="reel-frame">',
    '      <a class="reel-image-link" href="./work/' + localPath(project.slug) + '/" aria-label="View ' + escape(project.title) + '">',
    '        <img src="./' + projectMedia(project, slide.file) + '" alt="' + escape(slide.alt) + '" decoding="async" style="object-position:' + position + '" fetchpriority="high">',
    '      </a>',
    '      <figcaption>' + escape(project.title) + '</figcaption>',
    '    </figure>',
  ].join('\n');
}

function homePage() {
  const lead = homeHeroImage();
  const body = [
    '<main id="main-content" class="portfolio-home">',
    '  <h1 class="sr-only">' + name + ' | Landscape Architecture</h1>',
    ...(lead ? [
      '  <section class="home-reel" id="work" aria-label="Featured project">',
      reelFrame(lead),
      '  </section>',
    ] : []),
    '  <section class="portfolio-shell home-bio" id="about" aria-labelledby="home-about-title">',
    '    <div class="home-bio-inner">',
    '      <h2 id="home-about-title" class="section-label">About</h2>',
    '      <p>' + biography + '</p>',
    '      <p>She practices at OLIN and holds a Master of Landscape Architecture from the University of Pennsylvania.</p>',
    '      <p class="home-bio-links">',
    '        <a href="./' + cvPath + '?v=' + cvVersion + '" target="_blank" rel="noopener">View CV <span aria-hidden="true">↗</span></a>',
    '        <a href="./about/">About Jiewen <span aria-hidden="true">↗</span></a>',
    '        <a href="./projects/">View projects <span aria-hidden="true">↗</span></a>',
    '      </p>',
    '    </div>',
    '  </section>',
    ...(press.length ? [
      '  <section class="portfolio-shell home-press home-press-index" aria-labelledby="latest-press">',
      '    <div class="section-header"><h2 class="section-label" id="latest-press">Press</h2><a href="./press/">View all press</a></div>',
      '    <ul class="press-list">',
      ...press.slice(0, 10).map((entry) => pressEntry(entry, 'h3', false)),
      '    </ul>',
      '  </section>',
    ] : []),
    '</main>',
  ].filter(Boolean).join('\n');
  return layout({
    title: name + ' | Landscape Architecture',
    description: introduction,
    prefix: './',
    route: '',
    socialImage: lead ? { url: new URL(projectMedia(lead.project, lead.slide.file), siteUrl).href, alt: lead.slide.alt } : undefined,
    body,
  });
}

function projectIndexCard(project) {
  const cover = projectCover(project);
  return [
    '      <li>',
    '        <a class="selected-project-card" href="../work/' + localPath(project.slug) + '/">',
    '          <span class="selected-project-image"><img src="../' + cover.src + '" alt="' + escape(cover.alt) + '" decoding="async"></span>',
    '          <span class="selected-project-title">' + escape(project.title) + '</span>',
    '          <span class="selected-project-location">' + escape(project.location) + '</span>',
    '        </a>',
    '      </li>',
  ].join('\n');
}

function projectIndexRow(project) {
  return [
    '        <tr>',
    '          <th scope="row"><a href="../work/' + localPath(project.slug) + '/">' + escape(project.title) + '</a></th>',
    '          <td>' + escape(project.location) + '</td>',
    '          <td>' + escape(project.year) + '</td>',
    '          <td>' + escape(project.type) + '</td>',
    '        </tr>',
  ].join('\n');
}

function projectsPage() {
  const featured = featuredSlugs.map((slug) => projects.find((project) => project.slug === slug)).filter(Boolean);
  const entries = [...projects].sort((a, b) => Number(b.year) - Number(a.year));
  const body = [
    '<main id="main-content" class="project-index">',
    '  <section class="editorial-shell project-index-selected" aria-labelledby="selected-projects">',
    '    <header class="project-index-heading"><p>Selected</p><h1 id="selected-projects">Projects</h1></header>',
    '    <ul class="selected-projects">',
    ...featured.map(projectIndexCard),
    '    </ul>',
    '  </section>',
    '  <section class="editorial-shell project-index-archive" aria-labelledby="project-archive">',
    '    <header class="project-index-heading archive-index-heading"><p>Projects</p><h2 id="project-archive">Archive</h2></header>',
    '    <table class="project-index-table">',
    '      <thead><tr><th scope="col">Title</th><th scope="col">Location</th><th scope="col">Year</th><th scope="col">Type</th></tr></thead>',
    '      <tbody>',
    ...entries.map(projectIndexRow),
    '      </tbody>',
    '    </table>',
    '  </section>',
    '</main>',
  ].join('\n');
  return layout({
    title: 'Projects | ' + name,
    description: 'Selected landscape architecture projects and an archive of work by ' + name + '.',
    prefix: '../',
    route: 'projects/',
    fixedTheme: 'day',
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
    '      <p>Her work has been featured by <em>Landscape Architecture Magazine</em>, ASLA LAND, World Landscape Architecture, Landezine, Penn Weitzman, Archinect, Urbanize LA, and Secret Los Angeles. Her projects have been exhibited in Berlin and Hong Kong, and as part of Melbourne Design Week.</p>',
    '      <div class="about-actions"><a href="#awards">Awards &amp; announcements <span aria-hidden="true">↓</span></a><a href="../press/">Press and publications <span aria-hidden="true">↗</span></a></div>',
    '    </div>',
    '  </header>',
    '  <section class="about-section" aria-labelledby="practice">',
    '    <h2 class="section-label" id="practice" data-about-reveal data-about-reveal-delay="section">Practice</h2>',
    '    <div class="about-row" data-about-reveal data-about-reveal-delay="section">',
    '      <p class="about-meta">Philadelphia, PA</p>',
    '      <div><h3><a href="https://theolinstudio.com/jiewen-hu/">OLIN</a></h3><p>Landscape Designer II</p></div>',
    '    </div>',
    '    <div class="about-row additional-profile-row" data-about-reveal><p class="about-meta">Previous experience</p><div><h3>SWA Group, Studio Outside, and Jonathan Alderson Landscape Architects</h3></div></div>',
    '  </section>',
    '  <section class="about-section" aria-labelledby="education">',
    '    <h2 class="section-label" id="education" data-about-reveal>Education</h2>',
    '    <div class="about-row" data-about-reveal>',
    '      <p class="about-meta"><time datetime="2024">2024</time><br>Philadelphia, PA</p>',
    '      <div><h3><a href="https://www.design.upenn.edu/yes2024/jiewen-hu">University of Pennsylvania</a></h3><p>Master of Landscape Architecture</p><p>Certificate in GIS and Spatial Analysis</p></div>',
    '    </div>',
    "    <div class=\"about-row additional-profile-row\" data-about-reveal><p class=\"about-meta\">Hangzhou, China</p><div><h3>Zhejiang University</h3><p>Bachelor’s degree in Landscape Gardening</p></div></div>",
    '  </section>',
    aboutAwards(),
    '</main>',
  ].join('\n');
  return layout({
    title: 'About | ' + name,
    description: 'Biography, practice, education, awards, and official announcements for Jiewen Hu, a landscape designer based in Philadelphia.',
    prefix: '../',
    route: 'about/',
    fixedTheme: 'day',
    body,
  });
}

function projectArt(project, { slide, number }, variant) {
  const path = '../../' + projectMedia(project, slide.file);
  const caption = slide.caption || slide.label || slide.alt;
  const imageLoading = variant === 'hero' ? ' fetchpriority="high"' : ' loading="lazy"';
  return [
    '    <figure id="slide-' + number + '" class="project-art project-art-' + variant + '">',
    '      <a href="' + path + '" data-viewer-image data-viewer-caption="' + escape(caption) + '">',
    '        <img src="' + path + '" alt="' + escape(slide.alt) + '" decoding="async"' + imageLoading + '>',
    '      </a>',
    caption ? '      <figcaption>' + escape(caption) + '</figcaption>' : '',
    '    </figure>',
  ].filter(Boolean).join('\n');
}

function detailRow(label, value) {
  return '      <div><dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd></div>';
}

function projectDetails(project) {
  const basicDetails = [
    { label: 'Location', value: project.location },
    { label: 'Year', value: project.year },
    { label: 'Type', value: project.type },
  ].filter(({ value }) => value);
  const credits = (project.credits ?? []).filter(({ label }) => (
    !basicDetails.some((detail) => detail.label.toLowerCase() === label.toLowerCase())
  ));
  const awards = (project.awards ?? []).map(({ label, distinction, url }) => {
    const display = escape(distinction ? label + ' — ' + distinction : label);
    return '        <li>' + (url ? '<a href="' + safeUrl(url) + '">' + display + '</a>' : display) + '</li>';
  });
  const source = safeUrl(project.source);
  return [
    '  <section class="editorial-shell project-section project-details" aria-labelledby="details-title">',
    '    <h2 id="details-title">Project details</h2>',
    '    <div class="project-section-content">',
    '      <dl class="project-facts">',
    ...[...basicDetails, ...credits].map(({ label, value }) => detailRow(label, value)),
    '      </dl>',
    awards.length ? '      <ul aria-label="Project recognition" class="project-recognitions">\n' + awards.join('\n') + '\n      </ul>' : '',
    source ? '      <p class="original-project-link"><a href="' + source + '">Original project page</a></p>' : '',
    '    </div>',
    '  </section>',
  ].filter(Boolean).join('\n');
}

function projectStatement(project) {
  const narrative = project.narrative;
  return [
    '  <section class="editorial-shell project-section project-statement" id="story" aria-labelledby="statement-title">',
    '    <h2 id="statement-title">Project statement</h2>',
    '    <div class="project-section-content">',
    paragraphs(project.story?.length ? project.story : [project.summary]),
    narrative?.paragraphs?.length ? [
      '      <details class="project-extra-story">',
      '        <summary>' + escape(narrative.title || 'Read the full narrative') + '</summary>',
      paragraphs(narrative.paragraphs),
      '      </details>',
    ].join('\n') : '',
    '    </div>',
    '  </section>',
  ].filter(Boolean).join('\n');
}

function detailImages(project) {
  const [first, ...rest] = project.slides;
  // Keep deep links from the original sequence: the text was position 2.
  const drawings = rest.map((slide, index) => ({ slide, number: index + 3 }));
  const highlights = drawings.filter(({ slide }) => !slide.file.includes('/booklet/')).slice(0, 4);
  return {
    lead: { slide: first, number: 1 },
    highlights,
    archive: drawings.filter((drawing) => !highlights.includes(drawing)),
  };
}

function projectViewer() {
  return [
    '  <dialog class="project-viewer" data-project-viewer aria-labelledby="viewer-caption">',
    '    <div class="project-viewer-controls">',
    '      <button type="button" data-viewer-prev aria-label="Previous drawing">Previous</button>',
    '      <button type="button" data-viewer-next aria-label="Next drawing">Next</button>',
    '      <button type="button" data-viewer-close>Close</button>',
    '    </div>',
    '    <figure>',
    '      <img data-viewer-full alt="">',
    '      <figcaption id="viewer-caption">Drawing</figcaption>',
    '    </figure>',
    '  </dialog>',
  ].join('\n');
}

function projectPage(project) {
  const { lead, highlights, archive } = detailImages(project);
  const cover = projectCover(project);
  const containLead = ['back-to-roots', 'from-ruins-to-roots'].includes(project.slug);
  const body = [
    '<main id="main-content" class="project-essay" data-project-story>',
    '  <div class="editorial-shell project-lead' + (containLead ? ' project-lead-contained' : '') + '">',
    projectArt(project, lead, 'hero'),
    '  </div>',
    '  <header class="editorial-shell project-essay-heading">',
    '    <div><h1>' + escape(project.title) + '</h1>',
    project.subtitle ? '    <p class="project-essay-subtitle">' + escape(project.subtitle) + '</p>' : '',
    '    </div>',
    '    <p class="project-essay-summary">' + escape(project.summary) + '</p>',
    '  </header>',
    projectDetails(project),
    projectStatement(project),
    highlights.length ? [
      '  <div class="editorial-shell project-illustrations">',
      ...highlights.map((drawing) => projectArt(project, drawing, 'inline')),
      '  </div>',
    ].join('\n') : '',
    archive.length ? [
      '  <section class="editorial-shell project-drawings" aria-labelledby="drawings-title">',
      '    <h2 id="drawings-title">Drawings and images</h2>',
      '    <div class="project-thumbnail-grid">',
      ...archive.map((drawing) => projectArt(project, drawing, 'thumbnail')),
      '    </div>',
      '  </section>',
    ].join('\n') : '',
    '  <div class="editorial-shell project-back"><a href="../../projects/">Back to projects</a></div>',
    projectViewer(),
    '</main>',
  ].filter(Boolean).join('\n');
  return layout({
    title: project.title + ' | ' + name,
    description: project.summary,
    prefix: '../../',
    route: 'work/' + project.slug + '/',
    fixedTheme: ['leaving-traces', 'back-to-roots'].includes(project.slug) ? 'night' : 'day',
    socialImage: { url: new URL(cover.src, siteUrl).href, alt: cover.alt },
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
    '      <li class="award-row" data-about-reveal>',
    '        <div class="award-details">',
    '          <h4 class="award-name">' + escape(award.label) + '</h4>',
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

function aboutAwards() {
  const sections = [...awardsByYear.entries()].sort(([a], [b]) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return Number(b) - Number(a);
  }).map(([year, entries]) => {
    const yearLabel = year === 'Undated' ? year : '<time datetime="' + year + '">' + year + '</time>';
    return [
      '      <section class="about-award-year" aria-labelledby="awards-' + year + '">',
      '        <h3 class="award-year" id="awards-' + year + '" data-about-reveal>' + yearLabel + '</h3>',
      '        <ul class="award-entries">',
      ...entries.map(awardRow),
      '        </ul>',
      '      </section>',
    ].join('\n');
  });
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
    fixedTheme: 'day',
    body,
  });
}

function sitemap() {
  const paths = ['', 'projects/', 'about/', ...(press.length ? ['press/'] : []), ...projects.map(({ slug }) => 'work/' + slug + '/')];
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
  writePage('projects/index.html', projectsPage()),
  writePage('about/index.html', aboutPage()),
  writePage('awards/index.html', awardsRedirectPage()),
  ...(press.length ? [writePage('press/index.html', pressPage())] : []),
  ...projects.map((project) => writePage('work/' + project.slug + '/index.html', projectPage(project))),
  writePage('404.html', notFoundPage()),
  writePage('sitemap.xml', sitemap()),
  writePage('archive-version.json', JSON.stringify(archiveVersions, null, 2) + '\n'),
]);

console.log('Built ' + (projects.length + 5 + Number(press.length > 0)) + ' HTML pages and sitemap.');
