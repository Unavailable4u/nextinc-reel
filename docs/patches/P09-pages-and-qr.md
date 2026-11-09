### PATCH 09 - Interior page painters, QR codes, spreads

**Needs:** 01, 08
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/data/select.ts`, `src/config/bookText.ts`, `src/paint/typography.ts`, `src/paint/patterns.ts`
**Paste reference (read-only, from other repos):** `nextinc/assets/css/site.css` (caption, "smcp" small-caps and figure styles), `nextinc/assets/data/projects.js`
**Attach from guide:** `docs/guide/04-book-design.md` sections 4-6, `docs/guide/07-content-and-assets.md` (all), `content/books.md`, `docs/guide/06-page-turn-physics.md` section 6
**Before you start (you do this, not the assistant):** put cropped screenshots in `public/screens/<book>/` (guide 07, screenshot preparation rule) and approve the captions in `content/books.md`.

```
PATCH 09 - Interior page painters, QR codes, spreads.

GOAL: every page type painted as a pure function of data into a 2048 x 3072 canvas, QR codes generated and verified, and a spread composer.

CREATE / CHANGE:
- `src/paint/pages/*.ts`: P-END, P-HALF, P-BLANK, P-TITLE, P-COLO, P-ABST, P-FIG, P-GAL, P-FILM, P-LINK, P-BACK per guide 04; layout grid from guide 04 section 4; mounted-print look for screenshots; the film page never plays (a poster, a play mark, the duration, the "Interactive edition" tag)
- `src/paint/qr.ts` (a QR library; level M; 4-module quiet zone; drawn as vector squares on the canvas), `scripts/check-qr.mjs` and `npm run qr:check` (renders the QR spreads, decodes them from the PNG with a decoder library and compares with `getQrTargets`)
- `src/config/pageSpecs.ts`: the page list for each book (Mini Me full sequence, MiniLocker short sequence, SPHEREx and Immersive for the riser only)
- `src/paint/spread.ts`: `paintSpread(bookId, leftIndex)`; a texture cache with disposal by act
- `src/dev/DevPages.tsx`: one of every page type per book with a margin overlay, and a toggle for "readable only" strings (checks the 8-word and contrast rules)

RULES THAT MATTER HERE:
- Body text is real text cut from the data; no lorem ipsum.
- Every must-read string is at most 8 words.
- Texture memory budget: one book's full-size pages alive at once.

CHECK:
- `npm run qr:check` passes for all QR pages
- Every page type renders for every book that uses it, with no overflow
- Point a real phone at `DevPages` on your monitor: the QR opens the right page
```

**Acceptance (what you look at to say yes):** You can read the title page, abstract, captions and film page at 100% in the Dev sheet; the QR scans.
**Do not:** Bend or animate pages.
