#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const CONFIG = {
  sourceDir: path.join(__dirname, 'site'),
  port: 8080,
  mimeTypes: {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.xsl': 'application/xml; charset=utf-8'
  }
};

const LOG_PREFIX = '[local-serve]';

function parseCliArgs(argv) {
  const options = {
    buildTarget: 'html',
    buildOnly: false,
    baseUrl: '',
    normalizeSource: false,
    siteOrigin: '',
    port: CONFIG.port
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextArgument = argv[index + 1];

    if (argument === '--build-only') {
      options.buildOnly = true;
      continue;
    }

    if (argument === '--normalize-source') {
      options.normalizeSource = true;
      continue;
    }

    if (argument === '--target' && nextArgument) {
      options.buildTarget = nextArgument === 'site' ? 'site' : 'html';
      index += 1;
      continue;
    }

    if (argument === '--base-url' && nextArgument) {
      options.baseUrl = normalizeBaseUrl(nextArgument);
      index += 1;
      continue;
    }

    if (argument === '--site-origin' && nextArgument) {
      options.siteOrigin = normalizeSiteOrigin(nextArgument);
      index += 1;
      continue;
    }

    if (argument === '--port' && nextArgument) {
      const parsedPort = Number.parseInt(nextArgument, 10);

      if (!Number.isNaN(parsedPort) && parsedPort > 0) {
        options.port = parsedPort;
      }

      index += 1;
    }
  }

  return options;
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl || baseUrl === '/') {
    return '';
  }

  const withLeadingSlash = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function normalizeSiteOrigin(siteOrigin) {
  if (!siteOrigin) {
    return '';
  }

  return siteOrigin.replace(/\/+$/, '');
}

function getBuildDir(buildTarget) {
  return path.join(__dirname, '_build', buildTarget === 'site' ? 'site' : 'html');
}

function getEffectiveSiteOrigin(options) {
  if (options.siteOrigin) {
    return options.siteOrigin;
  }

  return `http://localhost:${options.port}${options.baseUrl}`;
}

function logInfo(message, details) {
  if (details) {
    console.log(`${LOG_PREFIX} INFO ${message}`, details);
    return;
  }

  console.log(`${LOG_PREFIX} INFO ${message}`);
}

function logWarn(message, details) {
  if (details) {
    console.warn(`${LOG_PREFIX} WARN ${message}`, details);
    return;
  }

  console.warn(`${LOG_PREFIX} WARN ${message}`);
}

function logError(message, details) {
  if (details) {
    console.error(`${LOG_PREFIX} ERROR ${message}`, details);
    return;
  }

  console.error(`${LOG_PREFIX} ERROR ${message}`);
}

function ensureSourceDir() {
  if (!fs.existsSync(CONFIG.sourceDir) || !fs.statSync(CONFIG.sourceDir).isDirectory()) {
    throw new Error(`Static source directory is missing: ${CONFIG.sourceDir}`);
  }
}

function findFiles(directoryPath) {
  const files = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  walk(directoryPath);
  return files;
}

