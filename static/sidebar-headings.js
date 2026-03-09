(function () {
  'use strict';

  var chapterMap = {
    'Datorseende och Generativ Syntes': [
      { title: 'Visuell informationsutvinning', anchor: 'visuell-informationsutvinning' },
      { title: 'Akustisk analys', anchor: 'akustisk-analys' },
      { title: 'Generativ syntes', anchor: 'generativ-syntes' }
    ],
    'Kognitiv Automatisering': [
      { title: 'Deterministisk och probabilistisk automation', anchor: 'fran-deterministisk-till-probabilistisk' },
      { title: 'Reducering av redundans', anchor: 'reducering-av-redundans' },
      { title: 'Dokumentgranskning', anchor: 'dokumentgranskning-och-avvikelsehantering' },
      { title: 'Kvalitetssäkring', anchor: 'kvalitetssakring-och-systemresiliens' },
      { title: 'Sammanfattning', anchor: 'sammanfattning' }
    ],
    'Harness Engineering': [
      { title: 'Pipelines', anchor: 'harness-engineering-och-pipelines' },
      { title: 'Genomförbarhet', anchor: 'kritisk-granskning-av-genomforbarhet' },
      { title: 'Typsäkerhet och minne', anchor: 'typsakerhet-multimodell-minne' },
      { title: 'MCP och ACP', anchor: 'mcp-och-acp' },
      { title: 'RAG och LoRA', anchor: 'rag-vektordatabaser-och-lora' },
      { title: 'KV-cachen', anchor: 'kv-cachen-och-uppmarksamhetsmekanismen' }
    ]
  };

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

  function buildChapterList(baseHref, chapters) {
    if (!chapters || !chapters.length) {
      return null;
    }

    var list = document.createElement('ul');
    list.className = 'sidebar-page-headings';

    chapters.forEach(function (chapter) {
      var item = document.createElement('li');
      item.className = 'sidebar-page-headings__item';

      var link = document.createElement('a');
      link.className = 'sidebar-page-headings__link is-h3';
      link.textContent = chapter.title;
      link.href = baseHref.replace(/#.*$/, '') + '#' + chapter.anchor;

      if (window.location.hash === '#' + chapter.anchor) {
        link.classList.add('is-active');
      }

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
    });

    if (!pageLinks.length) {
      return;
    }

    var seen = {};
    var runtimeNav = document.createElement('div');
    runtimeNav.className = 'sidebar-runtime-nav';
    var aboutHref = '';

    pageLinks.forEach(function (link) {
      var href = link.href;
      var title = link.textContent.trim();
      var key = normalizePath(href);

      if (!title || seen[key]) {
        return;
      }

      seen[key] = true;

      if (title === 'Om mig') {
        aboutHref = href;
      }

      var section = document.createElement('div');
      section.className = 'sidebar-runtime-section';

      var pageLink = document.createElement('a');
      pageLink.className = 'sidebar-page-link';
      pageLink.href = href;
      pageLink.textContent = title;

      if (isCurrentPath(href)) {
        pageLink.classList.add('active');
        pageLink.setAttribute('aria-current', 'page');
      }

      section.appendChild(pageLink);

      var chapterList = buildChapterList(href, chapterMap[title]);
      if (chapterList) {
        section.appendChild(chapterList);
      }

      runtimeNav.appendChild(section);
    });

    var footer = document.createElement('div');
    footer.className = 'sidebar-runtime-contact';

    var footerTitle = document.createElement('div');
    footerTitle.className = 'sidebar-runtime-contact__title';
    footerTitle.textContent = 'Kontakt';
    footer.appendChild(footerTitle);

    var footerText = document.createElement('p');
    footerText.className = 'sidebar-runtime-contact__text';
    footerText.textContent = 'Tillgänglig för konsultuppdrag inom tillämpad AI.';
    footer.appendChild(footerText);

    if (aboutHref) {
      var footerLink = document.createElement('a');
      footerLink.className = 'sidebar-runtime-contact__link';
      footerLink.href = aboutHref;
      footerLink.textContent = 'Mer i Om mig';
      footer.appendChild(footerLink);
    }

    runtimeNav.appendChild(footer);

    toc.innerHTML = '';
    toc.appendChild(runtimeNav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildIndex, { once: true });
  } else {
    buildIndex();
  }
})();
