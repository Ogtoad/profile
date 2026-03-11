// site-runtime.js
// Bootstraps post-build enhancements with GitHub Pages-aware base path
// detection, defensive logging, and sequential asset loading.

(function bootstrapSiteRuntime() {
  'use strict';

  var LOG_PREFIX = '[site-runtime]';
  var RUNTIME_FLAG = '__prophileSiteRuntimeLoaded';

  if (window[RUNTIME_FLAG]) {
    return;
  }

  window[RUNTIME_FLAG] = true;

  function logInfo(message, details) {
    if (details) {
      console.log(LOG_PREFIX + ' INFO ' + message, details);
      return;
    }

    console.log(LOG_PREFIX + ' INFO ' + message);
  }

  function logWarn(message, details) {
    if (details) {
      console.warn(LOG_PREFIX + ' WARN ' + message, details);
      return;
    }

    console.warn(LOG_PREFIX + ' WARN ' + message);
  }

  function logError(message, error) {
    console.error(LOG_PREFIX + ' ERROR ' + message, error);
  }

  function normalizeBasePath(candidatePath) {
    if (!candidatePath || candidatePath === '/') {
      return '';
    }

    return candidatePath.replace(/\/+$/, '');
  }

  function deriveBasePathFromTheme() {
    var themeLink = document.querySelector('link[href$="myst-theme.css"], link[href*="/myst-theme.css"]');
    var href = themeLink ? themeLink.getAttribute('href') : '';
    var match = href ? href.match(/^(.*)\/myst-theme\.css(?:\?.*)?$/) : null;

    if (!match) {
      return '';
    }

    return normalizeBasePath(match[1]);
  }

  function deriveBasePathFromScript() {
    var currentScript = document.currentScript;

    if (!currentScript || !currentScript.src) {
      return '';
    }

    try {
      var scriptUrl = new URL(currentScript.src, window.location.href);
      return normalizeBasePath(scriptUrl.pathname.replace(/\/site-runtime\.js$/, ''));
    } catch (error) {
      logWarn('Unable to derive base path from current script', error);
      return '';
    }
  }

  function buildUrl(pathname) {
    var normalizedPath = pathname && pathname.charAt(0) === '/' ? pathname : '/' + pathname;
    return (window.__PROPHILE_BASE_PATH__ || '') + normalizedPath;
  }

  function applyThemeAssetVariables() {
    if (!document.documentElement || !document.documentElement.style) {
      logWarn('documentElement style is unavailable; skipping theme asset variable injection');
      return;
    }

    document.documentElement.style.setProperty('--site-logo-url', 'url("' + buildUrl('/logo.png') + '")');
    document.documentElement.style.setProperty('--site-base-path', '"' + (window.__PROPHILE_BASE_PATH__ || '') + '"');
  }

  function loadStylesheetOnce(url) {
    if (document.querySelector('link[href="' + url + '"]')) {
      logInfo('Stylesheet already present; skipping duplicate injection', url);
      return;
    }

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
    logInfo('Injected stylesheet', url);
  }

  function loadScriptOnce(url) {
    return new Promise(function (resolve, reject) {
      var existingScript = document.querySelector('script[src="' + url + '"]');

      if (existingScript) {
        logInfo('Script already present; skipping duplicate injection', url);
        resolve(existingScript);
        return;
      }

      var script = document.createElement('script');
      script.src = url;
      script.defer = true;

      script.onload = function () {
        logInfo('Loaded script successfully', url);
        resolve(script);
      };

      script.onerror = function (event) {
        reject(new Error('Failed to load script: ' + url + ' (' + (event && event.type ? event.type : 'unknown error') + ')'));
      };

      document.body.appendChild(script);
    });
  }

  function ensureDocumentReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }

    callback();
  }

  function refreshArticleLayout() {
    if (typeof window.ProphileArticleSections === 'function') {
      window.ProphileArticleSections();
    }
  }

  function refreshSidebarState() {
    if (window.ProphileSidebar && typeof window.ProphileSidebar.refresh === 'function') {
      window.ProphileSidebar.refresh();
    }
  }

  function closeMobileSidebar() {
    document.body.classList.remove('sidebar-open');
    document.body.classList.remove('sidebar-open-lock');

    var menuButton = document.querySelector('.site-menu-button');
    if (menuButton) {
      menuButton.setAttribute('aria-expanded', 'false');
    }
  }

  function scrollAfterSwap() {
    window.requestAnimationFrame(function () {
      if (window.location.hash) {
        var target = document.querySelector(window.location.hash);
        if (target && typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ block: 'start', behavior: 'smooth' });
          return;
        }
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function setupHtmxNavigation() {
    if (!window.htmx) {
      return;
    }

    var listenersReady = document.body.dataset.htmxNavigationReady === 'true';

    var boostSelectors = [
      '.site-header-bar',
      '.site-sidebar',
      '.site-pagination',
      '.appendix-directory'
    ];

    boostSelectors.forEach(function (selector) {
      var root = document.querySelector(selector);

      if (!root) {
        return;
      }

      root.setAttribute('hx-boost', 'true');
      root.setAttribute('hx-target', '.site-main');
      root.setAttribute('hx-select', '.site-main');
      root.setAttribute('hx-swap', 'outerHTML');
      root.setAttribute('hx-push-url', 'true');
      window.htmx.process(root);
    });

    if (!listenersReady) {
      document.body.addEventListener('htmx:beforeRequest', function (event) {
        var target = event.detail && event.detail.target;

        if (target && target.matches && target.matches('.site-main')) {
          target.classList.add('is-loading');
        }
      });

      document.body.addEventListener('htmx:afterSwap', function (event) {
        var target = event.detail && event.detail.target;

        if (!target || !target.matches || !target.matches('.site-main')) {
          return;
        }

        target.classList.remove('is-loading');
        refreshArticleLayout();
        refreshSidebarState();
        setupHtmxNavigation();
        closeMobileSidebar();
        scrollAfterSwap();
      });

      document.body.addEventListener('htmx:responseError', function () {
        var main = document.querySelector('.site-main');

        if (main) {
          main.classList.remove('is-loading');
        }
      });

      document.body.dataset.htmxNavigationReady = 'true';
      logInfo('HTMX navigation enabled');
    }
  }

  window.__PROPHILE_BASE_PATH__ = normalizeBasePath(deriveBasePathFromScript() || deriveBasePathFromTheme());

  ensureDocumentReady(function () {
    try {
      applyThemeAssetVariables();
      loadStylesheetOnce(buildUrl('/tsparticles.css'));

      loadScriptOnce('https://unpkg.com/htmx.org@2.0.4')
        .then(function () {
          return loadScriptOnce('https://cdn.jsdelivr.net/npm/tsparticles@2.12.0/tsparticles.bundle.min.js');
        })
        .then(function () {
          return loadScriptOnce(buildUrl('/tsparticles.js'));
        })
        .then(function () {
          return loadScriptOnce(buildUrl('/sidebar-headings.js'));
        })
        .then(function () {
          return loadScriptOnce(buildUrl('/article-sections.js'));
        })
        .then(function () {
          setupHtmxNavigation();
          logInfo('All runtime enhancements loaded successfully', {
            basePath: window.__PROPHILE_BASE_PATH__ || '/',
            pathname: window.location.pathname
          });
        })
        .catch(function (error) {
          logError('Failed to load one or more runtime enhancements', error);
        });
    } catch (error) {
      logError('Unexpected runtime bootstrap failure', error);
    }
  });
})();