function sanitizeHtml(html) {
  return html
    .replace(/<meta name="generator" content="mystmd"\/?>/g, '')
    .replace(/<dialog id="myst-no-css"[\s\S]*?<\/dialog>/g, '')
    .replace(/<div class="myst-primary-sidebar-footer[\s\S]*?<\/div>/g, '');
}

const MENU_BUTTON_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-slot="icon" width="1.5rem" height="1.5rem"><path fill-rule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"></path></svg><span class="sr-only">Open Menu</span>';

function stripTags(markup) {
  return markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeSidebarLinks(markup) {
  const items = Array.from(markup.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)).map(([, href], index, matches) => {
    const match = matches[index][0];
    const isCurrentPage = /aria-current="page"/.test(match);
    const className = `site-nav-link${isCurrentPage ? ' is-active' : ''}`;
    const ariaCurrent = isCurrentPage ? ' aria-current="page"' : '';
    const label = href === '/' ? 'Appendix' : stripTags(match);
    return `<li class="site-nav-item"><a class="${className}" href="${href}"${ariaCurrent}>${label}</a></li>`;
  });

  return `<ul class="site-nav-list">${items.join('')}</ul>`;
}

function normalizePaginationLinks(markup) {
  const links = Array.from(markup.matchAll(/<a class="site-pagination-link ([^"]+)" href="([^"]+)">([\s\S]*?)<\/a>/g));

  if (!links.length) {
    return markup;
  }

  return links.map(([, direction, href, content]) => {
    const eyebrowMatch = content.match(/<div class="site-pagination-eyebrow">([\s\S]*?)<\/div>/);
    const eyebrow = stripTags(eyebrowMatch ? eyebrowMatch[1] : '');
    const label = stripTags(content.replace(/<div class="site-pagination-eyebrow">[\s\S]*?<\/div>/, ''));

    return `<a class="site-pagination-link ${direction}" href="${href}"><span class="site-pagination-eyebrow">${eyebrow}</span><span class="site-pagination-label">${label}</span></a>`;
  }).join('');
}

function normalizeStructuralMarkup(html) {
  let updated = html
    .replace(/<div class="page-hero-meta">\s*<div class="flex-grow"><\/div>\s*<\/div>/g, '')
    .replace(/<hr class="py-2 my-5 translate-y-2"\/>/g, '<hr class="section-break"/>');

  updated = updated.replace(
    /<div class="site-header">[\s\S]*?<\/nav><\/div>(?=<(?:div|aside) class="site-sidebar")/g,
    `<header class="site-header"><div class="site-header-bar"><button class="site-menu-button" type="button" aria-label="Open navigation" aria-expanded="false">${MENU_BUTTON_ICON}</button><a class="site-brand" href="/">Phi-ihP</a></div></header>`
  );

  updated = updated.replace(
    /<(?:div|aside) class="site-sidebar"[\s\S]*?<nav aria-label="Table of Contents" class="site-sidebar-nav"><div class="site-sidebar-toc">([\s\S]*?)<\/div><\/nav>[\s\S]*?(?=<main class="site-main">)/g,
    (_, linksMarkup) => `<aside class="site-sidebar"><div class="site-sidebar-shell"><nav aria-label="Primary" class="site-sidebar-nav"><div class="site-sidebar-scroll"><div class="site-sidebar-toc">${normalizeSidebarLinks(linksMarkup)}</div></div></nav></div></aside>`
  );

  updated = updated.replace(
    /<div class="site-pagination">([\s\S]*?)<\/div>(?=<\/article>)/g,
    (_, linksMarkup) => `<nav class="site-pagination" aria-label="Article pagination">${normalizePaginationLinks(linksMarkup)}</nav>`
  );

  return updated;
}

const VOID_HTML_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

function getTagDefinition(markup, startIndex) {
  let quote = '';
  let cursor = startIndex + 1;

  while (cursor < markup.length) {
    const character = markup[cursor];

    if (quote) {
      if (character === quote) {
        quote = '';
      }

      cursor += 1;
      continue;
    }

    if (character === '"' || character === '\'') {
      quote = character;
      cursor += 1;
      continue;
    }

    if (character === '>') {
      return {
        raw: markup.slice(startIndex, cursor + 1),
        endIndex: cursor + 1
      };
    }

    cursor += 1;
  }

  return null;
}

function parseTagDefinition(tagMarkup) {
  const normalized = tagMarkup.slice(1, -1).trim();
  const closing = normalized.startsWith('/');
  const tagNameMatch = normalized.match(/^\/?\s*([a-zA-Z0-9:-]+)/);
  const tagName = tagNameMatch ? tagNameMatch[1].toUpperCase() : '';
  const selfClosing = /\/\s*>$/.test(tagMarkup) || VOID_HTML_ELEMENTS.has(tagName.toLowerCase());

  return {
    tagName,
    closing,
    selfClosing
  };
}

function splitTopLevelNodes(markup) {
  const nodes = [];
  let cursor = 0;

  while (cursor < markup.length) {
    if (/\s/.test(markup[cursor])) {
      cursor += 1;
      continue;
    }

    if (markup.startsWith('<!--', cursor)) {
      const commentEnd = markup.indexOf('-->', cursor + 4);

      if (commentEnd === -1) {
        nodes.push(markup.slice(cursor));
        break;
      }

      nodes.push(markup.slice(cursor, commentEnd + 3));
      cursor = commentEnd + 3;
      continue;
    }

    if (markup[cursor] !== '<') {
      const nextTag = markup.indexOf('<', cursor);
      const endIndex = nextTag === -1 ? markup.length : nextTag;
      const textNode = markup.slice(cursor, endIndex).trim();

      if (textNode) {
        nodes.push(textNode);
      }

      cursor = endIndex;
      continue;
    }

    const openingTag = getTagDefinition(markup, cursor);

    if (!openingTag) {
      nodes.push(markup.slice(cursor));
      break;
    }

    const openingDefinition = parseTagDefinition(openingTag.raw);

    if (openingDefinition.closing || openingDefinition.selfClosing) {
      nodes.push(openingTag.raw);
      cursor = openingTag.endIndex;
      continue;
    }

    const stack = [openingDefinition.tagName];
    let endCursor = openingTag.endIndex;

    while (stack.length && endCursor < markup.length) {
      if (markup.startsWith('<!--', endCursor)) {
        const commentEnd = markup.indexOf('-->', endCursor + 4);
        endCursor = commentEnd === -1 ? markup.length : commentEnd + 3;
        continue;
      }

      const nextTagStart = markup.indexOf('<', endCursor);

      if (nextTagStart === -1) {
        endCursor = markup.length;
        break;
      }

      const nextTag = getTagDefinition(markup, nextTagStart);

      if (!nextTag) {
        endCursor = markup.length;
        break;
      }

      const nextDefinition = parseTagDefinition(nextTag.raw);

      if (!nextDefinition.tagName) {
        endCursor = nextTag.endIndex;
        continue;
      }

      if (!nextDefinition.closing && !nextDefinition.selfClosing) {
        stack.push(nextDefinition.tagName);
      } else if (nextDefinition.closing && stack[stack.length - 1] === nextDefinition.tagName) {
        stack.pop();
      }

      endCursor = nextTag.endIndex;
    }

    nodes.push(markup.slice(cursor, endCursor));
    cursor = endCursor;
  }

  return nodes;
}

function getNodeTagName(markup) {
  const match = markup.match(/^<\s*([a-zA-Z0-9:-]+)/);
  return match ? match[1].toUpperCase() : '';
}

function hasClass(markup, className) {
  const classMatch = markup.match(/\bclass="([^"]*)"/);

  if (!classMatch) {
    return false;
  }

  return classMatch[1].split(/\s+/).includes(className);
}

