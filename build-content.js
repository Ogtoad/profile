#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SITE_BRAND = 'Phi-ihP';
const SITE_DESCRIPTION = 'AI-konsult med fokus på tillämpad matematik, systemarkitektur och konkret värdeskapande.';
const LOCAL_SITE_ORIGIN = 'http://localhost:3000';
const ROOT_DIR = __dirname;
const CONTENT_DIR = path.join(ROOT_DIR, 'content');
const SITE_DIR = path.join(ROOT_DIR, 'site');
const MANIFEST_PATH = path.join(ROOT_DIR, '.generated-content-manifest.json');
const SITE_DATA_PATH = path.join(SITE_DIR, 'site-data.js');
const SITEMAP_PATH = path.join(SITE_DIR, 'sitemap.xml');
const ROBOTS_PATH = path.join(SITE_DIR, 'robots.txt');
const INDEX_HTML_PATH = path.join(SITE_DIR, 'index.html');

const MENU_BUTTON_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-slot="icon" width="1.5rem" height="1.5rem"><path fill-rule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"></path></svg><span class="sr-only">Open Menu</span>';
const RUNTIME_LOADER = `<script>
(function bootstrapProphileRuntimeLoader() {
  "use strict";
  try {
    var themeLink = document.querySelector('link[href$="theme.css"], link[href*="/theme.css"]');
    var href = themeLink ? themeLink.getAttribute("href") : "";
    var match = href ? href.match(/^(.*)\\/theme\\.css(?:\\?.*)?$/) : null;
    var basePath = match && match[1] && match[1] !== "/" ? match[1].replace(/\\/+$/, "") : "";
    var runtimeUrl = (basePath ? basePath : "") + "/site-runtime.js";
    if (document.querySelector('script[src="' + runtimeUrl + '"]')) {
      return;
    }
    var runtimeScript = document.createElement("script");
    runtimeScript.src = runtimeUrl;
    runtimeScript.defer = true;
    runtimeScript.dataset.prophileRuntime = "true";
    document.body.appendChild(runtimeScript);
  } catch (error) {
    console.error("[site-runtime] ERROR Failed to inject runtime loader", error);
  }
})();
</script>`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function normalizeMarkdown(text) {
  return text.replace(/\r\n?/g, '\n');
}

function stripInlineMarkdown(text) {
  return String(text)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function normalizeComparableText(text) {
  return stripInlineMarkdown(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function slugify(text) {
  const normalized = stripInlineMarkdown(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'section';
}

function renderInline(text) {
  let rendered = escapeHtml(text);

  rendered = rendered.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    return `<a href="${escapeAttribute(href)}">${renderInline(label)}</a>`;
  });
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, (_, content) => `<strong>${content}</strong>`);
  rendered = rendered.replace(/\*([^*]+)\*/g, (_, content) => `<em>${content}</em>`);

  return rendered;
}

function parseFrontmatter(source) {
  const normalized = normalizeMarkdown(source);

  if (!normalized.startsWith('---\n')) {
    return { metadata: {}, body: normalized };
  }

  const closingIndex = normalized.indexOf('\n---\n', 4);

  if (closingIndex === -1) {
    return { metadata: {}, body: normalized };
  }

  const rawMetadata = normalized.slice(4, closingIndex).split('\n');
  const body = normalized.slice(closingIndex + 5);
  const metadata = {};

  rawMetadata.forEach((line) => {
    const separatorIndex = line.indexOf(':');

    if (separatorIndex === -1) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!key) {
      return;
    }

    metadata[key] = value;
  });

  return { metadata, body };
}

function isAnchorLine(line) {
  return /^\([^)]+\)=\s*$/.test(line.trim());
}

function isDirectiveStart(line) {
  return /^:::\{div\}\s*$/.test(line.trim());
}

function isThematicBreak(line) {
  return /^(-{3,}|_{3,})\s*$/.test(line.trim());
}

