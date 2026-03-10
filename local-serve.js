#!/usr/bin/env node
/**
 * local-serve.js
 *
 * Builds the MyST HTML output, applies the post-build enhancements used by
 * this project, copies required assets, and serves the generated site.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CONFIG = {
  staticDir: path.join(__dirname, 'static'),
  port: 8080,
  assets: ['tsparticles.js', 'tsparticles.css', 'sidebar-headings.js', 'article-sections.js', 'site-runtime.js'],
  rootAssets: ['logo.png', 'favicon.svg'],
  containerInjection: '\n<div id="tsparticles"></div>\n',
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
    '.ttf': 'font/ttf'
  }
};

const LOG_PREFIX = '[local-serve]';

function parseCliArgs(argv) {
  const options = {
    buildTarget: 'html',
    buildOnly: false,
    baseUrl: '',
    port: CONFIG.port
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextArgument = argv[index + 1];

    if (argument === '--build-only') {
      options.buildOnly = true;
      continue;
    }

    if (argument === '--target' && nextArgument) {
      options.buildTarget = nextArgument === 'site' ? 'site' : 'html';
      index += 1;
      continue;
    }

    if (argument === '--base-url' && nextArgument) {
      options.baseUrl = nextArgument;
      index += 1;
      continue;
    }

    if (argument === '--port' && nextArgument) {
      const parsedPort = Number.parseInt(nextArgument, 10);

      if (!Number.isNaN(parsedPort) && parsedPort > 0) {
        options.port = parsedPort;
      }

      index += 1;
      continue;
    }
  }

  return options;
}

function getBuildDir(buildTarget) {
  return path.join(__dirname, '_build', buildTarget === 'site' ? 'site' : 'html');
}

function getBuildCommand(buildTarget) {
  return buildTarget === 'site' ? 'myst build --site' : 'myst build --html';
}

function getRuntimeLoaderInjection() {
  return [
    '<script>',
    '(function bootstrapProphileRuntimeLoader() {',
    "  'use strict';",
    '  try {',
    '    var themeLink = document.querySelector(\'link[href$="myst-theme.css"], link[href*="/myst-theme.css"]\');',
    '    var href = themeLink ? themeLink.getAttribute(\'href\') : \"\";',
    '    var match = href ? href.match(/^(.*)\\/myst-theme\\.css(?:\\?.*)?$/) : null;',
    '    var basePath = match && match[1] && match[1] !== \"/\" ? match[1].replace(/\\/+$/, \"\") : \"\";',
    '    var runtimeUrl = (basePath ? basePath : \"\") + \"/site-runtime.js\";',
    "    if (document.querySelector('script[src=\"' + runtimeUrl + '\"]')) {",
    '      return;',
    '    }',
    '    var runtimeScript = document.createElement(\'script\');',
    '    runtimeScript.src = runtimeUrl;',
    '    runtimeScript.defer = true;',
    '    runtimeScript.dataset.prophileRuntime = \"true\";',
    '    document.body.appendChild(runtimeScript);',
    '  } catch (error) {',
    '    console.error(\'[site-runtime] ERROR Failed to inject runtime loader\', error);',
    '  }',
    '})();',
    '</script>'
  ].join('\n');
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

function runBuild(options) {
  const buildCommand = getBuildCommand(options.buildTarget);
  const buildEnvironment = Object.assign({}, process.env);

  if (options.baseUrl) {
    buildEnvironment.BASE_URL = options.baseUrl;
  }

  logInfo('Starting MyST build', {
    buildTarget: options.buildTarget,
    baseUrl: options.baseUrl || '/',
    command: buildCommand
  });

  try {
    execSync(buildCommand, { stdio: 'inherit', cwd: __dirname, env: buildEnvironment });
    logInfo('MyST build completed successfully', {
      buildTarget: options.buildTarget,
      outputDirectory: path.relative(__dirname, getBuildDir(options.buildTarget))
    });
  } catch (error) {
    logError('MyST HTML build failed', error && error.message ? error.message : error);
    throw error;
  }
}

function findHtmlFiles(directoryPath) {
  const htmlFiles = [];

  function walk(currentPath) {
    let entries = [];

    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      logWarn(`Unable to read directory ${currentPath}`, error && error.message ? error.message : error);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  }

  if (!fs.existsSync(directoryPath)) {
    logWarn(`Build directory does not exist: ${directoryPath}`);
    return htmlFiles;
  }

  walk(directoryPath);
  return htmlFiles;
}

function stripRuntime(html) {
  let updatedHtml = html;
  const summary = {
    modulePreloadsRemoved: 0,
    remixContextRemoved: 0,
    moduleScriptsRemoved: 0,
    bootstrapScriptsRemoved: 0
  };

  const modulePreloads = updatedHtml.match(/<link rel="modulepreload"[^>]*>/g);
  summary.modulePreloadsRemoved = modulePreloads ? modulePreloads.length : 0;
  updatedHtml = updatedHtml.replace(/<link rel="modulepreload"[^>]*>/g, '');

  const remixContext = updatedHtml.match(/<script>window\.__remixContext\s*=[\s\S]*?<\/script>/g);
  summary.remixContextRemoved = remixContext ? remixContext.length : 0;
  updatedHtml = updatedHtml.replace(/<script>window\.__remixContext\s*=[\s\S]*?<\/script>/g, '');

  const moduleScripts = updatedHtml.match(/<script type="module"[^>]*>[\s\S]*?<\/script>/g);
  summary.moduleScriptsRemoved = moduleScripts ? moduleScripts.length : 0;
  updatedHtml = updatedHtml.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, '');

  const bootstrapScripts = updatedHtml.match(/<script>\(\(a,l\)=>[\s\S]*?<\/script>/g);
  summary.bootstrapScriptsRemoved = bootstrapScripts ? bootstrapScripts.length : 0;
  updatedHtml = updatedHtml.replace(/<script>\(\(a,l\)=>[\s\S]*?<\/script>/g, '');

  return { html: updatedHtml, summary };
}

function normalizeLayout(html) {
  let updatedHtml = html;
  const summary = {
    sidebarTopStyleRemoved: 0,
    hiddenSidebarClassRemoved: 0
  };

  const sidebarTopStyles = updatedHtml.match(/style="top:(60px| 60px)"/g);
  summary.sidebarTopStyleRemoved = sidebarTopStyles ? sidebarTopStyles.length : 0;
  updatedHtml = updatedHtml.replace(/style="top:(60px| 60px)"/g, '');

  const hiddenSidebarClass = updatedHtml.match(/myst-primary-sidebar([^"]*)hidden/g);
  summary.hiddenSidebarClassRemoved = hiddenSidebarClass ? hiddenSidebarClass.length : 0;
  updatedHtml = updatedHtml.replace(/myst-primary-sidebar([^"]*)hidden/g, 'myst-primary-sidebar$1');

  return { html: updatedHtml, summary };
}

function injectEnhancements(html, filePath) {
  let updatedHtml = html;
  const runtimeLoaderInjection = getRuntimeLoaderInjection();
  const summary = {
    containerInjected: false,
    runtimeLoaderInjected: false,
    runtime: {},
    layout: {}
  };

  if (!/<body[^>]*>/i.test(updatedHtml)) {
    throw new Error(`Missing <body> tag in ${filePath}`);
  }

  if (!/<\/body>/i.test(updatedHtml)) {
    throw new Error(`Missing </body> tag in ${filePath}`);
  }

  if (!updatedHtml.includes('id="tsparticles"')) {
    updatedHtml = updatedHtml.replace(/(<body[^>]*>)/i, `$1${CONFIG.containerInjection}`);
    summary.containerInjected = true;
  }

  if (!updatedHtml.includes('/site-runtime.js') && !updatedHtml.includes('bootstrapProphileRuntimeLoader')) {
    updatedHtml = updatedHtml.replace(/<\/body>/i, `${runtimeLoaderInjection}\n</body>`);
    summary.runtimeLoaderInjected = true;
  }

  const runtimeResult = stripRuntime(updatedHtml);
  updatedHtml = runtimeResult.html;
  summary.runtime = runtimeResult.summary;

  const layoutResult = normalizeLayout(updatedHtml);
  updatedHtml = layoutResult.html;
  summary.layout = layoutResult.summary;

  // Remove the div wrapper around the logo in the top nav
  updatedHtml = updatedHtml.replace(/<div class="myst-home-link-logo[^>]*>.*?<\/div>/g, '');

  updatedHtml = updatedHtml.replace(/href="\/favicon\.ico"/g, 'href="/favicon.svg" type="image/svg+xml"');

  return { html: updatedHtml, summary };
}

function updateBuiltHtml(buildDir) {
  const htmlFiles = findHtmlFiles(buildDir);
  logInfo(`Found ${htmlFiles.length} HTML files to process`);

  for (const filePath of htmlFiles) {
    try {
      const originalHtml = fs.readFileSync(filePath, 'utf8');
      const result = injectEnhancements(originalHtml, filePath);

      if (result.html !== originalHtml) {
        fs.writeFileSync(filePath, result.html, 'utf8');
        logInfo(`Updated ${path.relative(buildDir, filePath)}`, result.summary);
      } else {
        logInfo(`No changes needed for ${path.relative(buildDir, filePath)}`);
      }
    } catch (error) {
      logError(`Failed to process ${filePath}`, error && error.message ? error.message : error);
      throw error;
    }
  }
}

function copyStaticAssets(buildDir) {
  for (const fileName of CONFIG.assets) {
    const sourcePath = path.join(CONFIG.staticDir, fileName);
    const destinationPath = path.join(buildDir, fileName);

    if (!fs.existsSync(sourcePath)) {
      logWarn(`Static asset missing: ${sourcePath}`);
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
    logInfo(`Copied static asset ${fileName}`);
  }

  for (const fileName of CONFIG.rootAssets) {
    const sourcePath = path.join(__dirname, fileName);
    const destinationPath = path.join(buildDir, fileName);

    if (!fs.existsSync(sourcePath)) {
      logWarn(`Root asset missing: ${sourcePath}`);
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
    logInfo(`Copied root asset ${fileName}`);
  }
}

function writeNoJekyllFile(buildDir) {
  const noJekyllPath = path.join(buildDir, '.nojekyll');

  try {
    fs.writeFileSync(noJekyllPath, '', 'utf8');
    logInfo(`Ensured GitHub Pages bypass file ${path.relative(__dirname, noJekyllPath)}`);
  } catch (error) {
    logError(`Failed to write ${noJekyllPath}`, error && error.message ? error.message : error);
    throw error;
  }
}

function resolveRequestPath(requestUrl) {
  const rawPath = (requestUrl || '/').split('?')[0];
  const decodedPath = decodeURIComponent(rawPath || '/');
  const normalizedPath = path.posix.normalize(decodedPath);

  if (normalizedPath.includes('..')) {
    throw new Error(`Rejected suspicious path traversal attempt: ${decodedPath}`);
  }

  let resolvedPath = normalizedPath;

  if (resolvedPath.endsWith('/')) {
    resolvedPath += 'index.html';
  }

  if (!path.posix.extname(resolvedPath)) {
    resolvedPath += '/index.html';
  }

  return resolvedPath.replace(/^\//, '');
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

function startServer(buildDir, port) {
  const server = http.createServer((request, response) => {
    try {
      const requestedPath = resolveRequestPath(request.url);
      const primaryPath = path.join(buildDir, requestedPath);
      const fallbackPath = path.join(buildDir, requestedPath.replace(/\/index\.html$/i, '.html'));

      logInfo(`HTTP ${request.method || 'GET'} ${request.url || '/'}`, {
        primaryPath: path.relative(buildDir, primaryPath),
        fallbackPath: path.relative(buildDir, fallbackPath)
      });

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
    logInfo(`Serving MyST site at http://localhost:${port}`);
  });
}

function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const buildDir = getBuildDir(options.buildTarget);

  try {
    runBuild(options);
    updateBuiltHtml(buildDir);
    copyStaticAssets(buildDir);
    writeNoJekyllFile(buildDir);

    if (options.buildOnly) {
      logInfo('Build-only mode completed successfully', {
        buildTarget: options.buildTarget,
        buildDir: path.relative(__dirname, buildDir)
      });
      return;
    }

    startServer(buildDir, options.port);
  } catch (error) {
    logError('Startup failed', error && error.message ? error.message : error);
    process.exit(1);
  }
}

main();