function addClassesToRoot(markup, classNames, removeClasses = []) {
  if (!markup || !markup.startsWith('<')) {
    return markup;
  }

  return markup.replace(/^<([a-zA-Z0-9:-]+)([^>]*)>/, (match, tagName, attributes) => {
    const classMatch = attributes.match(/\bclass="([^"]*)"/);
    const classes = new Set(classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : []);

    removeClasses.forEach((className) => classes.delete(className));
    classNames.forEach((className) => {
      if (className) {
        classes.add(className);
      }
    });

    const classAttribute = ` class="${Array.from(classes).join(' ')}"`;
    const nextAttributes = classMatch
      ? attributes.replace(/\bclass="([^"]*)"/, classAttribute)
      : `${attributes}${classAttribute}`;

    return `<${tagName}${nextAttributes}>`;
  });
}

function addAttributeToTag(markup, attributeName, attributeValue) {
  if (new RegExp(`\\b${attributeName}=`).test(markup)) {
    return markup;
  }

  if (markup.endsWith('>')) {
    return markup.replace(/^<([a-zA-Z0-9:-]+)([^>]*)>/, `<$1$2 ${attributeName}="${attributeValue}">`);
  }

  return `${markup} ${attributeName}="${attributeValue}"`;
}

function normalizeHeadingMarkup(markup, additionalClass) {
  let updated = markup
    .replace(/class="section-heading"/g, 'class="article-heading"')
    .replace(/class="heading-text"/g, 'class="article-heading-text"')
    .replace(/class="section-heading-text"/g, 'class="article-heading-text"')
    .replace(/class="section-anchor"/g, 'class="article-heading-anchor"');

  updated = addClassesToRoot(updated, ['article-heading', additionalClass], [
    'section-heading',
    'article-section-heading',
    'two-collumn-content',
    'content-group-heading',
    'content-subheading'
  ]);
  return updated;
}

