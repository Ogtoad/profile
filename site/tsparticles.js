// tsparticles.js
// Initializes the decorative background with retries, logging, and recovery if
// the post-build DOM changes remove the container.

(function initParticles() {
  'use strict';

  var LOG_PREFIX = '[tsparticles]';
  var attemptCount = 0;
  var maxAttempts = 40;
  var initializationStarted = false;

  function getCssVariableValue(name, fallbackValue) {
    try {
      var computedStyles = window.getComputedStyle(document.documentElement);
      var cssValue = computedStyles.getPropertyValue(name);

      if (cssValue && cssValue.trim()) {
        return cssValue.trim();
      }
    } catch (error) {
      logWarn('Unable to read CSS variable; using fallback value instead', {
        variableName: name,
        fallbackValue: fallbackValue,
        message: error && error.message ? error.message : error
      });
    }

    return fallbackValue;
  }

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

  function ensureContainer() {
    var container = document.getElementById('tsparticles');

    if (container) {
      return container;
    }

    if (!document.body) {
      logWarn('document.body is unavailable; cannot create particle container yet');
      return null;
    }

    container = document.createElement('div');
    container.id = 'tsparticles';
    document.body.insertBefore(container, document.body.firstChild);
    logInfo('Created missing tsParticles container');
    return container;
  }

  function getParticleConfig() {
    var particleColor = getCssVariableValue('--text', '#F0F0F0');
    var linkColor = getCssVariableValue('--accent-dim', '#D0D0D0');

    return {
      fullScreen: false,
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'repulse' },
          onClick: { enable: true, mode: 'push' },
          resize: true
        },
        modes: {
          repulse: {
            distance: 120,
            duration: 0.8,
            speed: 0.5
          },
          push: { quantity: 1 }
        }
      },
      particles: {
        color: { value: particleColor },
        links: {
          color: linkColor,
          distance: 200,
          enable: true,
          opacity: 0.06,
          width: 0.8
        },
        move: {
          enable: true,
          speed: 0.3,
          direction: 'none',
          random: true,
          straight: false,
          outModes: { default: 'out' },
          attract: {
            enable: true,
            rotateX: 600,
            rotateY: 1200
          }
        },
        number: {
          density: { enable: true, area: 1200 },
          value: 35
        },
        opacity: {
          value: { min: 0.03, max: 0.2 },
          animation: {
            enable: true,
            speed: 0.3,
            minimumValue: 0.02,
            sync: false
          }
        },
        shape: { type: 'circle' },
        size: {
          value: { min: 0.5, max: 2.5 },
          animation: {
            enable: true,
            speed: 0.5,
            minimumValue: 0.3,
            sync: false
          }
        }
      },
      detectRetina: true
    };
  }

  function watchContainer() {
    if (!window.MutationObserver || !document.body) {
      logWarn('MutationObserver unavailable; particle container will not be watched');
      return;
    }

    var observer = new MutationObserver(function () {
      if (document.getElementById('tsparticles')) {
        return;
      }

      observer.disconnect();
      logWarn('Particle container disappeared; scheduling reinitialization');
      window.setTimeout(start, 500);
    });

    observer.observe(document.body, { childList: true });
  }

  function start() {
    if (initializationStarted) {
      return;
    }

    attemptCount += 1;

    if (typeof window.tsParticles === 'undefined') {
      if (attemptCount >= maxAttempts) {
        logWarn('tsParticles library never became available; background effect disabled', {
          attempts: attemptCount
        });
        return;
      }

      window.setTimeout(start, 200);
      return;
    }

    var container = ensureContainer();

    if (!container) {
      if (attemptCount >= maxAttempts) {
        logWarn('Unable to create tsParticles container after repeated attempts');
        return;
      }

      window.setTimeout(start, 200);
      return;
    }

    try {
      initializationStarted = true;

      Promise.resolve(window.tsParticles.load('tsparticles', getParticleConfig()))
        .then(function () {
          watchContainer();
          logInfo('tsParticles initialized successfully', { attempts: attemptCount });
        })
        .catch(function (error) {
          initializationStarted = false;
          logError('tsParticles initialization failed asynchronously', error);
        });
    } catch (error) {
      initializationStarted = false;
      logError('tsParticles initialization failed', error);
    }
  }

  start();
})();
