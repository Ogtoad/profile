(function () {
  'use strict';

  var chapterMap = window.PROPHILE_CHAPTER_MAP || {};

  function normalizePath(href) {
    try {
      var url = new URL(href, window.location.href);
      var path = url.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
      return path || '/';
    } catch (error) {
      return href;
    }
  }

  function isCurrentPath(path) {
    return normalizePath(window.location.href) === normalizePath(path);
  }

  function getPageSlug(path) {
    var normalizedPath = normalizePath(path);
    return normalizedPath === '/' ? 'index' : normalizedPath.replace(/^\//, '');
  }

  function buildChapterList(baseHref, chapters) {
    if (!chapters || !chapters.length) {
      return null;
    }

    var samePage = isCurrentPath(baseHref);

    var list = document.createElement('ol');
    list.className = 'appendix-page-entries';

    chapters.forEach(function (chapter, chapterIndex) {
      var item = document.createElement('li');
      item.className = 'appendix-page-entry';

      var link = document.createElement('a');
      link.className = 'appendix-page-entry__link';
      link.textContent = chapter.title;
      link.href = samePage ? ('#' + chapter.anchor) : (baseHref.replace(/#.*$/, '') + '#' + chapter.anchor);

      if (samePage) {
        link.setAttribute('hx-boost', 'false');
      }

      if (window.location.hash === '#' + chapter.anchor && isCurrentPath(baseHref)) {
        link.classList.add('is-active');
      }

      item.appendChild(link);
      list.appendChild(item);
    });

    return list;
  }

  function buildIndex() {
    var sidebarNav = document.querySelector('.site-sidebar-nav');
    var toc = sidebarNav ? sidebarNav.querySelector('.site-sidebar-toc') : null;

    if (!sidebarNav || !toc) {
      return;
    }

    var pageLinks = Array.prototype.slice.call(toc.querySelectorAll('a[href]')).filter(function (link) {
      return !link.getAttribute('href').includes('#');
    });

    if (!pageLinks.length) {
      return;
    }

    var seen = {};
    var runtimeNav = document.createElement('ul');
    runtimeNav.className = 'sidebar-runtime-nav';

    pageLinks.forEach(function (link) {
      var href = link.href;
      var title = normalizePath(href) === '/' ? 'Appendix' : link.textContent.trim();
      var key = normalizePath(href);

      if (!title || seen[key]) {
        return;
      }

      seen[key] = true;

      var section = document.createElement('li');
      section.className = 'appendix-entry';

      var heading = document.createElement('div');
      heading.className = 'appendix-entry__heading';

      var pageLink = document.createElement('a');
      pageLink.className = 'appendix-entry__link';
      pageLink.href = href;
      pageLink.textContent = title;

      if (isCurrentPath(href)) {
        section.classList.add('is-current');
        pageLink.classList.add('active');
        pageLink.setAttribute('aria-current', 'page');
      }

      heading.appendChild(pageLink);
      section.appendChild(heading);

      var chapterList = buildChapterList(href, chapterMap[getPageSlug(href)]);
      if (chapterList) {
        chapterList.hidden = !isCurrentPath(href);
        section.appendChild(chapterList);
      }

      runtimeNav.appendChild(section);
    });

    var header = document.createElement('div');
    header.className = 'appendix-contact sidebar-runtime-contact';

    var footerTitle = document.createElement('div');
    footerTitle.className = 'appendix-contact__eyebrow';
    footerTitle.textContent = 'Navigering';
    header.appendChild(footerTitle);

    var footerText = document.createElement('p');
    footerText.className = 'appendix-contact__text';
    footerText.textContent = 'Sidstruktur och sektionsreferenser.';
    header.appendChild(footerText);

    toc.innerHTML = '';
    toc.appendChild(header);
    toc.appendChild(runtimeNav);
  }

  function setupMobileSidebar() {
    var menuButton = document.querySelector('.site-menu-button');
    var sidebar = document.querySelector('.site-sidebar');

    if (!menuButton || !sidebar) {
      return;
    }

    var backdrop = document.querySelector('.mobile-sidebar-backdrop');

    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.className = 'mobile-sidebar-backdrop';
      backdrop.type = 'button';
      backdrop.setAttribute('aria-label', 'Close navigation');
      document.body.appendChild(backdrop);
    }

    function closeSidebar() {
      document.body.classList.remove('sidebar-open');
      document.body.classList.remove('sidebar-open-lock');
      menuButton.setAttribute('aria-expanded', 'false');
    }

    function toggleSidebar() {
      var isOpen = document.body.classList.toggle('sidebar-open');
      document.body.classList.toggle('sidebar-open-lock', isOpen);
      menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.addEventListener('click', function (event) {
      event.preventDefault();
      toggleSidebar();
    });

    backdrop.addEventListener('click', closeSidebar);

    sidebar.addEventListener('click', function (event) {
      var target = event.target;
      if (target && target.closest('a[href]') && window.innerWidth <= 1024) {
        closeSidebar();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024) {
        closeSidebar();
      }
    });
  }

  window.ProphileSidebar = {
    refresh: buildIndex
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      buildIndex();
      setupMobileSidebar();
    }, { once: true });
  } else {
    buildIndex();
    setupMobileSidebar();
  }
})();