function classifyMarkupNode(markup, className) {
  return addClassesToRoot(markup, [className]);
}

function isTerminalMarkup(markup) {
  return hasClass(markup, 'site-backmatter') || hasClass(markup, 'site-pagination');
}

function isGroupedHeadingMarkup(markup) {
  const tagName = getNodeTagName(markup);
  return tagName === 'H4' || tagName === 'H5' || tagName === 'H6';
}

function getElementInnerMarkup(markup) {
  return markup.replace(/^<[^>]+>/, '').replace(/<\/[a-zA-Z0-9:-]+>\s*$/, '');
}

function renderPanel(panelNodes) {
  if (Array.isArray(panelNodes)) {
    panelNodes = {
      heading: panelNodes[0] || '',
      bodyNodes: panelNodes.slice(1)
    };
  }

  const heading = panelNodes && panelNodes.heading ? panelNodes.heading : '';
  const bodyNodes = panelNodes && panelNodes.bodyNodes ? panelNodes.bodyNodes : [];
  return `<div class="content-group">${heading}<div class="article-content-block">${bodyNodes.join('')}</div></div>`;
}

function normalizeBodyNodes(nodes) {
  const normalizedNodes = [];

  nodes.forEach((node) => {
    if (!node || !node.trim()) {
      return;
    }

    const tagName = getNodeTagName(node);

    if (tagName === 'HR') {
      return;
    }

    if (hasClass(node, 'content-group')) {
      const panel = normalizeContentGroupMarkup(node);
      if (panel.heading) {
        normalizedNodes.push(panel.heading);
      }
      normalizedNodes.push(...panel.bodyNodes);
      return;
    }

    if (hasClass(node, 'article-section-content') || (tagName === 'DIV' && hasClass(node, 'content'))) {
      normalizedNodes.push(...normalizeBodyNodes(splitTopLevelNodes(getElementInnerMarkup(node))));
      return;
    }

    if (tagName === 'DIV' && hasClass(node, 'article-content-block')) {
      normalizedNodes.push(...normalizeBodyNodes(splitTopLevelNodes(getElementInnerMarkup(node))));
      return;
    }

    if (isGroupedHeadingMarkup(node) || hasClass(node, 'content-subheading')) {
      normalizedNodes.push(normalizeHeadingMarkup(node, 'content-subheading'));
      return;
    }

    normalizedNodes.push(addClassesToRoot(node, [], ['article-content-block']));
  });

  return normalizedNodes;
}

function normalizeContentGroupMarkup(markup) {
  const panel = {
    heading: '',
    bodyNodes: []
  };

  splitTopLevelNodes(getElementInnerMarkup(markup)).forEach((node) => {
    if (!node || !node.trim()) {
      return;
    }

    const tagName = getNodeTagName(node);

    if (tagName === 'HR') {
      return;
    }

    if (!panel.heading && (tagName === 'H3' || hasClass(node, 'content-group-heading'))) {
      panel.heading = normalizeHeadingMarkup(node, 'content-group-heading');
      return;
    }

    if (tagName === 'DIV' && hasClass(node, 'article-content-block')) {
      panel.bodyNodes.push(...normalizeBodyNodes(splitTopLevelNodes(getElementInnerMarkup(node))));
      return;
    }

    panel.bodyNodes.push(...normalizeBodyNodes([node]));
  });

  return panel;
}