function isHeadingLine(line) {
  return /^(#{1,6})\s+.+$/.test(line.trim());
}

function isListItemLine(line) {
  return /^\s*-\s+/.test(line);
}

function isBlockBoundary(line) {
  return !line.trim()
    || isAnchorLine(line)
    || isDirectiveStart(line)
    || line.trim() === ':::'
    || isThematicBreak(line)
    || isHeadingLine(line)
    || isListItemLine(line);
}

function parseList(lines, startIndex) {
  const items = [];
  let index = startIndex;

  while (index < lines.length && isListItemLine(lines[index])) {
    const itemLines = [lines[index].replace(/^\s*-\s+/, '').trim()];
    index += 1;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        break;
      }

      if (isBlockBoundary(line)) {
        break;
      }

      itemLines.push(line.trim());
      index += 1;
    }

    items.push({
      type: 'list_item',
      text: itemLines.join(' ').trim()
    });

    while (index < lines.length && !lines[index].trim()) {
      const nextLine = lines[index + 1];

      if (nextLine && isListItemLine(nextLine)) {
        index += 1;
        break;
      }

      index += 1;
    }
  }

  return {
    block: {
      type: 'list',
      items
    },
    index
  };
}

function parseBlocks(lines, startIndex, stopCondition) {
  const blocks = [];
  let index = startIndex;
  let pendingAnchor = null;

  while (index < lines.length) {
    if (stopCondition && stopCondition(lines[index])) {
      break;
    }

    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const anchorMatch = trimmed.match(/^\(([^)]+)\)=\s*$/);

    if (anchorMatch) {
      pendingAnchor = anchorMatch[1].trim();
      index += 1;
      continue;
    }

    if (isDirectiveStart(line)) {
      index += 1;
      const attributes = {};

      while (index < lines.length) {
        const metaLine = lines[index].trim();
        const attributeMatch = metaLine.match(/^:([a-zA-Z0-9_-]+):\s*(.*)$/);

        if (!attributeMatch) {
          break;
        }

        attributes[attributeMatch[1]] = attributeMatch[2].trim();
        index += 1;
      }

      const nested = parseBlocks(lines, index, (candidate) => candidate.trim() === ':::');
      index = nested.index;

      if (index < lines.length && lines[index].trim() === ':::') {
        index += 1;
      }

      blocks.push({
        type: 'div',
        className: attributes.class || '',
        blocks: nested.blocks
      });
      pendingAnchor = null;
      continue;
    }

    if (isThematicBreak(line)) {
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+?)\s*$/);

    if (headingMatch) {
      const raw = headingMatch[2].trim();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        raw,
        text: stripInlineMarkdown(raw),
        id: pendingAnchor || null
      });
      pendingAnchor = null;
      index += 1;
      continue;
    }

    if (isListItemLine(line)) {
      const parsedList = parseList(lines, index);
      blocks.push(parsedList.block);
      index = parsedList.index;
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;

    while (index < lines.length) {
      const paragraphLine = lines[index];

      if (!paragraphLine.trim() || isBlockBoundary(paragraphLine)) {
        break;
      }

      paragraphLines.push(paragraphLine.trim());
      index += 1;
    }

    blocks.push({
      type: 'paragraph',
      raw: paragraphLines.join(' ').trim()
    });
  }

  return { blocks, index };
}

function parseMarkdown(source) {
  const normalized = normalizeMarkdown(source);
  return parseBlocks(normalized.split('\n'), 0, null).blocks;
}

function mapBlocks(blocks, mapper) {
  return blocks.map((block) => {
    if (block.type === 'div') {
      const mappedDiv = mapper(block);

      return {
        ...mappedDiv,
        blocks: mapBlocks(mappedDiv.blocks, mapper)
      };
    }

    return mapper(block);
  });
}

