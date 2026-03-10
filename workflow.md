# Workflow

## Syfte

Den här rutinen gäller när sidan uppdateras med nytt eller ändrat innehåll. Projektet bygger på MyST Book Markdown, renderas som statisk HTML och deployas till GitHub Pages via GitHub Actions.

## Innehållsstruktur

- Allt redaktionellt innehåll ska ligga i `content/`.
- `myst.yml` är källan för bokens TOC och sidordning.
- `my-style.css` är projektets centrala temaoverride.
- `static/site-runtime.js` laddar in runtimefiler efter build.
- `static/sidebar-headings.js` bygger om vänsternavigeringen, kapitelkoder och mobilsidebar.
- `local-serve.js` bygger HTML, injicerar runtime-loader, kopierar assets och förbereder output för GitHub Pages.

## Standardrutin vid innehållsändring

1. Kontrollera att `content/` och TOC matchar.
2. Jämför alla `.md`-filer i `content/` mot `project.toc` i `myst.yml`.
3. Om en `.md`-fil finns i TOC men inte i `content/`, korrigera sökvägen eller flytta filen.
4. Om en `.md`-fil finns i `content/` men inte i TOC, avgör om den ska publiceras. Om ja: lägg in den i `myst.yml` på rätt plats.
5. Vid nytt content: lägg sidan i `content/`, ge den frontmatter, lägg till den i TOC och uppdatera Appendix-sidan om sidan ska synas där.
6. Om sidan ska ha sektionslänkar i vänsternavigeringen: uppdatera `chapterMap` i `static/sidebar-headings.js`.

## Rubriker och innehåll

- Håll rubrikdjup konsekvent: `#` för sidtitel, `##` för huvudsektioner, `###` för delsektioner, `####` bara vid faktisk underordning.
- Kortare definitionsliknande stycken under `###` och `####` ska fortsätta som indenterat innehåll via CSS.
- Avsluta huvudsektioner med `---` så att dokumentrytmen blir konsekvent.
- Undvik speciallayout i HTML om vanlig Markdown räcker. Typografin blir stabilare när samma struktur delas av alla sidor.

## TOC och Appendix

- `content/index.md` fungerar som Appendix/översiktssida.
- Vänsternavigeringen visar inte Appendix som eget kapitel.
- Kapitelbokstäver i Appendix ska matcha bokstäverna i runtime-nav.
- När sidordningen ändras i `myst.yml` ska även Appendix-sidan och `static/sidebar-headings.js` synkas.

## CSS-hierarki

Hierarkin ser ut så här:

1. MyST theme CSS laddas först.
2. `my-style.css` laddas via `site.options.style` i `myst.yml`.
3. `local-serve.js` injicerar runtime-loader i byggd HTML.
4. `static/site-runtime.js` laddar extra runtime-assets efter sidladdning.
5. `static/sidebar-headings.js` manipulerar DOM för sidebar och mobilnav.

Praktisk regel:

- Om något kan lösas med ren CSS i `my-style.css`, gör det där först.
- Använd JS bara när beteende eller post-build DOM-omskrivning krävs.
- Lägg nya override-regler sent i `my-style.css` om de ska vinna över tidigare regler.

## JS-injektion och runtime

Efter MyST-build gör `local-serve.js` följande:

- injicerar runtime-loader i byggda HTML-filer
- lägger in `#tsparticles`-container
- tar bort oönskad runtime/module-bootstrap från output
- kopierar filer från `static/` till buildmappen
- skriver `.nojekyll` för GitHub Pages

Det betyder att runtimebeteende inte ska skrivas direkt i MyST-sidorna om det egentligen är global site-logik.

## Lokal build

Bygg endast HTML:

```powershell
node local-serve.js --target html --build-only
```

Bygg och servera lokalt:

```powershell
node local-serve.js --target html
```

## GitHub deploy

Deploy sker via `.github/workflows/deploy.yml`.

Flödet är:

1. Push till `main`.
2. GitHub Action installerar `mystmd`.
3. `node local-serve.js --target html --build-only --base-url "/<repo-namn>"` körs.
4. `_build/html` laddas upp till GitHub Pages.

## Git-rutin

Efter verifierad ändring:

```powershell
git status
git add myst.yml content my-style.css static workflow.md .github/workflows/deploy.yml local-serve.js
git commit -m "Update site structure and document workflow"
git push origin main
```

Justera `git add` till de filer som faktiskt ändrats.

## Minimikontroll innan push

- Sidan bygger utan fel.
- Alla publicerade `.md`-filer ligger i `content/`.
- Alla publicerade `.md`-filer finns i TOC.
- Appendix och sidebar har samma sidordning och samma bokstavskoder.
- Mobilsidebar går att öppna, scrolla och stänga.
- Länkar fungerar både i desktop- och mobilvy.