function normalizeStructuredSectionMarkup(sectionMarkup) {
  const match = sectionMarkup.match(/^(<section\b[^>]*>)([\s\S]*)(<\/section>)$/);

  if (!match) {
    return sectionMarkup;
  }

  const [, openingTag, innerMarkup, closingTag] = match;
  const nodes = splitTopLevelNodes(innerMarkup);
  const introNodes = [];
  const panels = [];
  let heading = '';
  let currentPanel = null;

  function flushPanel() {
    if (!currentPanel || (!currentPanel.heading && !currentPanel.bodyNodes.length)) {
      return;
    }

    panels.push(currentPanel);
    currentPanel = null;
  }

  nodes.forEach((node) => {
    const tagName = getNodeTagName(node);

    if (tagName === 'HR') {
      return;
    }

    if (tagName === 'H2') {
      heading = normalizeHeadingMarkup(node, 'article-section-heading');
      return;
    }

    if (hasClass(node, 'article-section-intro')) {
      introNodes.push(
        ...splitTopLevelNodes(getElementInnerMarkup(node))
          .filter((childNode) => getNodeTagName(childNode) !== 'HR')
          .map((childNode) => classifyMarkupNode(childNode, 'article-section-copy'))
      );
      return;
    }

    if (tagName === 'H3') {
      flushPanel();
      currentPanel = {
        heading: normalizeHeadingMarkup(node, 'content-group-heading'),
        bodyNodes: []
      };
      return;
    }

    if (hasClass(node, 'article-section-content') || (tagName === 'DIV' && hasClass(node, 'content'))) {
      splitTopLevelNodes(getElementInnerMarkup(node)).forEach((contentNode) => {
        const panel = hasClass(contentNode, 'content-group')
          ? normalizeContentGroupMarkup(contentNode)
          : { heading: '', bodyNodes: normalizeBodyNodes([contentNode]) };

        if (!panel.heading && !panel.bodyNodes.length) {
          return;
        }

        if (currentPanel && !panel.heading) {
          currentPanel.bodyNodes.push(...panel.bodyNodes);
          return;
        }

        flushPanel();
        panels.push(panel);
      });
      return;
    }

    if (currentPanel) {
      currentPanel.bodyNodes.push(...normalizeBodyNodes([node]));
      return;
    }

    introNodes.push(classifyMarkupNode(node, 'article-section-copy'));
  });

  flushPanel();

  const normalizedHeading = panels.length
    ? addClassesToRoot(heading, ['two-collumn-content'])
    : addClassesToRoot(heading, [], ['two-collumn-content']);
  const intro = introNodes.length
    ? `<div class="article-section-intro">${introNodes.join('')}</div>`
    : '';
  const content = panels.length
    ? `<div class="content article-section-content">${panels.map(renderPanel).join('')}</div>`
    : '';

  return `${openingTag}${normalizedHeading}${intro}${content}${closingTag}`;
}

function renderSection(section) {
  const intro = section.introNodes.length
    ? `<div class="article-section-intro">${section.introNodes.join('')}</div>`
    : '';
  const heading = section.panels.length
    ? addClassesToRoot(section.heading, ['two-collumn-content'])
    : addClassesToRoot(section.heading, [], ['two-collumn-content']);
  const panels = section.panels.length
    ? `<div class="content article-section-content">${section.panels.map(renderPanel).join('')}</div>`
    : '';
  return `<section class="article-section">${heading}${intro}${panels}</section>`;
}

