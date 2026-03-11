# Workflow

## Purpose

This project deploys from markdown-authored content plus a static site shell. MyST is no longer part of the build or deploy path.

## Source of truth

- `content/*.md` is the content source of truth.
- `build-content.js` converts the markdown files into `site/index.html`, `site/<page>/index.html`, `site/site-data.js`, `site/sitemap.xml`, and `site/robots.txt`.
- `site/myst-theme.css` is the active global stylesheet.
- `site/site-runtime.js`, `site/sidebar-headings.js`, `site/article-sections.js`, `site/tsparticles.js`, and `site/tsparticles.css` are the active runtime files.
- `local-serve.js` runs the markdown build by default, copies `site/` into `_build/html` or `_build/site`, rewrites root-relative URLs for the configured base path, updates sitemap and robots URLs, and serves the output locally.

## Editing routine

1. Edit page content in `content/*.md`.
2. Edit shared behavior in the JS files under `site/`.
3. Edit shared styling in `site/myst-theme.css`.
4. Run `node build-content.js` or `node local-serve.js --build-only` to regenerate the HTML pages.
5. If you add a page, add a new markdown file in `content/` and update `content/index.md` so navigation and pagination order stay intentional.

## Local build

Build only:

```powershell
node local-serve.js --target html --build-only
```

Generate the site HTML without copying to `_build`:

```powershell
node build-content.js
```

Build for GitHub Pages with a repo base path:

```powershell
node local-serve.js --target html --build-only --base-url "/profile" --site-origin "https://<owner>.github.io/profile"
```

Build and serve locally:

```powershell
node local-serve.js --target html
```

Build and serve with the same repo prefix as GitHub Pages:

```powershell
node local-serve.js --target html --base-url "/profile"
```

## Deploy

Deploy runs through `.github/workflows/deploy.yml`.

Flow:

1. Push to `main`.
2. GitHub Actions runs `node build-content.js`.
3. GitHub Actions runs `node local-serve.js --skip-content-build --target html --build-only --base-url "/<repo-name>" --site-origin "https://<owner>.github.io/<repo-name>"`.
4. `_build/html` is uploaded to GitHub Pages.

## Pre-push check

- The site builds without errors.
- Navigation links work from the homepage and each article page.
- Assets load both locally and with a repo base path.
- `sitemap.xml` and `robots.txt` point to the correct public site URL in the built output.
