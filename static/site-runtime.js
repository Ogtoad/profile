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

  window.__PROPHILE_BASE_PATH__ = normalizeBasePath(deriveBasePathFromScript() || deriveBasePathFromTheme());

  ensureDocumentReady(function () {
    try {
      applyThemeAssetVariables();
      loadStylesheetOnce(buildUrl('/tsparticles.css'));

      loadScriptOnce('https://cdn.jsdelivr.net/npm/tsparticles@2.12.0/tsparticles.bundle.min.js')
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