function assignHeadingIds(blocks, usedIds) {
  return blocks.map((block) => {
    if (block.type === 'div') {
      return {
        ...block,
        blocks: assignHeadingIds(block.blocks, usedIds)
      };
    }

    if (block.type !== 'heading') {
      return block;
    }

    const preferredId = block.id || slugify(block.text);
    let uniqueId = preferredId;
    let suffix = 2;

    while (usedIds.has(uniqueId)) {
      uniqueId = `${preferredId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(uniqueId);
    return {
      ...block,
      id: uniqueId
    };
  });
}

function normalizeBodyBlocks(title, blocks) {
  const normalizedTitle = normalizeComparableText(title);
  const firstHeadingIndex = blocks.findIndex((block) => block.type === 'heading');
  let workingBlocks = blocks.slice();

  if (firstHeadingIndex !== -1) {
    const firstHeading = workingBlocks[firstHeadingIndex];

    if (firstHeading.level === 1 && normalizeComparableText(firstHeading.text) === normalizedTitle) {
      workingBlocks = workingBlocks.filter((_, index) => index !== firstHeadingIndex);
    } else if (firstHeading.level === 1) {
      workingBlocks = mapBlocks(workingBlocks, (block) => {
        if (block.type !== 'heading') {
          return block;
        }

        return {
          ...block,
          level: Math.min(6, block.level + 1)
        };
      });
    }
  }

  workingBlocks = mapBlocks(workingBlocks, (block) => {
    if (block.type !== 'heading' || block.level !== 1) {
      return block;
    }

    return {
      ...block,
      level: 2
    };
  });

  return assignHeadingIds(workingBlocks, new Set());
}

function extractIndexNavigation(indexBlocks) {
  const appendixBlock = indexBlocks.find((block) => block.type === 'div' && block.className === 'appendix-directory');
  const navigationBlocks = appendixBlock ? appendixBlock.blocks : indexBlocks;

  return navigationBlocks
    .filter((block) => block.type === 'heading' && block.level === 3)
    .map((block) => {
      const linkMatch = block.raw.match(/\[([^\]]+)\]\(([^)]+)\)/);

      if (!linkMatch) {
        return null;
      }

      return {
        title: stripInlineMarkdown(linkMatch[1]),
        href: linkMatch[2]
      };
    })
    .filter(Boolean);
}

function hrefToSlug(href) {
  if (!href || href === '/') {
    return 'index';
  }

  return href.replace(/^\/+|\/+$/g, '');
}

function getPageHref(slug) {
  return slug === 'index' ? '/' : `/${slug}`;
}

function renderArticleHeading(level, block, classNames) {
  const classes = classNames.filter(Boolean).join(' ');

  return [
    `<h${level} id="${escapeAttribute(block.id)}"${classes ? ` class="${escapeAttribute(classes)}"` : ''}>`,
    `<span class="article-heading-text">${renderInline(block.raw)}</span>`,
    `<a class="article-heading-anchor" href="#${escapeAttribute(block.id)}" title="Link to this Section" aria-label="Link to this Section">¶</a>`,
    `</h${level}>`
  ].join('');
}

function getAppendixItemPrefix(heading) {
  if (!heading || !heading.text) {
    return '';
  }

  const prefixMatch = heading.text.match(/^([A-Za-zÅÄÖåäö])\./);
  return prefixMatch ? prefixMatch[1].toUpperCase() : '';
}

function renderList(block, options = {}) {
  const className = options.blockClass || '';
  const classAttribute = className ? ` class="${escapeAttribute(className)}"` : '';
  const appendixItemPrefix = options.appendixItemPrefix || '';
  const listClasses = [];

  if (className) {
    listClasses.push(className);
  }

  if (appendixItemPrefix) {
    listClasses.push('appendix-item-grid');
  }

  const listClassAttribute = listClasses.length ? ` class="${escapeAttribute(listClasses.join(' '))}"` : classAttribute;
  const items = block.items.map((item, index) => {
    if (!appendixItemPrefix) {
      return `<li><p>${renderInline(item.text)}</p></li>`;
    }

    const itemCode = `${appendixItemPrefix}${index + 1}`;
    return `<li class="appendix-item content-group" data-appendix-item-code="${escapeAttribute(itemCode)}"><p>${renderInline(item.text)}</p></li>`;
  }).join('');
  return `<ul${listClassAttribute}>${items}</ul>`;
}

function renderContentGroup(group, options = {}) {
  const headingClasses = ['article-heading', 'content-group-heading'];
  const appendixItemPrefix = options.appendix ? getAppendixItemPrefix(group.heading) : '';
  const body = renderBlocks(group.blocks, {
    ...options,
    appendix: false,
    groupHeadingLevel: undefined,
    appendixItemPrefix
  });

  return `<div class="content-group">${renderArticleHeading(group.heading.level, group.heading, headingClasses)}<div class="article-content-block">${body}</div></div>`;
}

function renderGroupedBlocks(blocks, options = {}) {
  const groupHeadingLevel = options.groupHeadingLevel;

  if (!groupHeadingLevel) {
    return renderBlocks(blocks, options);
  }

  const output = [];
  let currentGroup = null;

  function flushGroup() {
    if (!currentGroup) {
      return;
    }

    output.push(renderContentGroup(currentGroup, options));
    currentGroup = null;
  }

  blocks.forEach((block) => {
    if (block.type === 'hr') {
      flushGroup();
      output.push(renderBlock(block, {
        ...options,
        groupHeadingLevel: undefined
      }));
      return;
    }

    if (block.type === 'heading' && block.level === groupHeadingLevel) {
      flushGroup();
      currentGroup = {
        heading: block,
        blocks: []
      };
      return;
    }

    if (currentGroup) {
      currentGroup.blocks.push(block);
      return;
    }

    output.push(renderBlock(block, {
      ...options,
      groupHeadingLevel: undefined
    }));
  });

  flushGroup();
  return output.join('');
}

function renderBlock(block, options = {}) {
  const blockClass = options.blockClass || '';

  if (block.type === 'paragraph') {
    const classAttribute = blockClass ? ` class="${escapeAttribute(blockClass)}"` : '';
    return `<p${classAttribute}>${renderInline(block.raw)}</p>`;
  }

  if (block.type === 'list') {
    return renderList(block, options);
  }

  if (block.type === 'hr') {
    return options.skipHr ? '' : '<hr class="section-break"/>';
  }

  if (block.type === 'div') {
    const classAttribute = block.className ? ` class="${escapeAttribute(block.className)}"` : '';
    const nextOptions = block.className === 'appendix-directory'
      ? { ...options, appendix: true, blockClass: '', groupHeadingLevel: 3 }
      : options;
    return `<div${classAttribute}>${renderGroupedBlocks(block.blocks, nextOptions)}</div>`;
  }

  if (block.type === 'heading') {
    if (options.appendix) {
      return renderArticleHeading(block.level, block, ['article-heading']);
    }

    const extraClasses = block.level >= 4
      ? ['article-heading', 'content-subheading']
      : ['article-heading'];

    return renderArticleHeading(block.level, block, extraClasses);
  }

  return '';
}

function renderBlocks(blocks, options = {}) {
  return blocks.map((block) => renderBlock(block, options)).join('');
}

function isContentGroupHeading(block) {
  return block.type === 'heading' && (block.level === 3 || block.level === 4);
}

function buildArticleModel(page) {
  const pageIntroBlocks = [];
  const sections = [];
  let currentSection = null;
  let currentGroup = null;

  page.blocks.forEach((block) => {
    if (block.type === 'hr') {
      return;
    }

    if (block.type === 'heading' && block.level === 2) {
      currentSection = {
        heading: block,
        introBlocks: [],
        groups: []
      };
      sections.push(currentSection);
      currentGroup = null;
      return;
    }

    if (!currentSection) {
      pageIntroBlocks.push(block);
      return;
    }

    if (isContentGroupHeading(block)) {
      currentGroup = {
        heading: block,
        blocks: []
      };
      currentSection.groups.push(currentGroup);
      return;
    }

    if (currentGroup) {
      currentGroup.blocks.push(block);
      return;
    }

    currentSection.introBlocks.push(block);
  });

  return {
    pageIntroBlocks,
    sections
  };
}

function buildChapterMapEntry(page) {
  if (page.slug === 'index') {
    return [];
  }

  const { sections } = page.article;

  if (!sections.length) {
    return [];
  }

  if (sections.length === 1 && sections[0].groups.length > 1) {
    const topLevelGroups = sections[0].groups.filter((group) => group.heading.level === 3);
    const chapterGroups = topLevelGroups.length > 1 ? topLevelGroups : sections[0].groups;

    return chapterGroups.map((group) => ({
      title: group.heading.text,
      anchor: group.heading.id
    }));
  }

  return sections.map((section) => ({
    title: section.heading.text,
    anchor: section.heading.id
  }));
}

function renderSection(section) {
  const hasPanels = section.groups.length > 0;
  const headingClasses = ['article-heading', 'article-section-heading', 'two-collumn-content'];

  const intro = section.introBlocks.length
    ? `<div class="article-section-intro">${renderBlocks(section.introBlocks, { blockClass: 'article-section-copy', skipHr: true })}</div>`
    : '';

  const content = hasPanels
    ? `<div class="content article-section-content">${section.groups.map((group) => renderGroup(group)).join('')}</div>`
    : '';

  return `<section class="article-section">${renderArticleHeading(2, section.heading, headingClasses)}${intro}${content}</section>`;
}

function renderGroup(group) {
  const heading = renderArticleHeading(group.heading.level, group.heading, ['article-heading', 'content-group-heading']);
  const body = renderBlocks(group.blocks, { skipHr: true });
  return `<div class="content-group">${heading}<div class="article-content-block">${body}</div></div>`;
}

function renderPageHero(page) {
  const subtitle = page.metadata.subtitle
    ? `<p class="page-subtitle">${renderInline(page.metadata.subtitle)}</p>`
    : '';

  return `<div id="skip-to-frontmatter" aria-label="article frontmatter" class="page-hero"><h1 class="page-title">${escapeHtml(page.heroTitle)}</h1>${subtitle}</div><div id="skip-to-article"></div>`;
}

function renderPageBody(page) {
  const introMarkup = page.article.pageIntroBlocks.length
    ? `<div class="article-page-intro">${renderBlocks(page.article.pageIntroBlocks, { skipHr: true })}</div>`
    : '';
  const sectionsMarkup = page.article.sections.map((section) => renderSection(section)).join('');
  return `${renderPageHero(page)}${introMarkup}${sectionsMarkup}`;
}

function renderPaginationLink(direction, page) {
  const isPrev = direction === 'site-pagination-link-prev';
  const eyebrow = isPrev ? '← Tillbaka' : 'Nästa →';
  return `<a class="site-pagination-link ${direction}" href="${escapeAttribute(getPageHref(page.slug))}"><span class="site-pagination-eyebrow">${eyebrow}</span><span class="site-pagination-label">${escapeHtml(page.navTitle)}</span></a>`;
}

function renderPagination(pages, currentIndex) {
  const links = [];

  if (currentIndex > 0) {
    links.push(renderPaginationLink('site-pagination-link-prev', pages[currentIndex - 1]));
  }

  if (currentIndex < pages.length - 1) {
    links.push(renderPaginationLink('site-pagination-link-next', pages[currentIndex + 1]));
  }

  if (!links.length) {
    return '';
  }

  return `<nav class="site-pagination" aria-label="Article pagination">${links.join('')}</nav>`;
}

function renderPrimaryNavigation(pages, currentSlug) {
  const items = pages.map((page) => {
    const isCurrent = page.slug === currentSlug;
    const className = `site-nav-link${isCurrent ? ' is-active' : ''}`;
    const ariaCurrent = isCurrent ? ' aria-current="page"' : '';
    return `<li class="site-nav-item"><a class="${className}" href="${escapeAttribute(getPageHref(page.slug))}"${ariaCurrent}>${escapeHtml(page.navTitle)}</a></li>`;
  }).join('');

  return `<ul class="site-nav-list">${items}</ul>`;
}

function renderHtmlDocument(page, pages) {
  const currentIndex = pages.findIndex((candidate) => candidate.slug === page.slug);
  const description = page.metadata.description || SITE_DESCRIPTION;
  const pageTitle = page.slug === 'index' ? SITE_BRAND : `${page.metadata.title} - ${SITE_BRAND}`;
  const articleMarkup = renderPageBody(page);
  const paginationMarkup = renderPagination(pages, currentIndex);

  return [
    '<!DOCTYPE html>',
    '<html lang="en" class="" style="scroll-padding:60px">',
    '<head>',
    '  <meta charSet="utf-8" />',
    '  <meta name="viewport" content="width=device-width,initial-scale=1" />',
    `  <title>${escapeHtml(pageTitle)}</title>`,
    `  <meta property="og:title" content="${escapeAttribute(pageTitle)}" />`,
    `  <meta name="description" content="${escapeAttribute(description)}" />`,
    `  <meta property="og:description" content="${escapeAttribute(description)}" />`,
    '  <meta name="keywords" content="" />',
    '  <link rel="stylesheet" href="/build/_assets/app-CNUB3V65.css" />',
    '  <link rel="stylesheet" href="/build/_assets/thebe-core-VKVHG5VY.css" />',
    '  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jupyter-matplotlib@0.11.3/css/mpl_widget.css" />',
    '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.css" />',
    '  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.15.2/dist/katex.min.css" integrity="sha384-MlJdn/WNKDGXveldHDdyRP1R4CTHr3FeuDNfhsLPYrq2t0UBkUdK2jyTnXPEK1NQ" crossorigin="anonymous" />',
    '  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '  <link rel="stylesheet" href="/theme.css" />',
    '  <script src="/site-data.js" defer></script>',
    '  <script>',
    '    const savedTheme = localStorage.getItem("theme");',
    '    const theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";',
    '    const classes = document.documentElement.classList;',
    '    const hasAnyTheme = classes.contains("light") || classes.contains("dark");',
    '    if (!hasAnyTheme) classes.add(savedTheme ?? theme);',
    '  </script>',
    '</head>',
    '<body class="site-body">',
    '  <div id="tsparticles"></div>',
    '  <div class="site-skip-links" aria-label="skip to content options">',
    '    <a href="#skip-to-frontmatter" class="site-skip-link">Skip to article frontmatter</a>',
    '    <a href="#skip-to-article" class="site-skip-link">Skip to article content</a>',
    '  </div>',
    '  <header class="site-header">',
    '    <div class="site-header-bar">',
    `      <button class="site-menu-button" type="button" aria-label="Open navigation" aria-expanded="false">${MENU_BUTTON_ICON}</button>`,
    '      <a class="site-brand" href="/">Phi-ihP</a>',
    '    </div>',
    '  </header>',
    '  <aside class="site-sidebar">',
    '    <div class="site-sidebar-shell">',
    '      <nav aria-label="Primary" class="site-sidebar-nav">',
    '        <div class="site-sidebar-scroll">',
    `          <div class="site-sidebar-toc">${renderPrimaryNavigation(pages, page.slug)}</div>`,
    '        </div>',
    '      </nav>',
    '    </div>',
    '  </aside>',
    '  <main class="site-main">',
    `    <article class="site-article" data-section-layout-ready="true">${articleMarkup}<div class="site-backmatter"></div>${paginationMarkup}</article>`,
    '  </main>',
    `  ${RUNTIME_LOADER}`,
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function renderSiteData(pages) {
  const chapterMap = {};

  pages.forEach((page) => {
    chapterMap[page.slug] = buildChapterMapEntry(page);
  });

  return `window.PROPHILE_CHAPTER_MAP = ${JSON.stringify(chapterMap, null, 2)};\n`;
}

function renderSitemap(pages) {
  const entries = pages.map((page) => {
    const pagePath = page.slug === 'index' ? '/' : `/${page.slug}/`;
    return `  <url>\n    <loc>${LOCAL_SITE_ORIGIN}${pagePath}</loc>\n  </url>`;
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
    ''
  ].join('\n');
}

function renderRobots() {
  return [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${LOCAL_SITE_ORIGIN}/sitemap.xml`,
    ''
  ].join('\n');
}

function readMarkdownDocuments() {
  const files = fs.readdirSync(CONTENT_DIR)
    .filter((fileName) => fileName.endsWith('.md'))
    .sort((left, right) => left.localeCompare(right));

  return files.map((fileName) => {
    const slug = fileName === 'index.md' ? 'index' : fileName.replace(/\.md$/, '');
    const sourcePath = path.join(CONTENT_DIR, fileName);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const { metadata, body } = parseFrontmatter(source);
    const parsedBlocks = parseMarkdown(body);

    return {
      slug,
      sourcePath,
      metadata,
      rawBlocks: parsedBlocks
    };
  });
}

function buildPageOrder(documents) {
  const indexDocument = documents.find((document) => document.slug === 'index');
  const navigationEntries = indexDocument ? extractIndexNavigation(indexDocument.rawBlocks) : [];
  const orderedSlugs = ['index'];

  navigationEntries.forEach((entry) => {
    const slug = hrefToSlug(entry.href);

    if (!orderedSlugs.includes(slug)) {
      orderedSlugs.push(slug);
    }
  });

  documents.forEach((document) => {
    if (!orderedSlugs.includes(document.slug)) {
      orderedSlugs.push(document.slug);
    }
  });

  return orderedSlugs;
}

function enrichPages(documents) {
  const order = buildPageOrder(documents);
  const indexDocument = documents.find((document) => document.slug === 'index');
  const navigationEntries = indexDocument ? extractIndexNavigation(indexDocument.rawBlocks) : [];
  const navigationTitleBySlug = navigationEntries.reduce((accumulator, entry) => {
    accumulator[hrefToSlug(entry.href)] = entry.title;
    return accumulator;
  }, {});
  const documentMap = documents.reduce((accumulator, document) => {
    accumulator[document.slug] = document;
    return accumulator;
  }, {});

  return order
    .map((slug) => documentMap[slug])
    .filter(Boolean)
    .map((document) => {
      const metadataTitle = document.metadata.title || (document.slug === 'index' ? 'Appendix' : document.slug);
      const heroTitle = metadataTitle;
      const navTitle = document.slug === 'index'
        ? 'Appendix'
        : (navigationTitleBySlug[document.slug] || metadataTitle);
      const blocks = normalizeBodyBlocks(heroTitle, document.rawBlocks);
      const article = buildArticleModel({
        slug: document.slug,
        blocks
      });

      return {
        ...document,
        metadata: {
          ...document.metadata,
          title: metadataTitle
        },
        heroTitle,
        navTitle,
        blocks,
        article
      };
    });
}

function cleanupPreviousGeneratedOutput() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return;
  }

  let manifest = null;

  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    manifest = null;
  }

  if (!manifest) {
    return;
  }

  (manifest.files || []).forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  (manifest.directories || []).sort((left, right) => right.length - left.length).forEach((directoryPath) => {
    if (fs.existsSync(directoryPath)) {
      fs.rmSync(directoryPath, { recursive: true, force: true });
    }
  });
}