function normalizeArticleContentMarkup(html) {
  return html.replace(/(<article class="site-article"[^>]*)(>)([\s\S]*?)(<\/article>)/g, (match, openingTag, separator, innerHtml, closingTag) => {
    if (innerHtml.includes('<section class="article-section"')) {
      const rebuiltStructured = splitTopLevelNodes(innerHtml).map((node) => {
        if (getNodeTagName(node) === 'SECTION' && hasClass(node, 'article-section')) {
          return normalizeStructuredSectionMarkup(node);
        }

        return node;
      }).join('');

      return `${addAttributeToTag(openingTag, 'data-section-layout-ready', 'true')}${separator}${rebuiltStructured}${closingTag}`;
    }

    const nodes = splitTopLevelNodes(innerHtml);
    const rebuilt = [];
    const pageIntroNodes = [];
    let introOpen = false;
    let currentSection = null;
    let currentSubsection = null;

    function flushSubsection() {
      if (!currentSection || !currentSubsection) {
        return;
      }

      currentSection.panels.push(currentSubsection);
      currentSubsection = null;
    }

    function flushSection() {
      if (!currentSection) {
        return;
      }

      flushSubsection();
      rebuilt.push(renderSection(currentSection));
      currentSection = null;
    }

    function flushPageIntro() {
      if (!pageIntroNodes.length) {
        return;
      }

      rebuilt.push(`<div class="article-page-intro">${pageIntroNodes.join('')}</div>`);
      pageIntroNodes.length = 0;
      introOpen = false;
    }

    nodes.forEach((node) => {
      const tagName = getNodeTagName(node);

      if (isTerminalMarkup(node)) {
        flushPageIntro();
        flushSection();
        rebuilt.push(node);
        return;
      }

      if (tagName === 'HR') {
        return;
      }

      if (!currentSection) {
        if (tagName === 'H2') {
          flushPageIntro();
          currentSection = {
            heading: normalizeHeadingMarkup(node, 'article-section-heading'),
            introNodes: [],
            panels: []
          };
          return;
        }

        if (hasClass(node, 'page-hero') || /id="skip-to-article"/.test(node)) {
          rebuilt.push(node);

          if (/id="skip-to-article"/.test(node)) {
            introOpen = true;
          }

          return;
        }

        if (introOpen) {
          pageIntroNodes.push(node);
          return;
        }

        rebuilt.push(node);
        return;
      }

      if (tagName === 'H2') {
        flushSection();
        currentSection = {
          heading: normalizeHeadingMarkup(node, 'article-section-heading'),
          introNodes: [],
          panels: []
        };
        return;
      }

      if (tagName === 'H3') {
        flushSubsection();
        currentSubsection = {
          heading: normalizeHeadingMarkup(node, 'content-group-heading'),
          bodyNodes: []
        };
        return;
      }

      if (currentSubsection) {
        if (isGroupedHeadingMarkup(node)) {
          currentSubsection.bodyNodes.push(normalizeHeadingMarkup(node, 'content-subheading'));
          return;
        }

        currentSubsection.bodyNodes.push(...normalizeBodyNodes([node]));
        return;
      }

      currentSection.introNodes.push(classifyMarkupNode(node, 'article-section-copy'));
    });

    flushPageIntro();
    flushSection();

    return `${addAttributeToTag(openingTag, 'data-section-layout-ready', 'true')}${separator}${rebuilt.join('')}${closingTag}`;
  });
}

