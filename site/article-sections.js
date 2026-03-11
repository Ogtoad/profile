(function () {
  'use strict';

  function shouldSkipArticle(article) {
    return !article
      || article.dataset.sectionLayoutReady === 'true'
      || article.querySelector('.article-section')
      || article.querySelector('.appendix-directory');
  }

  function isTerminalNode(node) {
    return node.classList
      && (
        node.classList.contains('site-backmatter')
        || node.classList.contains('site-pagination')
      );
  }

  function buildSectionBlock(heading) {
    var section = document.createElement('section');
    section.className = 'article-section';

    normalizeHeading(heading, 'article-section-heading');
    heading.classList.add('two-collumn-content');
    section.appendChild(heading);

    return { section: section, heading: heading, intro: null, content: null };
  }

  function ensureSectionIntro(sectionBlock) {
    if (sectionBlock.intro) {
      return sectionBlock.intro;
    }

    var intro = document.createElement('div');
    intro.className = 'article-section-intro';
    sectionBlock.section.appendChild(intro);
    sectionBlock.intro = intro;
    return intro;
  }

  function ensureSectionContent(sectionBlock) {
    if (sectionBlock.content) {
      return sectionBlock.content;
    }

    var content = document.createElement('div');
    content.className = 'content article-section-content';
    sectionBlock.section.appendChild(content);
    sectionBlock.content = content;
    return content;
  }

  function buildContentGroup(container, heading) {
    var group = document.createElement('div');
    group.className = 'content-group';
    var contentBlock = document.createElement('div');
    contentBlock.className = 'article-content-block';

    if (heading) {
      normalizeHeading(heading, 'content-group-heading');
      group.appendChild(heading);
    }

    group.appendChild(contentBlock);
    container.appendChild(group);
    return { group: group, contentBlock: contentBlock };
  }

  function isContentGroupHeading(tagName) {
    return tagName === 'H3' || tagName === 'H4';
  }

  function isGroupedHeading(tagName) {
    return tagName === 'H5' || tagName === 'H6';
  }

  function normalizeHeading(heading, additionalClass) {
    var textNodes = heading.querySelectorAll('.section-heading-text, .article-heading-text');
    var anchorNodes = heading.querySelectorAll('.section-anchor, .article-heading-anchor');

    heading.classList.remove('section-heading');
    heading.classList.remove('article-section-heading');
    heading.classList.remove('two-collumn-content');
    heading.classList.remove('content-group-heading');
    heading.classList.remove('content-subheading');
    heading.classList.add('article-heading');

    if (additionalClass) {
      heading.classList.add(additionalClass);
    }

    Array.prototype.forEach.call(textNodes, function (node) {
      node.classList.remove('section-heading-text');
      node.classList.add('article-heading-text');
    });

    Array.prototype.forEach.call(anchorNodes, function (node) {
      node.classList.remove('section-anchor');
      node.classList.add('article-heading-anchor');
    });
  }

  function classifyNode(node, className) {
    if (!node || !node.classList || !className) {
      return;
    }

    node.classList.add(className);
  }

  function buildPageIntro(article) {
    var marker = article.querySelector('#skip-to-article');

    if (!marker || article.querySelector('.article-page-intro')) {
      return;
    }

    var intro = document.createElement('div');
    intro.className = 'article-page-intro';

    var current = marker.nextElementSibling;
    var hasIntroContent = false;

    while (current) {
      var tagName = current.tagName ? current.tagName.toUpperCase() : '';

      if (tagName === 'H2' || isTerminalNode(current)) {
        break;
      }

      var next = current.nextElementSibling;
      intro.appendChild(current);
      hasIntroContent = true;
      current = next;
    }

    if (hasIntroContent) {
      article.insertBefore(intro, marker.nextSibling);
    }
  }

  function enhanceArticleSections() {
    var article = document.querySelector('.site-article');

    if (shouldSkipArticle(article)) {
      return;
    }

    buildPageIntro(article);

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

      if (isContentGroupHeading(tagName)) {
        currentSubsection = buildContentGroup(ensureSectionContent(currentSection), node);
        return;
      }

      if (currentSubsection) {
        if (isGroupedHeading(tagName)) {
          normalizeHeading(node, 'content-subheading');
          currentSubsection.contentBlock.appendChild(node);
          return;
        }

        currentSubsection.contentBlock.appendChild(node);
        return;
      }

      classifyNode(node, 'article-section-copy');
      ensureSectionIntro(currentSection).appendChild(node);
    });

    article.dataset.sectionLayoutReady = 'true';
  }

  window.ProphileArticleSections = enhanceArticleSections;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceArticleSections, { once: true });
  } else {
    enhanceArticleSections();
  }
})();
