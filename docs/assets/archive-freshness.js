(() => {
  'use strict';

  const source = document.currentScript?.src;
  if (!source) return;
  const siteRoot = new URL('../', source);
  if (siteRoot.origin !== window.location.origin) return;

  const navigationParameter = '__archive_nav';
  const refreshParameter = '__archive_refresh';
  const manifestUrl = new URL('archive-version.json', siteRoot);
  const pagePaths = new Set(['', 'projects/', 'press/', 'about/', 'awards/'].flatMap((route) => {
    const path = new URL(route, siteRoot).pathname;
    return [path, path.slice(0, -1), path + 'index.html'];
  }));
  const workPath = new URL('work/', siteRoot).pathname;

  function isSitePage(url) {
    if (url.origin !== siteRoot.origin) return false;
    if (pagePaths.has(url.pathname)) return true;
    return url.pathname.startsWith(workPath) &&
      /^[a-z0-9-]+(?:\/(?:index\.html)?)?$/.test(url.pathname.slice(workPath.length));
  }

  function nonce() {
    return window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function removeMarker(parameter) {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(parameter)) return;
    url.searchParams.delete(parameter);
    try {
      window.history.replaceState(window.history.state, '', url.href);
    } catch {
      // A restricted history API should not interrupt ordinary navigation.
    }
  }

  function installPageLinks() {
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target?.closest?.('a[href]');
      if (!link || link.hasAttribute('download')) return;
      let destination;
      try {
        destination = new URL(link.href, document.baseURI);
      } catch {
        return;
      }
      if (!isSitePage(destination)) return;
      const current = new URL(window.location.href);
      if (destination.pathname === current.pathname && destination.search === current.search && destination.hash) return;

      const original = link.getAttribute('href');
      destination.searchParams.delete(refreshParameter);
      destination.searchParams.set(navigationParameter, nonce());
      const freshHref = destination.href;
      link.setAttribute('href', freshHref);
      // Let the browser preserve its normal target and navigation behavior.
      window.setTimeout(() => {
        if (link.getAttribute('href') === freshHref) link.setAttribute('href', original);
      }, 0);
    });
  }

  function installFreshnessCheck() {
    const archive = document.body?.dataset.archive;
    const currentVersion = document.body?.dataset.archiveVersion;
    if (!['press', 'awards'].includes(archive) || !currentVersion) return;

    let request = null;
    let generation = 0;
    let navigating = false;

    async function checkFreshness() {
      if (document.visibilityState === 'hidden' || request || navigating) return;
      const controller = new AbortController();
      request = controller;
      const run = ++generation;
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      const url = new URL(manifestUrl);
      url.searchParams.set('__check', nonce());
      try {
        const response = await fetch(url.href, {
          cache: 'no-store',
          redirect: 'error',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const manifest = await response.json();
        const publishedVersion = manifest?.[archive];
        if (typeof publishedVersion !== 'string' || !publishedVersion || publishedVersion.length > 256 ||
          run !== generation || document.visibilityState === 'hidden') return;
        if (publishedVersion === currentVersion) {
          removeMarker(refreshParameter);
          return;
        }

        const destination = new URL(window.location.href);
        const marker = destination.searchParams.get(refreshParameter) || '';
        const separator = marker.lastIndexOf('.');
        const attemptedVersion = separator < 0 ? '' : marker.slice(0, separator);
        // If the CDN still served old HTML after this attempt, wait for the next
        // published version rather than repeatedly navigating.
        if (attemptedVersion === publishedVersion) return;
        destination.searchParams.delete(navigationParameter);
        destination.searchParams.set(refreshParameter, publishedVersion + '.' + nonce());
        navigating = true;
        window.location.replace(destination.href);
      } catch {
        navigating = false;
        // Offline, unpublished and interrupted responses can be retried on entry.
      } finally {
        window.clearTimeout(timeout);
        if (request === controller) request = null;
      }
    }

    window.addEventListener('pagehide', () => {
      generation += 1;
      request?.abort();
      request = null;
      navigating = false;
    });
    window.addEventListener('pageshow', checkFreshness);
    window.addEventListener('focus', checkFreshness);
    window.addEventListener('online', checkFreshness);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkFreshness();
    });
    checkFreshness();
  }

  function initialize() {
    removeMarker(navigationParameter);
    installPageLinks();
    installFreshnessCheck();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
