### PATCH 01 - Site data sync and typed selectors

**Needs:** 00
**Parallel-safe with:** 02
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `package.json`
**Paste reference (read-only, from other repos):** `nextinc/assets/data/site.js`, `projects.js`, `films.js`, `team.js`; `nextinc/docs/projects/BRIEFS.md`
**Attach from guide:** `docs/guide/07-content-and-assets.md` (all), `docs/guide/04-book-design.md` section 6

```
PATCH 01 - Site data sync and typed selectors.

GOAL: the film reads its facts from the website repo: one command makes `src/data/site-snapshot.json`; typed selectors expose books, authors, films, QR targets; a missing value throws an error naming its path.

CREATE / CHANGE:
- `scripts/sync-site.mjs`: reads `assets/data/{site,projects,films,team}.js` from `SITE_REPO` (default `../nextinc`) by evaluating each file in a Node `vm` sandbox with a stub `window`; writes `src/data/site-snapshot.json` with `meta` (website git commit from `git rev-parse HEAD`, synced date, file hashes) and the four data objects; flag `--check` exits 1 when the committed snapshot differs from the site; flag `--copy-media` copies only the images the books need (covers, posters, mini-me logo, fonts) into `public/site/` with their hashes in the snapshot
- `src/data/types.ts` (types for the four data shapes), `src/data/select.ts`: `getCompany()`, `getAuthors()`, `getBooks()` (site order, with `volume` 1-4), `getBook(slug)`, `getFilmsFor(slug)`, `getQrTargets(slug)` implementing the table in guide 07 section 3 (case-study URL from `site.url` + `/project.html?p=` + slug; YouTube links as `https://youtu.be/<id>`), `getColophon(slug)`, `cutAtSentence(text, maxWords)`, `getRiserLabel(slug)` (title, year, status)
- every selector throws `Error("missing data: projects.minilocker.films[0].duration")` style messages; no fallbacks, no defaults
- `content/books.md` is NOT parsed here; add a tiny typed file `src/config/bookText.ts` with the non-factual choices (display titles per D-08, captions, screenshot order) copied from `content/books.md`
- a Node test script `scripts/test-select.mjs` that prints the four books, their QR targets and checks that `minime.app` appears nowhere in the snapshot-derived strings

RULES THAT MATTER HERE:
- Truth rule: this is the only place facts enter the film.
- Never invent a link; Mini Me has no product URL (D-17).
- The snapshot is committed to git; `meta` makes each render traceable.

CHECK:
- `npm run sync` writes the snapshot; `git diff` shows it
- `npm run sync -- --check` exits 0, then exits 1 after you edit a title in the website copy
- `node scripts/test-select.mjs` prints Mini Me, SPHEREx, MiniLocker, Immersive in that order with the QR targets from guide 07
- delete one field in a copy of the snapshot: the selector error names the path
- `npx tsc --noEmit`
```

**Acceptance (what you look at to say yes):** You can read the four books and their QR targets in the terminal, all matching the website.
**Do not:** Draw anything or touch `content/books.md`.
