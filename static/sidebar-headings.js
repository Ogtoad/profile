(function () {
  'use strict';

  var chapterMap = {
    'Datorseende och Generativ Syntes': [
      { title: 'Visuell informationsutvinning', anchor: 'visuell-informationsutvinning' },
      { title: 'Akustisk analys', anchor: 'akustisk-analys' },
      { title: 'Generativ syntes', anchor: 'generativ-syntes' }
    ],
    'Automation': [
      { title: 'Deterministisk och probabilistisk automation', anchor: 'fran-deterministisk-till-probabilistisk' },
      { title: 'Reducering av redundans', anchor: 'reducering-av-redundans' },
      { title: 'Dokumentgranskning', anchor: 'dokumentgranskning-och-avvikelsehantering' },
      { title: 'Kvalitetssäkring', anchor: 'kvalitetssakring-och-systemresiliens' },
      { title: 'Sammanfattning', anchor: 'sammanfattning' }
    ],
    'Ai. pipelines och grafer': [
      { title: 'Pipelines', anchor: 'harness-engineering-och-pipelines' },
      { title: 'Genomförbarhet', anchor: 'kritisk-granskning-av-genomforbarhet' },
      { title: 'Typsäkerhet och minne', anchor: 'typsakerhet-multimodell-minne' },
      { title: 'MCP och ACP', anchor: 'mcp-och-acp' },
      { title: 'RAG och LoRA', anchor: 'rag-vektordatabaser-och-lora' },
      { title: 'KV-cachen', anchor: 'kv-cachen-och-uppmarksamhetsmekanismen' }
    ],
    'Om mig': [
      { title: 'Kompetensprofil', href: './kompetensprofil' }
    ]
  };

  function appendixCode(index) {
    return String.fromCharCode(65 + index);
  }

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

  function buildChapterList(baseHref, chapters, sectionCode) {
    if (!chapters || !chapters.length) {
      return null;
    }

    var list = document.createElement('ol');
    list.className = 'appendix-page-entries';

    chapters.forEach(function (chapter, chapterIndex) {
      var item = document.createElement('li');
      item.className = 'appendix-page-entry';

      var code = document.createElement('span');
      code.className = 'appendix-page-entry__code';
      code.textContent = sectionCode + '.' + (chapterIndex + 1);

      var link = document.createElement('a');
      link.className = 'appendix-page-entry__link';
      link.textContent = chapter.title;
      link.href = chapter.href
        ? new URL(chapter.href, baseHref.replace(/#.*$/, '')).href
        : baseHref.replace(/#.*$/, '') + '#' + chapter.anchor;

      if (chapter.anchor && window.location.hash === '#' + chapter.anchor) {
        link.classList.add('is-active');
      }

      if (chapter.href && isCurrentPath(chapter.href)) {
        link.classList.add('is-active');
      }

      item.appendChild(code);
      item.appendChild(link);
      list.appendChild(item);
    });

    return list;
  }

  function buildIndex() {
    var sidebarNav = document.querySelector('.myst-primary-sidebar-nav');
    var toc = sidebarNav ? sidebarNav.querySelector('.myst-toc') : null;

    if (!sidebarNav || !toc) {
      return;
    }

    var pageLinks = Array.prototype.slice.call(toc.querySelectorAll('a[href]')).filter(function (link) {
      return !link.getAttribute('href').includes('#');
    }).filter(function (link) {
      return link.textContent.trim() !== 'Kompetensprofil';
    });

    if (!pageLinks.length) {
      return;
    }

    var seen = {};
    var runtimeNav = document.createElement('div');
    runtimeNav.className = 'sidebar-runtime-nav';
    var aboutHref = '';

    pageLinks.forEach(function (link, pageIndex) {
      var href = link.href;
      var title = link.textContent.trim();
      var key = normalizePath(href);
      var pageCode = appendixCode(pageIndex);

      if (!title || seen[key]) {
        return;
      }

      seen[key] = true;

      if (title === 'Appendix') {
        aboutHref = href;
      }

      var section = document.createElement('section');
      section.className = 'appendix-entry';

      var heading = document.createElement('div');
      heading.className = 'appendix-entry__heading';

      var code = document.createElement('div');
      code.className = 'appendix-entry__code';
      code.textContent = pageCode;

      var pageLink = document.createElement('a');
      pageLink.className = 'appendix-entry__link';
      pageLink.href = href;
      pageLink.textContent = title;

      if (isCurrentPath(href)) {
        section.classList.add('is-current');
        pageLink.classList.add('active');
        pageLink.setAttribute('aria-current', 'page');
      }

      heading.appendChild(code);
      heading.appendChild(pageLink);
      section.appendChild(heading);

      var chapterList = buildChapterList(href, chapterMap[title], pageCode);
      if (chapterList) {
        section.appendChild(chapterList);
      }

      runtimeNav.appendChild(section);
    });

    var header = document.createElement('div');
    header.className = 'appendix-contact';

    var footerTitle = document.createElement('div');
    footerTitle.className = 'appendix-contact__eyebrow';
    footerTitle.textContent = 'Appendix';
    header.appendChild(footerTitle);

    var footerText = document.createElement('p');
    footerText.className = 'appendix-contact__text';
    footerText.textContent = 'Snabbnavigering mellan sidor och kapitel.';
    header.appendChild(footerText);

    if (aboutHref) {
      var footerLink = document.createElement('a');
      footerLink.className = 'appendix-contact__link';
      footerLink.href = aboutHref;
      footerLink.textContent = 'Till Appendix';
      header.appendChild(footerLink);
    }

    toc.innerHTML = '';
    toc.appendChild(header);
    toc.appendChild(runtimeNav);
  }

  function setupMobileSidebar() {
    var menuButton = document.querySelector('.myst-top-nav-menu-button');
    var sidebar = document.querySelector('.myst-primary-sidebar');

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
      menuButton.setAttribute('aria-expanded', 'false');
    }

    function toggleSidebar() {
      var isOpen = document.body.classList.toggle('sidebar-open');
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