function writeGeneratedManifest(files, directories) {
  const manifest = {
    files,
    directories
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

function writePage(page, pages) {
  const targetPath = page.slug === 'index'
    ? INDEX_HTML_PATH
    : path.join(SITE_DIR, page.slug, 'index.html');

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, renderHtmlDocument(page, pages), 'utf8');

  return targetPath;
}

function buildContentSite() {
  if (!fs.existsSync(CONTENT_DIR) || !fs.statSync(CONTENT_DIR).isDirectory()) {
    throw new Error(`Content directory is missing: ${CONTENT_DIR}`);
  }

  if (!fs.existsSync(SITE_DIR) || !fs.statSync(SITE_DIR).isDirectory()) {
    throw new Error(`Site directory is missing: ${SITE_DIR}`);
  }

  cleanupPreviousGeneratedOutput();

  const pages = enrichPages(readMarkdownDocuments());
  const generatedFiles = [];
  const generatedDirectories = [];

  pages.forEach((page) => {
    const pagePath = writePage(page, pages);
    generatedFiles.push(pagePath);

    if (page.slug !== 'index') {
      generatedDirectories.push(path.join(SITE_DIR, page.slug));
    }
  });

  fs.writeFileSync(SITE_DATA_PATH, renderSiteData(pages), 'utf8');
  fs.writeFileSync(SITEMAP_PATH, renderSitemap(pages), 'utf8');
  fs.writeFileSync(ROBOTS_PATH, renderRobots(), 'utf8');

  generatedFiles.push(SITE_DATA_PATH, SITEMAP_PATH, ROBOTS_PATH);
  writeGeneratedManifest(generatedFiles, generatedDirectories);

  return {
    pages: pages.map((page) => ({
      slug: page.slug,
      navTitle: page.navTitle
    })),
    generatedFiles
  };
}

if (require.main === module) {
  const result = buildContentSite();
  console.log('[build-content] INFO Generated HTML from markdown', {
    pages: result.pages.map((page) => page.slug),
    writtenFiles: result.generatedFiles.length
  });
} else {
  module.exports = {
    buildContentSite
  };
}
