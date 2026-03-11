# Workflow

## Purpose

This project now deploys from plain static source files. MyST is no longer part of the build or deploy path.

## Source of truth

- `site/` contains the deployable site.
- `site/index.html` is the homepage.
- `site/<page>/index.html` contains each article page.
- `site/myst-theme.css` is the global stylesheet currently used by the copied pages.
- `site/site-runtime.js`, `site/sidebar-headings.js`, `site/article-sections.js`, `site/tsparticles.js`, and `site/tsparticles.css` are the active runtime files.
- `local-serve.js` copies `site/` into `_build/html` or `_build/site`, rewrites root-relative URLs for the configured base path, updates sitemap and robots URLs, and serves the output locally.

Legacy files such as `content/`, `myst.yml`, `static/`, and `my-style.css` are no longer used by the deploy pipeline. Keep them only if you still want the old authoring source around.

## Editing routine

1. Edit page content directly in `site/*.html`.
2. Edit shared behavior in the JS files under `site/`.
3. Edit shared styling in `site/myst-theme.css`.
4. If you add a page, create `site/<slug>/index.html` and update the navigation links in the existing HTML pages.
5. If you add or rename a public page, update `site/sitemap.xml` and verify `robots.txt` still points to the sitemap.

## Local build

Build only:

```powershell
node local-serve.js --target html --build-only
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
2. GitHub Actions runs `node local-serve.js --target html --build-only --base-url "/<repo-name>" --site-origin "https://<owner>.github.io/<repo-name>"`.
3. `_build/html` is uploaded to GitHub Pages.

## Pre-push check

- The site builds without errors.
- Navigation links work from the homepage and each article page.
- Assets load both locally and with a repo base path.
- `sitemap.xml` and `robots.txt` point to the correct public site URL in the built output.