function normalizeHtmlMarkup(html) {
  return normalizeArticleContentMarkup(normalizeStructuralMarkup(html
    .replace(/<body class="[^"]*">/g, '<body class="site-body">')
    .replace(/class="myst-skip-to-article(?=[\s"])[^"]*"/g, 'class="site-skip-links"')
    .replace(/class="myst-skip-to-link(?=[\s"])[^"]*"/g, 'class="site-skip-link"')
    .replace(/class="myst-top-nav(?=[\s"])[^"]*"/g, 'class="site-header"')
    .replace(/class="myst-top-nav-bar(?=[\s"])[^"]*"/g, 'class="site-header-bar"')
    .replace(/class="myst-top-nav-menu-button(?=[\s"])[^"]*"/g, 'class="site-menu-button"')
    .replace(/class="myst-home-link(?=[\s"])[^"]*"/g, 'class="site-brand"')
    .replace(/class="myst-search-bar[^"]*"/g, 'class="site-search"')
    .replace(/class="myst-search-text-placeholder[^"]*"/g, 'class="site-search-placeholder"')
    .replace(/class="myst-theme-button[^"]*"/g, 'class="site-theme-toggle"')
    .replace(/class="myst-theme-moon-icon[^"]*"/g, 'class="site-theme-moon"')
    .replace(/class="myst-theme-sun-icon[^"]*"/g, 'class="site-theme-sun"')
    .replace(/class="myst-primary-sidebar-pointer(?=[\s"])[^"]*"/g, 'class="site-sidebar-shell"')
    .replace(/class="myst-primary-sidebar-nav(?=[\s"])[^"]*"/g, 'class="site-sidebar-scroll"')
    .replace(/class="myst-primary-sidebar(?=[\s"])[^"]*"/g, 'class="site-sidebar"')
    .replace(/<nav aria-label="Navigation" class="myst-primary-sidebar-topnav[^"]*"><div class="w-full px-1 dark:text-white font-medium"><\/div><\/nav><div class="my-3 border-b-2 lg:hidden"><\/div>/g, '')
    .replace(/class="myst-primary-sidebar-toc(?=[\s"])[^"]*"/g, 'class="site-sidebar-nav"')
    .replace(/class="myst-toc(?=[\s"])[^"]*"/g, 'class="site-sidebar-toc"')
    .replace(/class="article-grid grid-gap"/g, 'class="site-main"')
    .replace(/class="article-grid subgrid-gap col-screen article content"/g, 'class="site-article"')
    .replace(/<div class="hidden"><\/div>/g, '')
    .replace(/<div id="skip-to-frontmatter"([^>]*) class="myst-fm-block[^"]*">/g, '<div id="skip-to-frontmatter"$1 class="page-hero">')
    .replace(/<div class="myst-fm-block-header[^"]*">/g, '<div class="page-hero-meta">')
    .replace(/<div class="myst-fm-block-badges"><\/div>/g, '')
    .replace(/<div class="myst-fm-downloads-dropdown[\s\S]*?<\/div>/g, '')
    .replace(/<h1 class="myst-fm-block-title[^"]*">/g, '<h1 class="page-title">')
    .replace(/<p class="myst-fm-block-subtitle[^"]*">/g, '<p class="page-subtitle">')
    .replace(/class="relative group"/g, 'class="article-heading"')
    .replace(/class="section-heading"/g, 'class="article-heading"')
    .replace(/class="heading-text"/g, 'class="article-heading-text"')
    .replace(/class="section-heading-text"/g, 'class="article-heading-text"')
    .replace(/class="no-underline text-inherit hover:text-inherit inline-block w-0 px-0 translate-x-\[10px\] font-normal select-none transition-opacity opacity-0 focus:opacity-100 group-hover:opacity-70"/g, 'class="article-heading-anchor"')
    .replace(/class="section-anchor"/g, 'class="article-heading-anchor"')
    .replace(/<div class="myst-backmatter-parts"><\/div>/g, '<div class="site-backmatter"></div>')
    .replace(/<div class="myst-footer-links[^"]*">/g, '<div class="site-pagination">')
    .replace(/class="myst-footer-link[^"]*myst-footer-link-prev"/g, 'class="site-pagination-link site-pagination-link-prev"')
    .replace(/class="myst-footer-link[^"]*myst-footer-link-next"/g, 'class="site-pagination-link site-pagination-link-next"')
    .replace(/<div class="myst-footer-link-group[^"]*">/g, '<div class="site-pagination-eyebrow">')
    .replace(/<div class="site-sidebar"><div class="site-sidebar"><div class="site-sidebar">/g, '<div class="site-sidebar"><div class="site-sidebar-shell"><div class="site-sidebar-scroll">')
    .replace(/<div class="site-sidebar"><div class="site-sidebar">/g, '<div class="site-sidebar"><div class="site-sidebar-shell">')
    .replace(/(<a class="site-nav-link(?: is-active)?" href="\/"(?: aria-current="page")?>)Phi-ihP(<\/a>)/g, '$1Appendix$2')));
}

