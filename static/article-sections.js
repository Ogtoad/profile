(function () {
  'use strict';

  function shouldSkipArticle(article) {
    return !article
      || article.dataset.sectionLayoutReady === 'true'
      || article.querySelector('.appendix-directory');
  }

  function isTerminalNode(node) {
    return node.classList
      && (
        node.classList.contains('myst-backmatter-parts')
        || node.classList.contains('myst-footer-links')
      );
  }

  function buildSectionBlock(heading) {
    var section = document.createElement('section');
    section.className = 'article-section-block';

    var body = document.createElement('div');
    body.className = 'article-section-body';

    heading.classList.add('article-section-heading');
    section.appendChild(heading);
    section.appendChild(body);

    return { section: section, body: body };
  }

  function buildSubsectionPanel(heading) {
    var panel = document.createElement('div');
    panel.className = 'article-subsection-panel';
    panel.appendChild(heading);
    return panel;
  }

  function enhanceArticleSections() {
    var article = document.querySelector('article.article.content');

    if (shouldSkipArticle(article)) {
      return;
    }

    var children = Array.prototype.slice.call(article.children);
    var currentSection = null;
    var currentSubsection = null;

    children.forEach(function (node) {
      var tagName = node.tagName ? node.tagName.toUpperCase() : '';

      if (isTerminalNode(node)) {
        currentSection = null;
        currentSubsection = null;
        return;
      }

      if (tagName === 'H2') {
        currentSection = buildSectionBlock(node);
        currentSubsection = null;
        article.insertBefore(currentSection.section, node);
        return;
      }

      if (!currentSection) {
        return;
      }

      if (tagName === 'HR') {
        node.remove();
        return;
      }

      if (tagName === 'H3' || tagName === 'H4') {
        currentSubsection = buildSubsectionPanel(node);
        currentSection.body.appendChild(currentSubsection);
        return;
      }

      if (currentSubsection) {
        currentSubsection.appendChild(node);
        return;
      }

      currentSection.body.appendChild(node);
    });

    article.dataset.sectionLayoutReady = 'true';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceArticleSections, { once: true });
  } else {
    enhanceArticleSections();
  }
})();