function rewriteRootRelativeAttributes(text, baseUrl) {
  if (!baseUrl) {
    return text;
  }

  return text.replace(/\b(href|src|action|poster|content)=(["'])\/(?!\/)/g, `$1=$2${baseUrl}/`);
}

function rewriteSiteOrigin(text, siteOrigin) {
  return text.replace(/http:\/\/localhost:3000/g, siteOrigin);
}

function transformFile(filePath, options) {
  const extension = path.extname(filePath).toLowerCase();
  const relativePath = path.relative(getBuildDir(options.buildTarget), filePath);
  const siteOrigin = getEffectiveSiteOrigin(options);

  if (!['.html', '.xml', '.txt'].includes(extension)) {
    return false;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;

  if (extension === '.html') {
    updated = sanitizeHtml(updated);
    updated = normalizeHtmlMarkup(updated);
    updated = rewriteRootRelativeAttributes(updated, options.baseUrl);
  }

  if (extension === '.xml' || extension === '.txt') {
    updated = rewriteSiteOrigin(updated, siteOrigin);
  }

  if (updated === original) {
    return false;
  }

  fs.writeFileSync(filePath, updated, 'utf8');
  logInfo(`Updated ${relativePath}`);
  return true;
}

function normalizeSourceHtml() {
  let transformedCount = 0;

  for (const filePath of findFiles(CONFIG.sourceDir)) {
    if (path.extname(filePath).toLowerCase() !== '.html') {
      continue;
    }

    const original = fs.readFileSync(filePath, 'utf8');
    const updated = normalizeHtmlMarkup(sanitizeHtml(original));

    if (updated === original) {
      continue;
    }

    fs.writeFileSync(filePath, updated, 'utf8');
    transformedCount += 1;
    logInfo(`Normalized source ${path.relative(CONFIG.sourceDir, filePath)}`);
  }

  if (transformedCount > 0) {
    logInfo('Source HTML normalization completed', {
      sourceDirectory: path.relative(__dirname, CONFIG.sourceDir),
      transformedFiles: transformedCount
    });
  }
}

function copySite(options) {
  const buildDir = getBuildDir(options.buildTarget);

  ensureSourceDir();
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(buildDir), { recursive: true });
  fs.cpSync(CONFIG.sourceDir, buildDir, { recursive: true });

  let transformedCount = 0;

  for (const filePath of findFiles(buildDir)) {
    if (transformFile(filePath, options)) {
      transformedCount += 1;
    }
  }

  writeNoJekyllFile(buildDir);
  logInfo('Static site build completed', {
    sourceDirectory: path.relative(__dirname, CONFIG.sourceDir),
    outputDirectory: path.relative(__dirname, buildDir),
    baseUrl: options.baseUrl || '/',
    siteOrigin: getEffectiveSiteOrigin(options),
    transformedFiles: transformedCount
  });

  return buildDir;
}

function writeNoJekyllFile(buildDir) {
  const noJekyllPath = path.join(buildDir, '.nojekyll');
  fs.writeFileSync(noJekyllPath, '', 'utf8');
}

function resolveRequestPath(requestUrl, baseUrl) {
  const rawPath = (requestUrl || '/').split('?')[0];
  const decodedPath = decodeURIComponent(rawPath || '/');
  let normalizedPath = path.posix.normalize(decodedPath || '/');

  if (normalizedPath.includes('..')) {
    throw new Error(`Rejected suspicious path traversal attempt: ${decodedPath}`);
  }

  if (baseUrl && (normalizedPath === baseUrl || normalizedPath.startsWith(`${baseUrl}/`))) {
    normalizedPath = normalizedPath.slice(baseUrl.length) || '/';
  }

  if (normalizedPath.endsWith('/')) {
    normalizedPath += 'index.html';
  }

  if (!path.posix.extname(normalizedPath)) {
    normalizedPath += '/index.html';
  }

  return normalizedPath.replace(/^\//, '');
}

function streamFile(filePath, response) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = CONFIG.mimeTypes[extension] || 'application/octet-stream';
  const fileStream = fs.createReadStream(filePath);

  response.writeHead(200, { 'Content-Type': contentType });

  fileStream.on('error', (error) => {
    logError(`Stream failed for ${filePath}`, error && error.message ? error.message : error);

    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    response.end('500 Internal Server Error');
  });

  fileStream.pipe(response);
}

function startServer(buildDir, port, baseUrl) {
  const server = http.createServer((request, response) => {
    try {
      const requestedPath = resolveRequestPath(request.url, baseUrl);
      const primaryPath = path.join(buildDir, requestedPath);
      const fallbackPath = path.join(buildDir, requestedPath.replace(/\/index\.html$/i, '.html'));

      if (fs.existsSync(primaryPath) && fs.statSync(primaryPath).isFile()) {
        streamFile(primaryPath, response);
        return;
      }

      if (fallbackPath !== primaryPath && fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
        streamFile(fallbackPath, response);
        return;
      }

      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('404 Not Found');
    } catch (error) {
      logError('Request handling failed', error && error.message ? error.message : error);
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('500 Internal Server Error');
    }
  });

  server.on('error', (error) => {
    logError('HTTP server error', error && error.message ? error.message : error);
    process.exit(1);
  });

  server.listen(port, () => {
    logInfo(`Serving static site at http://localhost:${port}${baseUrl || '/'}`);
  });
}

function main() {
  const options = parseCliArgs(process.argv.slice(2));

  try {
    if (options.normalizeSource) {
      normalizeSourceHtml();
    }

    const buildDir = copySite(options);

    if (options.buildOnly) {
      return;
    }

    startServer(buildDir, options.port, options.baseUrl);
  } catch (error) {
    logError('Startup failed', error && error.message ? error.message : error);
    process.exit(1);
  }
}

main();
